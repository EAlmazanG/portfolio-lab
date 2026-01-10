"""Models for asset simulations."""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.db.base import Base


class Simulation(Base):
    """Model for storing simulation configurations."""

    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    
    # Asset association
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    asset = relationship("Asset", back_populates="simulations")

    # Configuration
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    initial_capital = Column(Float, default=0.0)
    base_amount = Column(Float, nullable=False)  # e.g., $500
    frequency = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly'
    investment_mode = Column(String(20), default="per_contribution")  # 'annual' or 'per_contribution'
    
    # Fees
    commission_fee_percent = Column(Float, default=0.0)
    minimum_fee_per_trade = Column(Float, default=0.0)
    maintenance_fee_annual_percent = Column(Float, default=0.0)

    # Smart Features
    dynamic_timing_enabled = Column(Boolean, default=False)
    timing_aggressiveness = Column(Float, default=0.5)
    dynamic_sizing_enabled = Column(Boolean, default=False)
    sizing_multiplier = Column(Float, default=1.0)
    smart_indicator = Column(String(20), default="RSI")
    rsi_threshold_low = Column(Float, default=30.0)
    rsi_threshold_high = Column(Float, default=70.0)
    ma_period_short = Column(Integer, default=50)
    ma_period_long = Column(Integer, default=200)
    expensive_buy_ratio = Column(Float, default=0.0) # New parameter

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Results
    results = relationship("SimulationResult", back_populates="simulation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Simulation(id={self.id}, asset_id={self.asset_id})>"


class SimulationResult(Base):
    """Model for storing simulation results."""

    __tablename__ = "simulation_results"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("simulations.id"), nullable=False)
    simulation = relationship("Simulation", back_populates="results")

    # Time-series data stored as JSON strings for simplicity in this version
    # formats: [{"date": "2021-01-01", "value": 100.0}, ...]
    portfolio_history = Column(Text, nullable=True) 

    # Key Metrics
    final_value = Column(Float, nullable=False)
    total_invested = Column(Float, nullable=False)
    total_return_percent = Column(Float, nullable=False)
    
    # DCA specific metrics
    avg_purchase_price = Column(Float, nullable=True)
    total_assets_accumulated = Column(Float, nullable=True)

    # Comparison metrics
    baseline_final_value = Column(Float, nullable=True)
    baseline_return_percent = Column(Float, nullable=True)
    baseline_avg_purchase_price = Column(Float, nullable=True)
    dca_efficiency = Column(Float, nullable=True)

    # Fee metrics
    total_fees = Column(Float, nullable=True)
    fees_percentage = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<SimulationResult(id={self.id}, simulation_id={self.simulation_id})>"
