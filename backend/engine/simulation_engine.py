"""Engine for running asset simulations."""

import pandas as pd
import numpy as np
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
    # Risk metrics
    volatility: float = 0.0
    max_drawdown: float = 0.0


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
            # Wilder's smoothing method
            gain = (delta.where(delta > 0, 0))
            loss = (-delta.where(delta < 0, 0))
            
            # Using EWM for standard RSI calculation
            avg_gain = gain.ewm(com=13, adjust=False).mean()
            avg_loss = loss.ewm(com=13, adjust=False).mean()
            
            # Use a safe division to avoid inf/nan issues
            rs = avg_gain / avg_loss.replace(0, np.nan)
            df['indicator_value'] = 100 - (100 / (1 + rs.fillna(np.inf)))
            # Final fallback for any remaining NaNs
            df['indicator_value'] = df['indicator_value'].fillna(50.0)
            
            # Signal: -1 (oversold/buy more), 0 (neutral), 1 (overbought/buy less)
            df['signal'] = 0
            df.loc[df['indicator_value'] < rsi_low, 'signal'] = -1
            df.loc[df['indicator_value'] > rsi_high, 'signal'] = 1
            
        elif indicator_type == "MA":
            df['ma_short_val'] = df['close'].rolling(window=ma_short).mean()
            df['ma_long_val'] = df['close'].rolling(window=ma_long).mean()
            df['indicator_value'] = df['ma_short_val'] / df['ma_long_val']
            df['signal'] = 0
            # Signal based on crossover/position
            df.loc[df['ma_short_val'] < df['ma_long_val'], 'signal'] = 1  # Bearish -> buy less
            df.loc[df['ma_short_val'] > df['ma_long_val'], 'signal'] = -1 # Bullish -> buy more
            
        elif indicator_type == "EMA":
            df['ma_short_val'] = df['close'].ewm(span=ma_short, adjust=False).mean()
            df['ma_long_val'] = df['close'].ewm(span=ma_long, adjust=False).mean()
            df['indicator_value'] = df['ma_short_val'] / df['ma_long_val']
            df['signal'] = 0
            # Signal based on crossover/position
            df.loc[df['ma_short_val'] < df['ma_long_val'], 'signal'] = 1  # Bearish -> buy less
            df.loc[df['ma_short_val'] > df['ma_long_val'], 'signal'] = -1 # Bullish -> buy more

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
        ma_period_long: int = 200,
        expensive_buy_ratio: float = 0.0
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
            elif frequency == "bi-monthly":
                periodic_amount = base_amount / 24

        # 1. Calculate Indicators
        indicator_df = self._calculate_indicators(
            smart_indicator, rsi_threshold_low, rsi_threshold_high, 
            ma_period_short, ma_period_long
        )
        
        if indicator_df.empty:
            raise ValueError("No market data available for the selected start date.")
        
        # Determine baseline investment dates
        baseline_dates = []
        if frequency == 'daily':
            baseline_dates = indicator_df.index.tolist()
        else:
            # Calendar-based grouping for consistency
            grouped = indicator_df.groupby([indicator_df.index.year, indicator_df.index.month])
            for _, group in grouped:
                if frequency == 'weekly':
                    # First trading day of each week in the month
                    weeks = group.index.to_series().dt.isocalendar().week.unique()
                    for week in weeks:
                        baseline_dates.append(group[group.index.to_series().dt.isocalendar().week == week].index[0])
                elif frequency == 'bi-monthly':
                    # First trading day of month
                    baseline_dates.append(group.index[0])
                    # First trading day on or after the 15th
                    middle_days = group[group.index.day >= 15]
                    if not middle_days.empty:
                        baseline_dates.append(middle_days.index[0])
                elif frequency == 'monthly':
                    # First trading day of month
                    baseline_dates.append(group.index[0])

        # Remove potential duplicates and sort
        baseline_dates = sorted(list(set(baseline_dates)))

        daily_maintenance_factor = (maintenance_fee_annual_percent / 100.0) / 252.0 if maintenance_fee_annual_percent > 0 else 0

        # Update periodic_amount based on actual number of contributions per year to ensure total invested matches exactly
        # This is critical for the user's comparison requirement
        if investment_mode == "annual":
            # Count contributions in the first full year or average them
            first_year = indicator_df.index[0].year
            year_count = len([d for d in baseline_dates if d.year == first_year])
            if year_count > 0:
                periodic_amount = base_amount / year_count

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
        if initial_capital > 0 and not indicator_df.empty:
            fee = max(initial_capital * (commission_percent / 100.0), minimum_fee_per_trade)
            b_assets += (initial_capital - fee) / indicator_df.iloc[0]['close']
            b_invested += initial_capital
            b_fees += fee
            
            s_assets += (initial_capital - fee) / indicator_df.iloc[0]['close']
            s_invested += initial_capital
            s_fees += fee

        # Record history
        portfolio_history = []
        
        # Add Initial Investment Point at start_date if it's before the first market data point
        # This prevents the chart from starting at 0 and showing a "spike"
        if not indicator_df.empty:
            first_market_date = indicator_df.index[0]
            # Use the actual first market price for the initial state
            valid_prices = indicator_df[indicator_df['close'] > 0]['close']
            initial_price_real = float(valid_prices.iloc[0]) if not valid_prices.empty else float(indicator_df.iloc[0]['close'])
            
            # CRITICAL: If start_date is before first_market_date, we need to show the value
            # at that start_date. The price should be the first available price.
            if self.start_date < first_market_date:
                initial_val = float(s_assets * initial_price_real)
                
                # Check if we already have an entry for this date to avoid duplicates
                date_str = self.start_date.strftime("%Y-%m-%d")
                if not portfolio_history or portfolio_history[0]["date"] != date_str:
                    portfolio_history.append({
                        "date": date_str,
                        "open": round(initial_price_real, 2),
                        "high": round(initial_price_real, 2),
                        "low": round(initial_price_real, 2),
                        "close": round(initial_price_real, 2),
                        "price": round(initial_price_real, 2),
                        "indicator_value": None,
                        "ma_short": None,
                        "ma_long": None,
                        "invested": round(float(s_invested), 2),
                        "baseline_value": round(initial_val, 2),
                        "smart_value": round(initial_val, 2),
                        "cumulative_fees": round(float(s_fees), 2),
                        "b_contribution": 0.0,
                        "s_contribution": 0.0
                    })
                else:
                    # If we already have the first day, ensure it doesn't have 0 values
                    if portfolio_history[0]["price"] <= 0:
                        portfolio_history[0]["open"] = round(initial_price_real, 2)
                        portfolio_history[0]["high"] = round(initial_price_real, 2)
                        portfolio_history[0]["low"] = round(initial_price_real, 2)
                        portfolio_history[0]["price"] = round(initial_price_real, 2)
                        portfolio_history[0]["close"] = round(initial_price_real, 2)
                        portfolio_history[0]["baseline_value"] = round(initial_val, 2)
                        portfolio_history[0]["smart_value"] = round(initial_val, 2)
            
            # Ensure the VERY FIRST day of market data doesn't have a 0 price in history
            # if it's being added in the loop later.
            # We will handle this inside the loop by ensuring p_close is never 0.

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
            signal = int(row['signal'])
            
            should_buy_today = False
            base_buy_amount = 0.0
            
            is_baseline_day = s_next_idx < len(baseline_dates) and date >= baseline_dates[s_next_idx]
            is_last_baseline_day_of_year = False
            if is_baseline_day:
                # Check if this is the last baseline day of the year:
                # 1. It's the very last baseline day overall, OR
                # 2. The NEXT baseline day is in a DIFFERENT year
                if s_next_idx == len(baseline_dates) - 1 or baseline_dates[s_next_idx + 1].year != current_year:
                    is_last_baseline_day_of_year = True

            if is_baseline_day:
                # print(f"DEBUG_SMART: date={date}, signal={signal}, timing={dynamic_timing_enabled}, sizing={dynamic_sizing_enabled}")
                pass
            
            # --- ACTUAL SMART LOGIC ---
            if dynamic_timing_enabled or dynamic_sizing_enabled:
                if dynamic_timing_enabled:
                    days_to_next = 999
                    if s_next_idx < len(baseline_dates):
                        next_date = baseline_dates[s_next_idx]
                        days_to_next = (next_date - date).days
                    
                    if is_baseline_day:
                        if signal == 1 and not is_last_baseline_day_of_year: # Overbought and not last day: wait (but respect floor)
                            buy_floor = periodic_amount * expensive_buy_ratio
                            base_buy_amount = buy_floor
                            s_pending_amount += (periodic_amount - buy_floor)
                            s_next_idx += 1
                            should_buy_today = buy_floor > 0
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
                    # Sizing only
                    if is_baseline_day:
                        base_buy_amount = periodic_amount
                        s_next_idx += 1
                        should_buy_today = True
            else:
                # Baseline only
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
                        elif signal == 1: # Overbought: buy LESS (exactly the floor)
                            actual_buy_amount = base_buy_amount * expensive_buy_ratio
                        
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
            
            # Helper to handle NaNs for JSON serialization
            def clean_val(val, default=None):
                try:
                    import math
                    if val is None or math.isnan(val) or math.isinf(val):
                        return default
                    return float(val)
                except:
                    return default

            # Record history
            ma_short_val = clean_val(row.get('ma_short_val'))
            ma_long_val = clean_val(row.get('ma_long_val'))
            indicator_val = clean_val(row.get('indicator_value'))
            
            # Conditionally show indicators only if smart features are active
            show_indicators = dynamic_timing_enabled or dynamic_sizing_enabled
            if not show_indicators:
                indicator_val = None
                ma_short_val = None
                ma_long_val = None
            
            p_close = round(clean_val(row['close'], 0.0), 2)
            # Safeguard: if price is 0, use previous price or the first available price
            if p_close <= 0:
                if len(portfolio_history) > 0:
                    p_close = portfolio_history[-1]["close"]
                else:
                    # If it's the very first row and it's 0, look ahead for the first non-zero price
                    valid_prices = indicator_df[indicator_df['close'] > 0]['close']
                    if not valid_prices.empty:
                        p_close = round(float(valid_prices.iloc[0]), 2)
                    else:
                        p_close = 0.01 # Absolute fallback
            
            # Additional check: if it's the first actual market day, we might need to 
            # fix the very first entry if it was added as a start_date dummy with 0s
            if i == 0 and len(portfolio_history) > 0 and portfolio_history[0]["price"] <= 0:
                portfolio_history[0]["price"] = p_close
                portfolio_history[0]["close"] = p_close
                portfolio_history[0]["open"] = p_close
                portfolio_history[0]["high"] = p_close
                portfolio_history[0]["low"] = p_close
                portfolio_history[0]["baseline_value"] = round(float(b_assets * p_close), 2)
                portfolio_history[0]["smart_value"] = round(float(s_assets * p_close), 2)

            # For MA/EMA, a value of 0.0 is typically an error or "no data" 
            # at the beginning of a simulation for assets with non-zero price.
            if (smart_indicator == "MA" or smart_indicator == "EMA"):
                if ma_short_val == 0.0: ma_short_val = None
                if ma_long_val == 0.0: ma_long_val = None
                if indicator_val == 0.0: indicator_val = None

            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(clean_val(row['open'], 0.0), 2),
                "high": round(clean_val(row['high'], 0.0), 2),
                "low": round(clean_val(row['low'], 0.0), 2),
                "close": p_close,
                "price": p_close,
                "indicator_value": round(indicator_val, 4) if indicator_val is not None else None,
                "ma_short": round(ma_short_val, 2) if ma_short_val is not None else None,
                "ma_long": round(ma_long_val, 2) if ma_long_val is not None else None,
                "invested": round(float(s_invested), 2),
                "baseline_value": round(float(b_assets * p_close), 2),
                "smart_value": round(float(s_assets * p_close), 2),
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

        # Calculate advanced metrics (Volatility, Max Drawdown)
        smart_values = [p["smart_value"] for p in portfolio_history]
        
        # Volatility (Standard Deviation of Periodic Returns)
        volatility = 0.0
        if len(smart_values) > 1:
            returns = []
            for i in range(1, len(smart_values)):
                if smart_values[i-1] > 0:
                    returns.append((smart_values[i] - smart_values[i-1]) / smart_values[i-1])
            if returns:
                volatility = float(np.std(returns) * 100) # Percentage

        # Max Drawdown
        max_drawdown = 0.0
        if smart_values:
            peak = smart_values[0]
            drawdowns = []
            for val in smart_values:
                if val > peak:
                    peak = val
                if peak > 0:
                    drawdown = (val - peak) / peak
                    drawdowns.append(drawdown)
            if drawdowns:
                max_drawdown = float(min(drawdowns) * 100) # Negative percentage

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
            fees_percentage=round(float((s_fees / s_invested) * 100), 2) if s_invested > 0 else 0.0,
            volatility=round(volatility, 2),
            max_drawdown=round(max_drawdown, 2)
        )
