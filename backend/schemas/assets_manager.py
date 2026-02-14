"""Schemas for assets manager."""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class AssetManagerListItem(BaseModel):
    id: int
    ticker: str
    name: str
    asset_type: str
    interval: Optional[str] = None
    sector: Optional[str] = None
    is_active: bool
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    record_count: int = 0


class AssetManagerSettings(BaseModel):
    ingestion_years: int = Field(default=10, ge=1, le=100)
    ingestion_interval: str = Field(default="1d", pattern="^(1d|1wk|1mo)$")


class AssetSearchResult(BaseModel):
    ticker: str
    name: str
    quote_type: Optional[str] = None
    exchange: Optional[str] = None
    currency: Optional[str] = None
    sector: Optional[str] = None


class AssetCreateRequest(BaseModel):
    ticker: str
    name: Optional[str] = None
    asset_type: Optional[str] = None
    sector: Optional[str] = None
    download_history: bool = False
    download_years: Optional[int] = Field(default=None, ge=1, le=100)
    download_interval: Optional[str] = Field(default=None, pattern="^(1d|1wk|1mo)$")


class AssetCreateResponse(BaseModel):
    asset: AssetManagerListItem
    downloaded_records: int = 0


class AssetDownloadRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    period: Optional[str] = None
    years: Optional[int] = Field(default=None, ge=1, le=100)
    interval: Optional[str] = Field(default=None, pattern="^(1d|1wk|1mo)$")


class AssetDownloadResponse(BaseModel):
    saved_records: int = 0


class UpdateAllAssetsResponse(BaseModel):
    assets_updated: int = 0
    records_saved: int = 0
