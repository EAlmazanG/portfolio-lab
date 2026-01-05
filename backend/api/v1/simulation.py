"""API endpoints for simulations."""

from fastapi import APIRouter, HTTPException
from typing import List

from backend.schemas.simulation import (
    SimulationCreate, 
    SimulationResponse, 
    AssetSimpleResponse
)
from backend.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("/assets", response_model=List[AssetSimpleResponse])
async def get_assets():
    """List all available assets for simulation."""
    return SimulationService.get_assets()


@router.post("/run", response_model=SimulationResponse)
async def run_simulation(data: SimulationCreate):
    """Run a new baseline DCA simulation."""
    try:
        return SimulationService.run_simulation(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
