"""Service for managing portfolio simulations."""

import json
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
    AssetSimulationResult
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
                    rebalancing_mode=data.rebalancing_mode,
                    rebalancing_interval_months=data.rebalancing_interval_months,
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
                    fees_percentage=result["fees_percentage"]
                )
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
            simulations = db.query(Simulation).filter(
                Simulation.portfolio_id.isnot(None)
            ).order_by(Simulation.created_at.desc()).limit(limit).all()
            
            history = []
            for sim in simulations:
                result = sim.results[0] if sim.results else None
                if result:
                    history.append({
                        "id": sim.id,
                        "portfolio_name": sim.portfolio.name if sim.portfolio else "Deleted Portfolio",
                        "start_date": sim.start_date,
                        "end_date": sim.end_date,
                        "final_value": result.final_value,
                        "total_invested": result.total_invested,
                        "total_return_percent": result.total_return_percent,
                        "is_favorite": bool(sim.is_favorite),
                        "created_at": sim.created_at
                    })
            return history
        finally:
            db.close()
