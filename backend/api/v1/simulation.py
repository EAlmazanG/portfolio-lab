"""API endpoints for simulations."""

from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

from backend.schemas.simulation import (
    SimulationCreate, 
    SimulationResponse, 
    AssetSimpleResponse,
    SimulationHistoryItem
)
from backend.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/assets", response_model=List[AssetSimpleResponse])
async def get_assets():
    """List all available assets for simulation."""
    return SimulationService.get_assets()


@router.get("/assets/{asset_id}/history")
async def get_asset_history(asset_id: int, start_date: str, end_date: str):
    """Get historical price data for an asset."""
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        return SimulationService.get_asset_history(asset_id, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=List[SimulationHistoryItem])
async def get_simulation_history(limit: int = 20):
    """Get past simulations."""
    return SimulationService.get_history(limit)


@router.get("/{simulation_id}", response_model=SimulationResponse)
async def get_simulation_details(simulation_id: int):
    """Get full details of a past simulation."""
    try:
        return SimulationService.get_simulation(simulation_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/run", response_model=SimulationResponse)
async def run_simulation(data: SimulationCreate):
    """Run a new baseline DCA simulation."""
    try:
        return SimulationService.run_simulation(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.delete("/{simulation_id}")
async def delete_simulation(simulation_id: int):
    """Delete a past simulation."""
    try:
        SimulationService.delete_simulation(simulation_id)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.delete("/all/delete", tags=["simulations"])
async def delete_all_simulations(favorites_only: bool = False, non_favorites_only: bool = False):
    """Delete past simulations based on favorite status."""
    try:
        SimulationService.delete_all_simulations(favorites_only, non_favorites_only)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.patch("/{simulation_id}/favorite", tags=["simulations"])
async def toggle_favorite(simulation_id: int):
    """Toggle favorite status."""
    try:
        is_fav = SimulationService.toggle_favorite(simulation_id)
        return {"is_favorite": is_fav}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
