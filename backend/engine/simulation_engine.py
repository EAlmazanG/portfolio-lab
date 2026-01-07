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
                MarketData.date >= self.start_date,
                MarketData.date <= self.end_date
            ).order_by(MarketData.date)
            
            data = query.all()
            if not data:
                return pd.DataFrame()
                
            df = pd.DataFrame([
                {
                    "date": d.date,
                    "close": d.close,
                    "adj_close": d.adj_close
                } for d in data
            ])
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            return df
        finally:
            db.close()

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
        timing_aggressiveness: float = 0.0,
        dynamic_sizing_enabled: bool = False,
        sizing_multiplier: float = 1.0
    ) -> DCAResult:
        """
        Runs a full simulation including baseline and smart DCA.
        
        Args:
            base_amount: Amount to invest (either annual total or per contribution).
            frequency: 'daily', 'weekly', or 'monthly'.
            initial_capital: Initial one-time investment at start_date.
            investment_mode: 'annual' or 'per_contribution'.
            commission_percent: Fee percentage per transaction.
            minimum_fee_per_trade: Minimum absolute fee per transaction.
            maintenance_fee_annual_percent: Annual fee on total invested.
            dynamic_timing_enabled: Placeholder for smart timing.
            timing_aggressiveness: Placeholder for smart timing.
            dynamic_sizing_enabled: Placeholder for smart sizing.
            sizing_multiplier: Placeholder for smart sizing.
        """
        if self.market_data.empty:
            raise ValueError("No market data available for the selected period.")

        # Calculate actual investment amount per period
        periodic_amount = base_amount
        if investment_mode == "annual":
            if frequency == "daily":
                periodic_amount = base_amount / 252 # Approximation of trading days
            elif frequency == "weekly":
                periodic_amount = base_amount / 52
            elif frequency == "monthly":
                periodic_amount = base_amount / 12

        # Determine investment dates based on frequency
        investment_dates = []
        if frequency == 'daily':
            investment_dates = self.market_data.index.tolist()
        elif frequency == 'weekly':
            investment_dates = self.market_data.index[::5].tolist()
        elif frequency == 'monthly':
            investment_dates = self.market_data.index[::21].tolist()
        else:
            raise ValueError(f"Unsupported frequency: {frequency}")

        total_invested = 0.0
        assets_accumulated = 0.0
        portfolio_history = []
        
        # Maintenance fee logic: annual percent divided by trading days (~252)
        daily_maintenance_factor = (maintenance_fee_annual_percent / 100.0) / 252.0 if maintenance_fee_annual_percent > 0 else 0
        
        # Apply Initial Capital
        if initial_capital > 0:
            first_row = self.market_data.iloc[0]
            fee = max(initial_capital * (commission_percent / 100.0), minimum_fee_per_trade)
            net_initial = initial_capital - fee
            assets_accumulated += net_initial / first_row['close']
            total_invested += initial_capital

        current_investment_idx = 0
        
        for date, row in self.market_data.iterrows():
            # Apply maintenance fee if enabled (deduct from assets)
            if daily_maintenance_factor > 0 and assets_accumulated > 0:
                # Deducting from assets accumulated (like an expense ratio)
                assets_accumulated *= (1.0 - daily_maintenance_factor)

            # Check if today is an investment day
            if current_investment_idx < len(investment_dates) and date >= investment_dates[current_investment_idx]:
                # Calculate fee
                fee = max(periodic_amount * (commission_percent / 100.0), minimum_fee_per_trade)
                net_investment = periodic_amount - fee
                
                if net_investment > 0:
                    price = row['close']
                    assets_bought = net_investment / price
                    
                    assets_accumulated += assets_bought
                    total_invested += periodic_amount
                
                current_investment_idx += 1
            
            # Record current status
            current_value = assets_accumulated * row['close']
            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "price": round(float(row['close']), 2),
                "invested": round(float(total_invested), 2),
                "baseline_value": round(float(current_value), 2),
                "smart_value": round(float(current_value), 2)  # Currently same as baseline
            })

        final_value = float(assets_accumulated * self.market_data.iloc[-1]['close'])
        total_return_percent = float(((final_value - total_invested) / total_invested * 100)) if total_invested > 0 else 0.0
        avg_price = float(total_invested / assets_accumulated) if assets_accumulated > 0 else 0.0

        return DCAResult(
            portfolio_history=portfolio_history,
            final_value=round(final_value, 2),
            total_invested=round(float(total_invested), 2),
            total_return_percent=round(total_return_percent, 2),
            avg_purchase_price=round(avg_price, 2),
            total_assets_accumulated=float(assets_accumulated),
            baseline_final_value=round(final_value, 2),
            baseline_return_percent=round(total_return_percent, 2)
        )
