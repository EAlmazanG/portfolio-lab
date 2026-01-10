"""Schemas for asset simulations."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any


class SimulationBase(BaseModel):
    """Base fields for a simulation."""
    asset_id: int
    start_date: datetime
    end_date: datetime
    initial_capital: float = Field(default=0.0, ge=0)
    base_amount: float = Field(gt=0)
    frequency: str = Field(pattern="^(daily|weekly|monthly|bi-monthly)$")
    investment_mode: str = Field(default="per_contribution", pattern="^(annual|per_contribution)$")
    commission_fee_percent: float = Field(default=0.0, ge=0)
    minimum_fee_per_trade: float = Field(default=0.0, ge=0)
    maintenance_fee_annual_percent: float = Field(default=0.0, ge=0)
    dynamic_timing_enabled: bool = Field(default=False)
    timing_aggressiveness: float = Field(default=0.5, ge=0, le=1)
    dynamic_sizing_enabled: bool = Field(default=False)
    sizing_multiplier: float = Field(default=1.0, ge=1, le=5)
    smart_indicator: str = Field(default="RSI", pattern="^(RSI|MA|EMA)$")
    rsi_threshold_low: float = Field(default=30.0, ge=0, le=100)
    rsi_threshold_high: float = Field(default=70.0, ge=0, le=100)
    ma_period_short: int = Field(default=50, ge=1)
    ma_period_long: int = Field(default=200, ge=1)


class SimulationCreate(SimulationBase):
    """Request schema for creating a simulation."""
    name: Optional[str] = None


class PortfolioPoint(BaseModel):
    """Single point in portfolio history."""
    date: str
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    price: float
    indicator_value: float = 0.0
    ma_short: float = 0.0
    ma_long: float = 0.0
    invested: float
    baseline_value: float
    smart_value: float
    cumulative_fees: float
    b_contribution: float = 0.0
    s_contribution: float = 0.0


class SimulationResultSchema(BaseModel):
    """Response schema for simulation results."""
    final_value: float
    total_invested: float
    total_return_percent: float
    avg_purchase_price: float
    total_assets_accumulated: float
    baseline_final_value: float
    baseline_return_percent: float
    baseline_avg_purchase_price: float
    dca_efficiency: float
    total_fees: float
    fees_percentage: float
    portfolio_history: List[PortfolioPoint]


class SimulationResponse(BaseModel):
    """Full simulation response including config and results."""
    id: Optional[int] = None
    config: SimulationCreate
    results: SimulationResultSchema


class AssetSimpleResponse(BaseModel):
    """Simple asset info for the selector."""
    id: int
    ticker: str
    name: str
    asset_type: str


class SimulationHistoryItem(BaseModel):
    """Simplified simulation info for the history list."""
    id: int
    asset_ticker: str
    asset_name: str
    start_date: datetime
    end_date: datetime
    final_value: float
    total_invested: float
    gross_profit: float
    net_profit: float
    total_fees: float
    total_return_percent: float
    smart_vs_baseline_diff: float
    created_at: datetime

    class Config:
        from_attributes = True
