"""Engine for running multi-asset portfolio simulations."""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json

from backend.db.session import SessionLocal
from backend.models.asset import Asset
from backend.models.market_data import MarketData
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.engine.simulation_engine import SimulationEngine, DCAResult
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig

class PortfolioSimulationEngine:
    """Engine for simulating multi-asset portfolios."""

    def __init__(self, portfolio_id: int, start_date: datetime, end_date: datetime):
        self.portfolio_id = portfolio_id
        self.start_date = start_date
        self.end_date = end_date
        self.db = SessionLocal()
        self.portfolio = self._load_portfolio()
        self.asset_engines = self._init_asset_engines()

    def _load_portfolio(self) -> Portfolio:
        """Loads the portfolio and its assets."""
        from sqlalchemy.orm import selectinload
        portfolio = self.db.query(Portfolio).options(
            selectinload(Portfolio.assets).selectinload(PortfolioAsset.asset)
        ).filter(Portfolio.id == self.portfolio_id).first()
        if not portfolio:
            raise ValueError(f"Portfolio with ID {self.portfolio_id} not found.")
        return portfolio

    def _init_asset_engines(self) -> Dict[int, SimulationEngine]:
        """Initializes a SimulationEngine for each asset in the portfolio."""
        engines = {}
        for pa in self.portfolio.assets:
            engines[pa.asset_id] = SimulationEngine(
                asset_id=pa.asset_id,
                start_date=self.start_date,
                end_date=self.end_date
            )
        return engines

    def run_simulation(self, config: PortfolioSimulationCreate) -> Dict[str, Any]:
        """
        Runs a multi-asset simulation by delegating to individual asset engines.
        """
        asset_results = {}
        
        # 1. Run individual simulations for each asset
        for pa in self.portfolio.assets:
            asset_id = pa.asset_id
            asset_weight = pa.weight
            
            # Use specific config if provided, else default to neutral (baseline)
            asset_config = config.asset_configs.get(asset_id, AssetSimulationConfig())
            
            # Use initial capital logic
            asset_initial_capital = 0.0
            if pa.current_amount and pa.current_amount > 0:
                asset_initial_capital = float(pa.current_amount)
            elif self.portfolio.initial_capital and self.portfolio.initial_capital > 0:
                asset_initial_capital = float(self.portfolio.initial_capital) * float(asset_weight)
            
            # The periodic amount for this asset is its weight * total base_amount
            asset_base_amount = config.base_amount * asset_weight
            
            engine = self.asset_engines[asset_id]
            
            # Run the single asset simulation
            try:
                result = engine.run_baseline_dca(
                    base_amount=float(asset_base_amount),
                    frequency=config.frequency,
                    initial_capital=float(asset_initial_capital),
                    investment_mode=config.investment_mode,
                    commission_percent=float(config.commission_fee_percent),
                    minimum_fee_per_trade=float(config.minimum_fee_per_trade),
                    maintenance_fee_annual_percent=float(config.maintenance_fee_annual_percent),
                    dynamic_timing_enabled=bool(asset_config.dynamic_timing_enabled),
                    timing_aggressiveness=float(asset_config.timing_aggressiveness),
                    dynamic_sizing_enabled=bool(asset_config.dynamic_sizing_enabled),
                    sizing_multiplier=float(asset_config.sizing_multiplier),
                    smart_indicator=asset_config.smart_indicator,
                    rsi_threshold_low=float(asset_config.rsi_threshold_low),
                    rsi_threshold_high=float(asset_config.rsi_threshold_high),
                    ma_period_short=int(asset_config.ma_period_short),
                    ma_period_long=int(asset_config.ma_period_long),
                    expensive_buy_ratio=float(asset_config.expensive_buy_ratio)
                )
            except Exception as e:
                print(f"Error in single asset simulation for {pa.asset.ticker}: {e}")
                raise e
            asset_results[asset_id] = {
                "ticker": pa.asset.ticker,
                "weight": asset_weight,
                "result": result
            }

        # 2. Aggregate results
        portfolio_history = self._aggregate_history(asset_results)
        
        # 3. Calculate advanced metrics (Volatility, Max Drawdown)
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

        # 4. Weekly aggregation for smoother charts
        clean_history = self._aggregate_history_weekly(portfolio_history)

        # Calculate totals
        total_invested = sum(res["result"].total_invested for res in asset_results.values())
        final_value = sum(res["result"].final_value for res in asset_results.values())
        total_fees = sum(res["result"].total_fees for res in asset_results.values())
        
        baseline_final_value = sum(res["result"].baseline_final_value for res in asset_results.values())
        
        total_return_percent = ((final_value - total_invested) / total_invested * 100) if total_invested > 0 else 0
        baseline_return_percent = ((baseline_final_value - total_invested) / total_invested * 100) if total_invested > 0 else 0
        
        # Format for response
        formatted_asset_results = []
        for asset_id, data in asset_results.items():
            res = data["result"]
            formatted_asset_results.append({
                "asset_id": asset_id,
                "ticker": data["ticker"],
                "final_value": res.final_value,
                "total_invested": res.total_invested,
                "total_return_percent": res.total_return_percent,
                "assets_accumulated": res.total_assets_accumulated,
                "avg_price": res.avg_purchase_price,
                "portfolio_history": res.portfolio_history
            })

        return {
            "final_value": round(final_value, 2),
            "total_invested": round(total_invested, 2),
            "total_return_percent": round(total_return_percent, 2),
            "baseline_final_value": round(baseline_final_value, 2),
            "baseline_return_percent": round(baseline_return_percent, 2),
            "total_fees": round(total_fees, 2),
            "fees_percentage": round((total_fees / total_invested * 100), 2) if total_invested > 0 else 0,
            "volatility": round(volatility, 2),
            "max_drawdown": round(max_drawdown, 2),
            "portfolio_history": clean_history,
            "asset_results": formatted_asset_results,
            "dca_efficiency": 0.0,
            "avg_purchase_price": 0.0,
            "total_assets_accumulated": 0.0
        }

    def _aggregate_history_weekly(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Aggregates daily history into weekly points for cleaner visualization."""
        if not history:
            return []
        
        df = pd.DataFrame(history)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
        # Resample logic:
        # 1. For stateful/cumulative values, take the last value of the week
        cumulative_cols = ["invested", "baseline_value", "smart_value", "cumulative_fees", "price"]
        weekly_cumulative = df[cumulative_cols].resample('W').last().ffill()
        
        # 2. For discrete events (contributions), sum them up for the week
        contribution_cols = ["b_contribution", "s_contribution"]
        weekly_contributions = df[contribution_cols].resample('W').sum()
        
        # Combine them
        weekly = pd.concat([weekly_cumulative, weekly_contributions], axis=1)
        
        # Convert back to list of dicts
        weekly_history = []
        for date, row in weekly.iterrows():
            point = row.to_dict()
            point['date'] = date.strftime("%Y-%m-%d")
            # Round values
            for col in cumulative_cols + contribution_cols:
                point[col] = round(float(point[col]), 2)
            weekly_history.append(point)
            
        return weekly_history

    def _aggregate_history(self, asset_results: Dict[int, Any]) -> List[Dict[str, Any]]:
        """Combines individual asset histories into a single portfolio history."""
        if not asset_results:
            return []

        # Convert each asset history to a DataFrame
        asset_dfs = []
        for asset_id, data in asset_results.items():
            df = pd.DataFrame(data["result"].portfolio_history)
            if df.empty:
                continue
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            
            # For each asset, we want to normalize its price contribution (base 100)
            first_price = df['price'].iloc[0] if not df.empty and 'price' in df.columns else 1.0
            df['normalized_price'] = (df['price'] / first_price * 100) if first_price > 0 else 0
            df['weighted_price'] = df['normalized_price'] * data["weight"]
            
            asset_dfs.append(df)

        if not asset_dfs:
            return []

        # Get all unique dates
        all_dates = pd.concat([df.index.to_series() for df in asset_dfs]).unique()
        all_dates = np.sort(all_dates)
        
        # Create a combined dataframe with all dates
        combined_df = pd.DataFrame(index=all_dates)
        combined_df.index.name = 'date'

        # Initialize aggregate columns
        cols_to_sum = ["invested", "baseline_value", "smart_value", "cumulative_fees", "b_contribution", "s_contribution", "weighted_price"]
        for col in cols_to_sum:
            combined_df[col] = 0.0

        for df in asset_dfs:
            # Reindex each asset's DF to match all dates, filling missing values with the last known value
            # Note: b_contribution and s_contribution should be 0 if the date is missing (as they are discrete events)
            # but invested, baseline_value, smart_value and cumulative_fees are cumulative/stateful.
            
            reindexed = df.reindex(all_dates)
            
            # Cumulative values use ffill
            for col in ["invested", "baseline_value", "smart_value", "cumulative_fees", "weighted_price"]:
                if col in reindexed.columns:
                    # Logic: ffill() propagates the last known value for gaps.
                    # fillna(0.0) handles the period before the asset was added/simulated.
                    combined_df[col] += reindexed[col].ffill().fillna(0.0)
            
            # Contribution values use fillna(0) because they are non-cumulative daily events
            for col in ["b_contribution", "s_contribution"]:
                if col in reindexed.columns:
                    combined_df[col] += reindexed[col].fillna(0.0)

        # Rename weighted_price to price for consistency
        combined_df.rename(columns={"weighted_price": "price"}, inplace=True)

        # Convert back to list of dicts
        agg_history = []
        for date, row in combined_df.iterrows():
            point = row.to_dict()
            point['date'] = date.strftime("%Y-%m-%d")
            # Round values
            for col in ["invested", "baseline_value", "smart_value", "cumulative_fees", "b_contribution", "s_contribution", "price"]:
                point[col] = round(float(point[col]), 2)
            agg_history.append(point)
            
        return agg_history

    def __del__(self):
        self.db.close()
