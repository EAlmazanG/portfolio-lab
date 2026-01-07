"""API endpoints for simulations."""

from fastapi import APIRouter, HTTPException
from typing import List

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
