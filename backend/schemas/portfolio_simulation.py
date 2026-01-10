from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.schemas.simulation import PortfolioPoint, SimulationResultSchema

class AssetSimulationConfig(BaseModel):
    """Specific smart DCA config for an asset within a portfolio."""
    dynamic_timing_enabled: bool = Field(default=False)
    timing_aggressiveness: float = Field(default=0.5, ge=0, le=1)
    dynamic_sizing_enabled: bool = Field(default=False)
    sizing_multiplier: float = Field(default=1.0, ge=1, le=5)
    smart_indicator: str = Field(default="RSI", pattern="^(RSI|MA|EMA)$")
    rsi_threshold_low: float = Field(default=30.0, ge=0, le=100)
    rsi_threshold_high: float = Field(default=70.0, ge=0, le=100)
    ma_period_short: int = Field(default=50, ge=1)
    ma_period_long: int = Field(default=200, ge=1)
    expensive_buy_ratio: float = Field(default=0.0, ge=0.0, le=1.0)

class PortfolioSimulationCreate(BaseModel):
    """Request schema for running a portfolio simulation."""
    portfolio_id: int
    name: Optional[str] = None
    start_date: datetime
    end_date: datetime
    base_amount: float = Field(gt=0)
    frequency: str = Field(pattern="^(daily|weekly|monthly|bi-monthly)$")
    investment_mode: str = Field(default="per_contribution", pattern="^(annual|per_contribution)$")
    
    # Global Fees
    commission_fee_percent: float = Field(default=0.0, ge=0)
    minimum_fee_per_trade: float = Field(default=0.0, ge=0)
    maintenance_fee_annual_percent: float = Field(default=0.0, ge=0)
    
    rebalancing_mode: str = Field(default="none", pattern="^(none|periodic|contribution)$")
    rebalancing_interval_months: int = Field(default=6, ge=1)
    
    # Per-asset configuration overrides
    asset_configs: Dict[int, AssetSimulationConfig] = {}
    is_favorite: bool = Field(default=False)

class AssetSimulationResult(BaseModel):
    """Result details for a single asset within the portfolio simulation."""
    asset_id: int
    ticker: str
    final_value: float
    total_invested: float
    total_return_percent: float
    assets_accumulated: float
    avg_price: float
    portfolio_history: List[Dict[str, Any]] # Price and individual performance

class PortfolioSimulationResultSchema(SimulationResultSchema):
    """Aggregated portfolio simulation results."""
    asset_results: List[AssetSimulationResult]

class PortfolioSimulationResponse(BaseModel):
    """Full portfolio simulation response."""
    id: Optional[int] = None
    config: PortfolioSimulationCreate
    results: PortfolioSimulationResultSchema
