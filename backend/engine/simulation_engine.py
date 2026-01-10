"""Engine for running asset simulations."""

import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json

from backend.db.session import SessionLocal
from backend.models.asset import Asset
from backend.models.market_data import MarketData


@dataclass
class DCAResult:
    """Data class for simulation results."""
    portfolio_history: List[Dict[str, Any]]
    final_value: float
    total_invested: float
    total_return_percent: float
    avg_purchase_price: float
    total_assets_accumulated: float
    # Comparison metrics (Smart vs Baseline)
    baseline_final_value: float
    baseline_return_percent: float
    baseline_avg_purchase_price: float
    dca_efficiency: float
    # Fee metrics
    total_fees: float
    fees_percentage: float


class SimulationEngine:
    """Core engine for asset simulations."""

    def __init__(self, asset_id: int, start_date: datetime, end_date: datetime):
        self.asset_id = asset_id
        self.start_date = start_date
        self.end_date = end_date
        self.market_data = self._load_market_data()

    def _load_market_data(self) -> pd.DataFrame:
        """Loads market data from DB into a Pandas DataFrame."""
        db = SessionLocal()
        try:
            query = db.query(MarketData).filter(
                MarketData.asset_id == self.asset_id,
                MarketData.date >= self.start_date - timedelta(days=365), # Load extra data for indicators
                MarketData.date <= self.end_date
            ).order_by(MarketData.date)
            
            data = query.all()
            if not data:
                return pd.DataFrame()
                
            df = pd.DataFrame([
                {
                    "date": d.date,
                    "open": d.open,
                    "high": d.high,
                    "low": d.low,
                    "close": d.close,
                    "adj_close": d.adj_close
                } for d in data
            ])
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            return df
        finally:
            db.close()

    def _calculate_indicators(
        self, 
        indicator_type: str,
        rsi_low: float = 30,
        rsi_high: float = 70,
        ma_short: int = 50,
        ma_long: int = 200
    ) -> pd.DataFrame:
        """Calculates indicators on market data."""
        df = self.market_data.copy()
        
        if indicator_type == "RSI":
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['indicator_value'] = 100 - (100 / (1 + rs))
            # Signal: -1 (oversold/buy more), 0 (neutral), 1 (overbought/buy less)
            df['signal'] = 0
            df.loc[df['indicator_value'] < rsi_low, 'signal'] = -1
            df.loc[df['indicator_value'] > rsi_high, 'signal'] = 1
            
        elif indicator_type == "MA":
            df['ma_short'] = df['close'].rolling(window=ma_short).mean()
            df['ma_long'] = df['close'].rolling(window=ma_long).mean()
            df['indicator_value'] = df['ma_short'] / df['ma_long']
            df['signal'] = 0
            # Signal based on crossover/position
            df.loc[df['ma_short'] < df['ma_long'], 'signal'] = 1  # Bearish -> buy less
            df.loc[df['ma_short'] > df['ma_long'], 'signal'] = -1 # Bullish -> buy more
            
        elif indicator_type == "MACD":
            exp1 = df['close'].ewm(span=12, adjust=False).mean()
            exp2 = df['close'].ewm(span=26, adjust=False).mean()
            df['macd'] = exp1 - exp2
            df['signal_line'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['indicator_value'] = df['macd'] - df['signal_line']
            df['signal'] = 0
            df.loc[df['indicator_value'] < 0, 'signal'] = 1   # Bearish -> buy less
            df.loc[df['indicator_value'] > 0, 'signal'] = -1  # Bullish -> buy more

        # Filter back to original start_date
        return df[df.index >= self.start_date]

    def run_baseline_dca(
        self, 
        base_amount: float, 
        frequency: str, 
        initial_capital: float = 0.0,
        investment_mode: str = "per_contribution",
        commission_percent: float = 0.0,
        minimum_fee_per_trade: float = 0.0,
        maintenance_fee_annual_percent: float = 0.0,
        dynamic_timing_enabled: bool = False,
        timing_aggressiveness: float = 0.5,
        dynamic_sizing_enabled: bool = False,
        sizing_multiplier: float = 2.0,
        smart_indicator: str = "RSI",
        rsi_threshold_low: float = 30.0,
        rsi_threshold_high: float = 70.0,
        ma_period_short: int = 50,
        ma_period_long: int = 200
    ) -> DCAResult:
        """
        Runs a full simulation including baseline and smart DCA.
        """
        if self.market_data.empty:
            raise ValueError("No market data available for the selected period.")

        # Calculate actual investment amount per period
        periodic_amount = base_amount
        if investment_mode == "annual":
            if frequency == "daily":
                periodic_amount = base_amount / 252
            elif frequency == "weekly":
                periodic_amount = base_amount / 52
            elif frequency == "monthly":
                periodic_amount = base_amount / 12

        # 1. Calculate Indicators
        indicator_df = self._calculate_indicators(
            smart_indicator, rsi_threshold_low, rsi_threshold_high, 
            ma_period_short, ma_period_long
        )
        
        # Determine baseline investment dates
        baseline_dates = []
        if frequency == 'daily':
            baseline_dates = indicator_df.index.tolist()
        elif frequency == 'weekly':
            baseline_dates = indicator_df.index[::5].tolist()
        elif frequency == 'monthly':
            baseline_dates = indicator_df.index[::21].tolist()

        daily_maintenance_factor = (maintenance_fee_annual_percent / 100.0) / 252.0 if maintenance_fee_annual_percent > 0 else 0

        # --- SIMULATION STATE ---
        # Baseline
        b_assets = 0.0
        b_invested = 0.0
        b_fees = 0.0
        b_next_idx = 0
        
        # Smart
        s_assets = 0.0
        s_invested = 0.0
        s_fees = 0.0
        s_reserve = 0.0 # Reserve for sizing logic
        s_pending_amount = 0.0 # Amount to buy from timing logic
        s_next_idx = 0
        
        # Initial Capital (applied to both)
        if initial_capital > 0:
            fee = max(initial_capital * (commission_percent / 100.0), minimum_fee_per_trade)
            b_assets += (initial_capital - fee) / indicator_df.iloc[0]['close']
            b_invested += initial_capital
            b_fees += fee
            
            s_assets += (initial_capital - fee) / indicator_df.iloc[0]['close']
            s_invested += initial_capital
            s_fees += fee

        portfolio_history = []
        current_year = indicator_df.index[0].year
        
        # Track annual budget for smart strategy
        # We'll calculate the total baseline investment for the current year
        def get_annual_baseline_total(year):
            year_dates = [d for d in baseline_dates if d.year == year]
            return len(year_dates) * periodic_amount

        annual_budget_remaining = get_annual_baseline_total(current_year)

        for i in range(len(indicator_df)):
            date = indicator_df.index[i]
            row = indicator_df.iloc[i]
            
            b_contribution = 0.0
            s_contribution = 0.0
            
            # --- YEAR TRANSITION ---
            if date.year > current_year:
                # Force invest any remaining budget from the PREVIOUS year if any (should be near 0 if logic is correct)
                if annual_budget_remaining > 0:
                    fee = max(annual_budget_remaining * (commission_percent / 100.0), minimum_fee_per_trade)
                    if annual_budget_remaining > fee:
                        s_assets += (annual_budget_remaining - fee) / indicator_df.iloc[i-1]['close']
                        s_fees += fee
                        s_invested += annual_budget_remaining
                        s_contribution += annual_budget_remaining
                
                current_year = date.year
                annual_budget_remaining = get_annual_baseline_total(current_year)

            # --- MAINTENANCE FEES ---
            if daily_maintenance_factor > 0:
                if b_assets > 0:
                    b_fees += (b_assets * row['close']) * daily_maintenance_factor
                    b_assets *= (1.0 - daily_maintenance_factor)
                if s_assets > 0:
                    s_fees += (s_assets * row['close']) * daily_maintenance_factor
                    s_assets *= (1.0 - daily_maintenance_factor)

            # --- BASELINE BUY LOGIC ---
            if b_next_idx < len(baseline_dates) and date >= baseline_dates[b_next_idx]:
                fee = max(periodic_amount * (commission_percent / 100.0), minimum_fee_per_trade)
                b_assets += (periodic_amount - fee) / row['close']
                b_invested += periodic_amount
                b_fees += fee
                b_next_idx += 1
                b_contribution = periodic_amount

            # --- SMART BUY LOGIC ---
            signal = 0
            if i > 0:
                signal = indicator_df.iloc[i-1]['signal']
            
            should_buy_today = False
            base_buy_amount = 0.0
            
            is_baseline_day = s_next_idx < len(baseline_dates) and date >= baseline_dates[s_next_idx]
            is_last_baseline_day_of_year = False
            if is_baseline_day:
                # Check if this is the last baseline day of the year
                if s_next_idx == len(baseline_dates) - 1 or baseline_dates[s_next_idx + 1].year > current_year:
                    is_last_baseline_day_of_year = True

            if dynamic_timing_enabled:
                days_to_next = 999
                if s_next_idx < len(baseline_dates):
                    next_date = baseline_dates[s_next_idx]
                    days_to_next = (next_date - date).days
                
                if is_baseline_day:
                    if signal == 1 and not is_last_baseline_day_of_year: # Overbought and not last day: wait
                        s_pending_amount += periodic_amount
                        s_next_idx += 1
                    else: # Neutral, Oversold or Last Day: buy now
                        base_buy_amount = periodic_amount + s_pending_amount
                        s_pending_amount = 0
                        s_next_idx += 1
                        should_buy_today = True
                elif days_to_next <= 2 and signal == -1: # Oversold and close to buy day: buy early
                    base_buy_amount = periodic_amount + s_pending_amount
                    s_pending_amount = 0
                    s_next_idx += 1
                    should_buy_today = True
                elif s_pending_amount > 0 and signal == -1: # We were waiting, and now it's oversold
                    base_buy_amount = s_pending_amount
                    s_pending_amount = 0
                    should_buy_today = True
            else:
                if is_baseline_day:
                    base_buy_amount = periodic_amount
                    s_next_idx += 1
                    should_buy_today = True

            # 3. Sizing Logic
            if should_buy_today:
                actual_buy_amount = base_buy_amount
                if dynamic_sizing_enabled:
                    if is_last_baseline_day_of_year:
                        # On the last day, we must spend EXACTLY what's left in the annual budget
                        actual_buy_amount = annual_budget_remaining
                    else:
                        if signal == -1: # Oversold: buy MORE
                            actual_buy_amount = base_buy_amount * sizing_multiplier
                        elif signal == 1: # Overbought: buy LESS
                            actual_buy_amount = base_buy_amount * (1.0 / sizing_multiplier)
                        
                        # Ensure we don't exceed the annual budget
                        # (Leave at least periodic_amount for each remaining baseline day of the year)
                        remaining_days_this_year = 0
                        temp_idx = s_next_idx
                        while temp_idx < len(baseline_dates) and baseline_dates[temp_idx].year == current_year:
                            remaining_days_this_year += 1
                            temp_idx += 1
                        
                        max_allowed = annual_budget_remaining - (remaining_days_this_year * periodic_amount * 0.5) # Allow some flexibility but keep a floor
                        actual_buy_amount = min(actual_buy_amount, max_allowed)
                        actual_buy_amount = max(actual_buy_amount, 0) # Cannot be negative
                
                # Execute trade
                if actual_buy_amount > 0:
                    fee = max(actual_buy_amount * (commission_percent / 100.0), minimum_fee_per_trade)
                    if actual_buy_amount > fee:
                        s_assets += (actual_buy_amount - fee) / row['close']
                        s_invested += actual_buy_amount
                        s_fees += fee
                        annual_budget_remaining -= actual_buy_amount
                        s_contribution += actual_buy_amount
            
            # Record history
            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row['open']), 2),
                "high": round(float(row['high']), 2),
                "low": round(float(row['low']), 2),
                "close": round(float(row['close']), 2),
                "price": round(float(row['close']), 2),
                "invested": round(float(s_invested), 2),
                "baseline_value": round(float(b_assets * row['close']), 2),
                "smart_value": round(float(s_assets * row['close']), 2),
                "cumulative_fees": round(float(s_fees), 2),
                "b_contribution": round(float(b_contribution), 2),
                "s_contribution": round(float(s_contribution), 2)
            })

        # --- FINAL RESULTS ---
        s_final_value = float(s_assets * indicator_df.iloc[-1]['close'])
        b_final_value = float(b_assets * indicator_df.iloc[-1]['close'])
        
        s_return = ((s_final_value - s_invested) / s_invested * 100) if s_invested > 0 else 0.0
        b_return = ((b_final_value - b_invested) / b_invested * 100) if b_invested > 0 else 0.0
        
        s_avg_price = (s_invested / s_assets) if s_assets > 0 else 0.0
        b_avg_price = (b_invested / b_assets) if b_assets > 0 else 0.0
        
        first_price = float(indicator_df.iloc[0]['close'])
        dca_efficiency = ((first_price - s_avg_price) / first_price * 100) if first_price > 0 else 0.0

        return DCAResult(
            portfolio_history=portfolio_history,
            final_value=round(s_final_value, 2),
            total_invested=round(float(s_invested), 2),
            total_return_percent=round(float(s_return), 2),
            avg_purchase_price=round(float(s_avg_price), 2),
            total_assets_accumulated=float(s_assets),
            baseline_final_value=round(b_final_value, 2),
            baseline_return_percent=round(float(b_return), 2),
            baseline_avg_purchase_price=round(float(b_avg_price), 2),
            dca_efficiency=round(float(dca_efficiency), 2),
            total_fees=round(float(s_fees), 2),
            fees_percentage=round(float((s_fees / s_invested) * 100), 2) if s_invested > 0 else 0.0
        )
