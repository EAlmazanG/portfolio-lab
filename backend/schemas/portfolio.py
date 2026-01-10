from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PortfolioAssetBase(BaseModel):
    asset_id: int
    weight: float = Field(..., ge=0.0, le=1.0)

class PortfolioAssetCreate(PortfolioAssetBase):
    pass

class PortfolioAsset(PortfolioAssetBase):
    id: int
    asset: Optional["AssetSimpleResponse"] = None
    
    class Config:
        from_attributes = True

from backend.schemas.simulation import AssetSimpleResponse
PortfolioAsset.model_rebuild()

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_favorite: bool = False

class PortfolioCreate(PortfolioBase):
    assets: List[PortfolioAssetCreate]

class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assets: Optional[List[PortfolioAssetCreate]] = None

class Portfolio(PortfolioBase):
    id: int
    created_at: datetime
    updated_at: datetime
    assets: List[PortfolioAsset]

    class Config:
        from_attributes = True

class PortfolioListItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_favorite: bool = False
    asset_count: int
    created_at: datetime

    class Config:
        from_attributes = True
