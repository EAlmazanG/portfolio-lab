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
    """Data class for DCA simulation results."""
    portfolio_history: List[Dict[str, Any]]
    final_value: float
    total_invested: float
    total_return_percent: float
    avg_purchase_price: float
    total_assets_accumulated: float


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
        commission_percent: float = 0.0
    ) -> DCAResult:
        """
        Runs a standard DCA simulation.
        
        Args:
            base_amount: Amount to invest each period.
            frequency: 'daily', 'weekly', or 'monthly'.
            commission_percent: Fee per transaction.
        """
        if self.market_data.empty:
            raise ValueError("No market data available for the selected period.")

        # Determine investment dates based on frequency
        # For simplicity, we use business days from the market data
        investment_dates = []
        if frequency == 'daily':
            investment_dates = self.market_data.index.tolist()
        elif frequency == 'weekly':
            # Every 5 business days as an approximation of weekly
            investment_dates = self.market_data.index[::5].tolist()
        elif frequency == 'monthly':
            # Approximately every 21 business days
            investment_dates = self.market_data.index[::21].tolist()
        else:
            raise ValueError(f"Unsupported frequency: {frequency}")

        total_invested = 0.0
        assets_accumulated = 0.0
        portfolio_history = []
        
        # We track the portfolio value on every day, not just investment days
        # But for the history we return, we can just track it on investment days or daily
        # Let's do daily tracking for a smooth chart
        
        current_investment_idx = 0
        
        for date, row in self.market_data.iterrows():
            # Check if today is an investment day
            if current_investment_idx < len(investment_dates) and date >= investment_dates[current_investment_idx]:
                # Invest!
                fee = base_amount * (commission_percent / 100.0)
                net_investment = base_amount - fee
                
                price = row['close']
                assets_bought = net_investment / price
                
                assets_accumulated += assets_bought
                total_invested += base_amount
                
                current_investment_idx += 1
            
            # Record current value
            current_value = assets_accumulated * row['close']
            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": round(current_value, 2),
                "invested": round(total_invested, 2)
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
            total_assets_accumulated=float(assets_accumulated)
        )
