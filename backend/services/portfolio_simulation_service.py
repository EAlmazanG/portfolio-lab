"""Service for managing portfolio simulations."""

import json
import numpy as np
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from backend.db.session import SessionLocal
from backend.models.simulation import Simulation, SimulationResult
from backend.models.portfolio import Portfolio
from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine
from backend.schemas.portfolio_simulation import (
    PortfolioSimulationCreate, 
    PortfolioSimulationResponse, 
    PortfolioSimulationResultSchema,
    AssetSimulationResult,
    AssetSimulationConfig
)

class PortfolioSimulationService:
    """Service to handle portfolio simulation logic and persistence."""

    @staticmethod
    def run_simulation(data: PortfolioSimulationCreate, save: bool = True) -> PortfolioSimulationResponse:
        """
        Runs a portfolio simulation and optionally saves it.
        """
        engine = PortfolioSimulationEngine(
            portfolio_id=data.portfolio_id,
            start_date=data.start_date,
            end_date=data.end_date
        )
        
        result = engine.run_simulation(data)
        
        # Construct result schema
        asset_results = [AssetSimulationResult(**res) for res in result["asset_results"]]
        
        result_schema = PortfolioSimulationResultSchema(
            final_value=result["final_value"],
            total_invested=result["total_invested"],
            total_return_percent=result["total_return_percent"],
            baseline_final_value=result["baseline_final_value"],
            baseline_return_percent=result["baseline_return_percent"],
            total_fees=result["total_fees"],
            fees_percentage=result["fees_percentage"],
            volatility=result.get("volatility", 0.0),
            max_drawdown=result.get("max_drawdown", 0.0),
            portfolio_history=result["portfolio_history"],
            asset_results=asset_results,
            # Fill mandatory single-asset fields with defaults or dummy values for compatibility
            avg_purchase_price=0.0,
            total_assets_accumulated=0.0,
            baseline_avg_purchase_price=0.0,
            dca_efficiency=0.0
        )
        
        simulation_id = None
        
        if save:
            db = SessionLocal()
            try:
                # Store asset configs as JSON
                asset_configs_json = {str(k): v.model_dump() for k, v in data.asset_configs.items()}
                
                # Create Simulation record
                sim = Simulation(
                    name=data.name,
                    portfolio_id=data.portfolio_id,
                    start_date=data.start_date,
                    end_date=data.end_date,
                    base_amount=data.base_amount,
                    frequency=data.frequency,
                    investment_mode=data.investment_mode,
                    commission_fee_percent=data.commission_fee_percent,
                    minimum_fee_per_trade=data.minimum_fee_per_trade,
                    maintenance_fee_annual_percent=data.maintenance_fee_annual_percent,
                    rebalancing_enabled=data.rebalancing_enabled,
                    periodic_rebalancing_interval=data.periodic_rebalancing_interval,
                    asset_configs=json.dumps(asset_configs_json),
                    is_favorite=data.is_favorite
                )
                db.add(sim)
                db.commit()
                db.refresh(sim)
                
                simulation_id = sim.id
                
                # Create SimulationResult record
                res = SimulationResult(
                    simulation_id=sim.id,
                    portfolio_history=json.dumps(result["portfolio_history"]),
                    asset_results=json.dumps([res.model_dump() for res in asset_results]),
                    final_value=result["final_value"],
                    total_invested=result["total_invested"],
                    total_return_percent=result["total_return_percent"],
                    baseline_final_value=result["baseline_final_value"],
                    baseline_return_percent=result["baseline_return_percent"],
                    total_fees=result["total_fees"],
                    fees_percentage=result["fees_percentage"],
                    volatility=result.get("volatility", 0.0),
                    max_drawdown=result.get("max_drawdown", 0.0)
                )
                
                # Only add risk metrics if columns exist in the DB
                if hasattr(res, 'volatility'):
                    res.volatility = result.get("volatility", 0.0)
                if hasattr(res, 'max_drawdown'):
                    res.max_drawdown = result.get("max_drawdown", 0.0)
                    
                db.add(res)
                db.commit()
            finally:
                db.close()
                
        return PortfolioSimulationResponse(
            id=simulation_id,
            config=data,
            results=result_schema
        )

    @staticmethod
    def get_portfolio_history(limit: int = 20):
        """Returns past portfolio simulations."""
        db = SessionLocal()
        try:
            from sqlalchemy.orm import joinedload
            simulations = db.query(Simulation).options(joinedload(Simulation.results)).filter(
                Simulation.portfolio_id.isnot(None)
            ).order_by(Simulation.created_at.desc()).limit(limit).all()
            
            history = []
            for sim in simulations:
                result = sim.results[0] if sim.results else None
                if result:
                    # Calculate net profit
                    final_val = float(result.final_value)
                    invested = float(result.total_invested)
                    net_profit = final_val - invested
                    
                    history.append({
                        "id": sim.id,
                        "portfolio_name": sim.portfolio.name if sim.portfolio else (sim.name or "Deleted Portfolio"),
                        "start_date": sim.start_date,
                        "end_date": sim.end_date,
                        "final_value": final_val,
                        "total_invested": invested,
                        "total_return_percent": float(result.total_return_percent),
                        "baseline_return_percent": float(getattr(result, 'baseline_return_percent', result.total_return_percent) or result.total_return_percent),
                        "net_profit": net_profit,
                        "total_fees": float(getattr(result, 'total_fees', 0.0) or 0.0),
                        "fees_percentage": float(getattr(result, 'fees_percentage', 0.0) or 0.0),
                        "volatility": float(getattr(result, 'volatility', 0.0) or 0.0),
                        "max_drawdown": float(getattr(result, 'max_drawdown', 0.0) or 0.0),
                        "is_favorite": bool(sim.is_favorite),
                        "created_at": sim.created_at,
                        "config": {
                            "rebalancing_enabled": bool(sim.rebalancing_enabled),
                            "periodic_rebalancing_interval": int(sim.periodic_rebalancing_interval or 12)
                        }
                    })
            return history
        finally:
            db.close()

    @staticmethod
    def get_simulation(simulation_id: int) -> PortfolioSimulationResponse:
        """Returns full details of a past portfolio simulation."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim or not sim.results:
                raise ValueError("Portfolio simulation not found")
            
            result = sim.results[0]
            
            # Reconstruct the config
            asset_configs_raw = json.loads(sim.asset_configs) if sim.asset_configs else {}
            asset_configs = {}
            for asset_id_str, cfg_data in asset_configs_raw.items():
                asset_configs[int(asset_id_str)] = AssetSimulationConfig(**cfg_data)

            config = PortfolioSimulationCreate(
                portfolio_id=sim.portfolio_id,
                name=sim.name,
                start_date=sim.start_date,
                end_date=sim.end_date,
                base_amount=sim.base_amount,
                frequency=sim.frequency,
                investment_mode=sim.investment_mode,
                rebalancing_enabled=sim.rebalancing_enabled or False,
                periodic_rebalancing_interval=sim.periodic_rebalancing_interval or 12,
                commission_fee_percent=sim.commission_fee_percent,
                minimum_fee_per_trade=sim.minimum_fee_per_trade,
                maintenance_fee_annual_percent=sim.maintenance_fee_annual_percent,
                asset_configs=asset_configs,
                is_favorite=bool(sim.is_favorite)
            )
            
            # Reconstruct asset results
            asset_results_raw = json.loads(result.asset_results) if result.asset_results else []
            asset_results = [AssetSimulationResult(**res) for res in asset_results_raw]
            
            portfolio_history = json.loads(result.portfolio_history) if result.portfolio_history else []
            
            # Calculate Risk metrics on the fly if not stored
            volatility = 0.0
            max_drawdown = 0.0
            if portfolio_history:
                smart_values = [p["smart_value"] for p in portfolio_history]
                if len(smart_values) > 1:
                    returns = []
                    for i in range(1, len(smart_values)):
                        if smart_values[i-1] > 0:
                            returns.append((smart_values[i] - smart_values[i-1]) / smart_values[i-1])
                    if returns:
                        volatility = float(np.std(returns) * 100)
                
                peak = smart_values[0]
                drawdowns = []
                for val in smart_values:
                    if val > peak: peak = val
                    if peak > 0: drawdowns.append((val - peak) / peak)
                if drawdowns:
                    max_drawdown = float(min(drawdowns) * 100)

            result_schema = PortfolioSimulationResultSchema(
                final_value=float(result.final_value),
                total_invested=float(result.total_invested),
                total_return_percent=float(result.total_return_percent),
                baseline_final_value=float(getattr(result, 'baseline_final_value', result.final_value) or result.final_value),
                baseline_return_percent=float(getattr(result, 'baseline_return_percent', result.total_return_percent) or result.total_return_percent),
                total_fees=float(getattr(result, 'total_fees', 0.0) or 0.0),
                fees_percentage=float(getattr(result, 'fees_percentage', 0.0) or 0.0),
                volatility=round(getattr(result, 'volatility', volatility) or volatility, 2),
                max_drawdown=round(getattr(result, 'max_drawdown', max_drawdown) or max_drawdown, 2),
                portfolio_history=portfolio_history,
                asset_results=asset_results,
                # Fill mandatory single-asset fields with defaults for compatibility
                avg_purchase_price=0.0,
                total_assets_accumulated=0.0,
                baseline_avg_purchase_price=0.0,
                dca_efficiency=0.0
            )
            
            return PortfolioSimulationResponse(
                id=sim.id,
                config=config,
                results=result_schema
            )
        finally:
            db.close()

    @staticmethod
    def delete_simulation(simulation_id: int):
        """Deletes a portfolio simulation."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim:
                raise ValueError("Portfolio simulation not found")
            db.delete(sim)
            db.commit()
        finally:
            db.close()

    @staticmethod
    def toggle_favorite(simulation_id: int):
        """Toggles favorite status."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim:
                raise ValueError("Portfolio simulation not found")
            sim.is_favorite = not sim.is_favorite
            db.commit()
            return sim.is_favorite
        finally:
            db.close()

    @staticmethod
    def delete_all_simulations(favorites_only: bool = False, non_favorites_only: bool = False):
        """Deletes portfolio simulations based on favorite status."""
        db = SessionLocal()
        try:
            from backend.models.simulation import SimulationResult
            
            query = db.query(Simulation).filter(Simulation.portfolio_id.isnot(None))
            if favorites_only:
                query = query.filter(Simulation.is_favorite == True)
            elif non_favorites_only:
                query = query.filter(Simulation.is_favorite == False)

            sims_to_delete = query.all()
            sim_ids = [s.id for s in sims_to_delete]

            if sim_ids:
                db.query(SimulationResult).filter(SimulationResult.simulation_id.in_(sim_ids)).delete(synchronize_session=False)
                db.query(Simulation).filter(Simulation.id.in_(sim_ids)).delete(synchronize_session=False)
                db.commit()
        finally:
            db.close()
