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
    def get_history(limit: int = 20):
        """Returns past simulations with basic info."""
        db = SessionLocal()
        try:
            simulations = db.query(Simulation).order_by(Simulation.created_at.desc()).limit(limit).all()
            history = []
            for sim in simulations:
                # Get the latest result for this simulation
                result = sim.results[0] if sim.results else None
                if result:
                    gross_profit = result.final_value + (result.total_fees or 0.0) - result.total_invested
                    net_profit = result.final_value - result.total_invested
                    smart_vs_baseline = result.total_return_percent - (result.baseline_return_percent or result.total_return_percent)
                    
                    history.append({
                        "id": sim.id,
                        "asset_ticker": sim.asset.ticker,
                        "asset_name": sim.asset.name,
                        "start_date": sim.start_date,
                        "end_date": sim.end_date,
                        "final_value": result.final_value,
                        "total_invested": result.total_invested,
                        "gross_profit": round(float(gross_profit), 2),
                        "net_profit": round(float(net_profit), 2),
                        "total_fees": round(float(result.total_fees or 0.0), 2),
                        "total_return_percent": result.total_return_percent,
                        "smart_vs_baseline_diff": round(float(smart_vs_baseline), 2),
                        "created_at": sim.created_at
                    })
            return history
        finally:
            db.close()

    @staticmethod
    def get_simulation(simulation_id: int) -> SimulationResponse:
        """Returns full details of a past simulation."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim or not sim.results:
                raise ValueError("Simulation not found")
            
            result = sim.results[0]
            
            # Reconstruct the schema
            config = SimulationCreate(
                asset_id=sim.asset_id,
                start_date=sim.start_date,
                end_date=sim.end_date,
                initial_capital=sim.initial_capital,
                base_amount=sim.base_amount,
                frequency=sim.frequency,
                investment_mode=sim.investment_mode,
                commission_fee_percent=sim.commission_fee_percent,
                minimum_fee_per_trade=sim.minimum_fee_per_trade,
                maintenance_fee_annual_percent=sim.maintenance_fee_annual_percent,
                dynamic_timing_enabled=sim.dynamic_timing_enabled,
                timing_aggressiveness=sim.timing_aggressiveness,
                dynamic_sizing_enabled=sim.dynamic_sizing_enabled,
                sizing_multiplier=sim.sizing_multiplier
            )
            
            result_schema = SimulationResultSchema(
                final_value=result.final_value,
                total_invested=result.total_invested,
                total_return_percent=result.total_return_percent,
                avg_purchase_price=result.avg_purchase_price or 0.0,
                total_assets_accumulated=result.total_assets_accumulated or 0.0,
                baseline_final_value=result.baseline_final_value or result.final_value,
                baseline_return_percent=result.baseline_return_percent or result.total_return_percent,
                baseline_avg_purchase_price=result.baseline_avg_purchase_price or result.avg_purchase_price or 0.0,
                dca_efficiency=result.dca_efficiency or 0.0,
                total_fees=result.total_fees or 0.0,
                fees_percentage=result.fees_percentage or 0.0,
                portfolio_history=json.loads(result.portfolio_history) if result.portfolio_history else []
            )
            
            return SimulationResponse(
                id=sim.id,
                config=config,
                results=result_schema
            )
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
            initial_capital=data.initial_capital,
            investment_mode=data.investment_mode,
            commission_percent=data.commission_fee_percent,
            minimum_fee_per_trade=data.minimum_fee_per_trade,
            maintenance_fee_annual_percent=data.maintenance_fee_annual_percent,
            dynamic_timing_enabled=data.dynamic_timing_enabled,
            timing_aggressiveness=data.timing_aggressiveness,
            dynamic_sizing_enabled=data.dynamic_sizing_enabled,
            sizing_multiplier=data.sizing_multiplier
        )
        
        result_schema = SimulationResultSchema(
            final_value=dca_result.final_value,
            total_invested=dca_result.total_invested,
            total_return_percent=dca_result.total_return_percent,
            avg_purchase_price=dca_result.avg_purchase_price,
            total_assets_accumulated=dca_result.total_assets_accumulated,
            baseline_final_value=dca_result.baseline_final_value,
            baseline_return_percent=dca_result.baseline_return_percent,
            baseline_avg_purchase_price=dca_result.baseline_avg_purchase_price,
            dca_efficiency=dca_result.dca_efficiency,
            total_fees=dca_result.total_fees,
            fees_percentage=dca_result.fees_percentage,
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
                    initial_capital=data.initial_capital,
                    base_amount=data.base_amount,
                    frequency=data.frequency,
                    investment_mode=data.investment_mode,
                    commission_fee_percent=data.commission_fee_percent,
                    minimum_fee_per_trade=data.minimum_fee_per_trade,
                    maintenance_fee_annual_percent=data.maintenance_fee_annual_percent,
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
                    total_assets_accumulated=dca_result.total_assets_accumulated,
                    baseline_final_value=dca_result.baseline_final_value,
                    baseline_return_percent=dca_result.baseline_return_percent,
                    baseline_avg_purchase_price=dca_result.baseline_avg_purchase_price,
                    dca_efficiency=dca_result.dca_efficiency,
                    total_fees=dca_result.total_fees,
                    fees_percentage=dca_result.fees_percentage
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

    @staticmethod
    def delete_simulation(simulation_id: int):
        """Deletes a simulation and its results."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim:
                raise ValueError("Simulation not found")
            db.delete(sim)
            db.commit()
        finally:
            db.close()
