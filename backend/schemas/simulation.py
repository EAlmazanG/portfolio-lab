"""Schemas for asset simulations."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any


class SimulationBase(BaseModel):
    """Base fields for a simulation."""
    asset_id: int
    start_date: datetime
    end_date: datetime
    base_amount: float = Field(gt=0)
    frequency: str = Field(pattern="^(daily|weekly|monthly)$")
    commission_fee_percent: float = Field(default=0.0, ge=0)
    dynamic_timing_enabled: bool = Field(default=False)
    timing_aggressiveness: float = Field(default=0.5, ge=0, le=1)
    dynamic_sizing_enabled: bool = Field(default=False)
    sizing_multiplier: float = Field(default=1.0, ge=1, le=5)


class SimulationCreate(SimulationBase):
    """Request schema for creating a simulation."""
    name: Optional[str] = None


class PortfolioPoint(BaseModel):
    """Single point in portfolio history."""
    date: str
    value: float
    invested: float


class SimulationResultSchema(BaseModel):
    """Response schema for simulation results."""
    final_value: float
    total_invested: float
    total_return_percent: float
    avg_purchase_price: float
    total_assets_accumulated: float
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
