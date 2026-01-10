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
                # If specific amounts are defined, use them
                asset_initial_capital = float(pa.current_amount)
            elif self.portfolio.initial_capital and self.portfolio.initial_capital > 0:
                # If only total capital is defined, distribute by target weight
                asset_initial_capital = float(self.portfolio.initial_capital * asset_weight)
            
            # The periodic amount for this asset is its weight * total base_amount
            asset_base_amount = config.base_amount * asset_weight
            
            engine = self.asset_engines[asset_id]
            
            # Run the single asset simulation
            result = engine.run_baseline_dca(
                base_amount=asset_base_amount,
                frequency=config.frequency,
                initial_capital=asset_initial_capital,
                investment_mode=config.investment_mode,
                commission_percent=asset_config.commission_fee_percent,
                minimum_fee_per_trade=asset_config.minimum_fee_per_trade,
                maintenance_fee_annual_percent=0, # TBD
                dynamic_timing_enabled=asset_config.dynamic_timing_enabled,
                timing_aggressiveness=asset_config.timing_aggressiveness,
                dynamic_sizing_enabled=asset_config.dynamic_sizing_enabled,
                sizing_multiplier=asset_config.sizing_multiplier,
                smart_indicator=asset_config.smart_indicator,
                rsi_threshold_low=asset_config.rsi_threshold_low,
                rsi_threshold_high=asset_config.rsi_threshold_high,
                ma_period_short=asset_config.ma_period_short,
                ma_period_long=asset_config.ma_period_long,
                expensive_buy_ratio=asset_config.expensive_buy_ratio
            )
            asset_results[asset_id] = {
                "ticker": pa.asset.ticker,
                "weight": asset_weight,
                "result": result
            }

        # 2. Aggregate results
        portfolio_history = self._aggregate_history(asset_results)
        
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
                "portfolio_history": res.portfolio_history # This includes the asset-specific price history
            })

        return {
            "final_value": round(final_value, 2),
            "total_invested": round(total_invested, 2),
            "total_return_percent": round(total_return_percent, 2),
            "baseline_final_value": round(baseline_final_value, 2),
            "baseline_return_percent": round(baseline_return_percent, 2),
            "total_fees": round(total_fees, 2),
            "fees_percentage": round((total_fees / total_invested * 100), 2) if total_invested > 0 else 0,
            "portfolio_history": portfolio_history,
            "asset_results": formatted_asset_results,
            "dca_efficiency": 0.0, # TBD for portfolio
            "avg_purchase_price": 0.0, # Not applicable to portfolio
            "total_assets_accumulated": 0.0 # Not applicable to portfolio
        }

    def _aggregate_history(self, asset_results: Dict[int, Any]) -> List[Dict[str, Any]]:
        """Combines individual asset histories into a single portfolio history."""
        # Get all unique dates from all asset results
        all_dates = set()
        for data in asset_results.values():
            for point in data["result"].portfolio_history:
                all_dates.add(point["date"])
        
        sorted_dates = sorted(list(all_dates))
        
        # Build aggregated history
        agg_history = []
        for date_str in sorted_dates:
            point = {
                "date": date_str,
                "invested": 0.0,
                "baseline_value": 0.0,
                "smart_value": 0.0,
                "cumulative_fees": 0.0,
                "b_contribution": 0.0,
                "s_contribution": 0.0,
                "price": 0.0 # Will use a base 100 index for portfolio price
            }
            
            # We'll calculate a portfolio "price" as a weighted index of normalized asset prices
            # starting at 100
            weighted_normalized_price = 0.0
            
            for asset_id, data in asset_results.items():
                asset_history = data["result"].portfolio_history
                # Find matching date in asset history
                asset_point = next((p for p in asset_history if p["date"] == date_str), None)
                
                if asset_point:
                    point["invested"] += asset_point["invested"]
                    point["baseline_value"] += asset_point["baseline_value"]
                    point["smart_value"] += asset_point["smart_value"]
                    point["cumulative_fees"] += asset_point["cumulative_fees"]
                    point["b_contribution"] += asset_point["b_contribution"]
                    point["s_contribution"] += asset_point["s_contribution"]
                    
                    # Normalized price (base 100)
                    first_price = asset_history[0]["price"]
                    normalized_price = (asset_point["price"] / first_price * 100) if first_price > 0 else 0
                    weighted_normalized_price += normalized_price * data["weight"]

            point["price"] = round(weighted_normalized_price, 2)
            # Round other values
            point["invested"] = round(point["invested"], 2)
            point["baseline_value"] = round(point["baseline_value"], 2)
            point["smart_value"] = round(point["smart_value"], 2)
            point["cumulative_fees"] = round(point["cumulative_fees"], 2)
            point["b_contribution"] = round(point["b_contribution"], 2)
            point["s_contribution"] = round(point["s_contribution"], 2)
            
            agg_history.append(point)
            
        return agg_history

    def __del__(self):
        self.db.close()
