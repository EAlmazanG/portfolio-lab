from fastapi import APIRouter, HTTPException, Depends
from typing import List
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, PortfolioSimulationResponse
from backend.services.portfolio_simulation_service import PortfolioSimulationService

router = APIRouter(prefix="/portfolio-simulations", tags=["portfolio-simulations"])

@router.post("/run", response_model=PortfolioSimulationResponse)
async def run_portfolio_simulation(data: PortfolioSimulationCreate):
    try:
        return PortfolioSimulationService.run_simulation(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error running portfolio simulation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during simulation.")

@router.get("/history")
async def get_portfolio_simulation_history(limit: int = 20):
    return PortfolioSimulationService.get_portfolio_history(limit)
