"""API endpoints for Assets Manager."""

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from backend.schemas.assets_manager import (
    AssetManagerListItem,
    AssetManagerSettings,
    AssetSearchResult,
    AssetCreateRequest,
    AssetCreateResponse,
    AssetDownloadRequest,
    AssetDownloadResponse,
    UpdateAllAssetsResponse,
)
from backend.services.assets_manager_service import AssetsManagerService

router = APIRouter(prefix="/assets-manager", tags=["assets-manager"])


@router.get("/assets", response_model=List[AssetManagerListItem])
async def list_assets():
    return AssetsManagerService.list_assets()


@router.get("/settings", response_model=AssetManagerSettings)
async def get_settings():
    return AssetsManagerService.get_settings()


@router.put("/settings", response_model=AssetManagerSettings)
async def update_settings(payload: AssetManagerSettings):
    return AssetsManagerService.update_settings(payload)


@router.get("/search", response_model=List[AssetSearchResult])
async def search_assets(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter q is required")
    return AssetsManagerService.search_assets(q)


@router.get("/assets/{ticker}/info")
async def get_asset_info(ticker: str):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    info = AssetsManagerService.get_asset_info(ticker)
    if not info:
        raise HTTPException(status_code=404, detail="Asset info not found")
    return info


@router.get("/assets/{ticker}/ohlc")
async def get_asset_ohlc_preview(ticker: str):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    return AssetsManagerService.get_asset_ohlc_preview(ticker)


@router.post("/assets", response_model=AssetCreateResponse)
async def create_asset(payload: AssetCreateRequest):
    try:
        return AssetsManagerService.create_asset(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/assets/{asset_id}/download", response_model=AssetDownloadResponse)
async def download_asset(asset_id: int, payload: AssetDownloadRequest):
    try:
        return AssetsManagerService.download_asset_history(asset_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/assets/update-all", response_model=UpdateAllAssetsResponse)
async def update_all_assets():
    return AssetsManagerService.update_all_assets()


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: int):
    try:
        AssetsManagerService.delete_asset(asset_id)
        return {"status": "deleted"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
