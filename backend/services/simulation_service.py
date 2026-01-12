"""Service for managing simulations."""

import json
import numpy as np
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
    def get_asset_history(asset_id: int, start_date: datetime, end_date: datetime):
        """Returns historical price data for an asset."""
        engine = SimulationEngine(asset_id, start_date, end_date)
        if engine.market_data.empty:
            return []
        
        history = []
        for date, row in engine.market_data.iterrows():
            history.append({
                "date": date.strftime("%Y-%m-%d"),
                "price": round(float(row['close']), 2)
            })
        return history

    @staticmethod
    def get_assets():
        """Returns all active assets with their available date range."""
        db = SessionLocal()
        try:
            from backend.models.market_data import MarketData
            from sqlalchemy import func
            
            assets = db.query(Asset).filter(Asset.is_active == True).all()
            response = []
            
            for asset in assets:
                # Get min/max dates from MarketData
                stats = db.query(
                    func.min(MarketData.date).label("min_date"),
                    func.max(MarketData.date).label("max_date")
                ).filter(MarketData.asset_id == asset.id).first()
                
                response.append({
                    "id": asset.id,
                    "ticker": asset.ticker,
                    "name": asset.name,
                    "asset_type": asset.asset_type,
                    "min_date": stats.min_date.strftime("%Y-%m-%d") if stats and stats.min_date else None,
                    "max_date": stats.max_date.strftime("%Y-%m-%d") if stats and stats.max_date else None
                })
            return response
        finally:
            db.close()

    @staticmethod
    def get_history(limit: int = 20):
        """Returns past simulations with basic info."""
        db = SessionLocal()
        try:
            from sqlalchemy.orm import joinedload
            # Filter for single asset simulations only (no portfolio_id)
            # and ensure they have an asset associated
            simulations = db.query(Simulation).options(joinedload(Simulation.results)).filter(
                Simulation.portfolio_id.is_(None),
                Simulation.asset_id.isnot(None)
            ).order_by(Simulation.created_at.desc()).limit(limit).all()
            
            history = []
            for sim in simulations:
                # Get the latest result for this simulation
                result = sim.results[0] if sim.results else None
                if result:
                    try:
                        final_val = float(result.final_value)
                        total_inv = float(result.total_invested)
                        total_fees = float(result.total_fees or 0.0)
                        total_ret = float(result.total_return_percent)
                        base_ret = float(result.baseline_return_percent or total_ret)
                        
                        gross_profit = final_val + total_fees - total_inv
                        net_profit = final_val - total_inv
                        smart_vs_baseline = total_ret - base_ret
                        
                        history.append({
                            "id": int(sim.id),
                            "asset_ticker": str(sim.asset.ticker) if sim.asset else "Unknown",
                            "asset_name": str(sim.asset.name) if sim.asset else "Unknown Asset",
                            "start_date": sim.start_date,
                            "end_date": sim.end_date,
                            "final_value": round(final_val, 2),
                            "total_invested": round(total_inv, 2),
                            "gross_profit": round(float(gross_profit), 2),
                            "net_profit": round(float(net_profit), 2),
                            "total_fees": round(total_fees, 2),
                            "total_return_percent": round(total_ret, 2),
                            "smart_vs_baseline_diff": round(float(smart_vs_baseline), 2),
                            "is_favorite": bool(sim.is_favorite),
                            "created_at": sim.created_at
                        })
                    except (AttributeError, ValueError, TypeError) as e:
                        print(f"Error processing simulation {sim.id}: {e}")
                        continue
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
                sizing_multiplier=sim.sizing_multiplier,
                smart_indicator=sim.smart_indicator or "RSI",
                rsi_threshold_low=sim.rsi_threshold_low or 30.0,
                rsi_threshold_high=sim.rsi_threshold_high or 70.0,
                ma_period_short=sim.ma_period_short or 50,
                ma_period_long=sim.ma_period_long or 200,
                expensive_buy_ratio=sim.expensive_buy_ratio or 0.0,
                is_favorite=bool(sim.is_favorite)
            )
            
            portfolio_history = json.loads(result.portfolio_history) if result.portfolio_history else []
            
            # Calculate Risk metrics on the fly from history
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
                
                if smart_values:
                    peak = smart_values[0]
                    drawdowns = []
                    for val in smart_values:
                        if val > peak: peak = val
                        if peak > 0: drawdowns.append((val - peak) / peak)
                    if drawdowns:
                        max_drawdown = float(min(drawdowns) * 100)

            result_schema = SimulationResultSchema(
                final_value=float(result.final_value),
                total_invested=float(result.total_invested),
                total_return_percent=float(result.total_return_percent),
                avg_purchase_price=float(result.avg_purchase_price or 0.0),
                total_assets_accumulated=float(result.total_assets_accumulated or 0.0),
                baseline_final_value=float(result.baseline_final_value or result.final_value),
                baseline_return_percent=float(result.baseline_return_percent or result.total_return_percent),
                baseline_avg_purchase_price=float(result.baseline_avg_purchase_price or 0.0),
                dca_efficiency=float(result.dca_efficiency or 0.0),
                total_fees=float(result.total_fees or 0.0),
                fees_percentage=float(result.fees_percentage or 0.0),
                volatility=round(volatility, 2),
                max_drawdown=round(max_drawdown, 2),
                portfolio_history=portfolio_history
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
            sizing_multiplier=data.sizing_multiplier,
            smart_indicator=data.smart_indicator,
            rsi_threshold_low=data.rsi_threshold_low,
            rsi_threshold_high=data.rsi_threshold_high,
            ma_period_short=data.ma_period_short,
            ma_period_long=data.ma_period_long,
            expensive_buy_ratio=data.expensive_buy_ratio
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
            volatility=dca_result.volatility,
            max_drawdown=dca_result.max_drawdown,
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
                    sizing_multiplier=data.sizing_multiplier,
                    smart_indicator=data.smart_indicator,
                    rsi_threshold_low=data.rsi_threshold_low,
                    rsi_threshold_high=data.rsi_threshold_high,
                    ma_period_short=data.ma_period_short,
                    ma_period_long=data.ma_period_long,
                    expensive_buy_ratio=data.expensive_buy_ratio,
                    is_favorite=data.is_favorite
                )
                db.add(sim)
                db.commit()
                db.refresh(sim)
                
                simulation_id = sim.id
                
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
                    fees_percentage=dca_result.fees_percentage,
                    volatility=dca_result.volatility,
                    max_drawdown=dca_result.max_drawdown
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

    @staticmethod
    def toggle_favorite(simulation_id: int):
        """Toggles the favorite status of a simulation."""
        db = SessionLocal()
        try:
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if not sim:
                raise ValueError("Simulation not found")
            sim.is_favorite = not sim.is_favorite
            db.commit()
            return sim.is_favorite
        finally:
            db.close()

    @staticmethod
    def delete_all_simulations(favorites_only: bool = False, non_favorites_only: bool = False):
        """Deletes simulations based on their favorite status."""
        db = SessionLocal()
        try:
            from backend.models.simulation import SimulationResult
            
            query = db.query(Simulation)
            if favorites_only:
                query = query.filter(Simulation.is_favorite == True)
            elif non_favorites_only:
                query = query.filter(Simulation.is_favorite == False)

            sims_to_delete = query.all()
            sim_ids = [s.id for s in sims_to_delete]

            if sim_ids:
                # Delete results first
                db.query(SimulationResult).filter(SimulationResult.simulation_id.in_(sim_ids)).delete(synchronize_session=False)
                # Then delete simulations
                db.query(Simulation).filter(Simulation.id.in_(sim_ids)).delete(synchronize_session=False)
                db.commit()
        finally:
            db.close()
