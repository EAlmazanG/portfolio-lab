"""Service for managing simulations."""

import json
from sqlalchemy.orm import Session
from datetime import datetime

from backend.db.session import SessionLocal
from backend.models.simulation import Simulation, SimulationResult
from backend.models.asset import Asset
from backend.engine.simulation_engine import SimulationEngine
from backend.schemas.simulation import SimulationCreate, SimulationResponse, SimulationResultSchema


class SimulationService:
    """Service to handle simulation logic and persistence."""

    @staticmethod
    def get_assets():
        """Returns all active assets."""
        db = SessionLocal()
        try:
            return db.query(Asset).filter(Asset.is_active == True).all()
        finally:
            db.close()

    @staticmethod
    def run_simulation(data: SimulationCreate, save: bool = True) -> SimulationResponse:
        """
        Runs a simulation and optionally saves it.
        """
        engine = SimulationEngine(
            asset_id=data.asset_id,
            start_date=data.start_date,
            end_date=data.end_date
        )
        
        dca_result = engine.run_baseline_dca(
            base_amount=data.base_amount,
            frequency=data.frequency,
            commission_percent=data.commission_fee_percent
        )
        
        result_schema = SimulationResultSchema(
            final_value=dca_result.final_value,
            total_invested=dca_result.total_invested,
            total_return_percent=dca_result.total_return_percent,
            avg_purchase_price=dca_result.avg_purchase_price,
            total_assets_accumulated=dca_result.total_assets_accumulated,
            portfolio_history=dca_result.portfolio_history
        )
        
        simulation_id = None
        
        if save:
            db = SessionLocal()
            try:
                # Create Simulation record
                sim = Simulation(
                    name=data.name,
                    asset_id=data.asset_id,
                    start_date=data.start_date,
                    end_date=data.end_date,
                    base_amount=data.base_amount,
                    frequency=data.frequency,
                    commission_fee_percent=data.commission_fee_percent,
                    dynamic_timing_enabled=data.dynamic_timing_enabled,
                    timing_aggressiveness=data.timing_aggressiveness,
                    dynamic_sizing_enabled=data.dynamic_sizing_enabled,
                    sizing_multiplier=data.sizing_multiplier
                )
                db.add(sim)
                db.commit()
                db.refresh(sim)
                
                simulation_id = sim.id
                
                # Create SimulationResult record
                res = SimulationResult(
                    simulation_id=sim.id,
                    portfolio_history=json.dumps(dca_result.portfolio_history),
                    final_value=dca_result.final_value,
                    total_invested=dca_result.total_invested,
                    total_return_percent=dca_result.total_return_percent,
                    avg_purchase_price=dca_result.avg_purchase_price,
                    total_assets_accumulated=dca_result.total_assets_accumulated
                )
                db.add(res)
                db.commit()
            finally:
                db.close()
                
        return SimulationResponse(
            id=simulation_id,
            config=data,
            results=result_schema
        )
