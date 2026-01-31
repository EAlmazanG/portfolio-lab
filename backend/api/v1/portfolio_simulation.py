from fastapi import APIRouter, HTTPException, Depends
from typing import List
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, PortfolioSimulationResponse
from backend.services.portfolio_simulation_service import PortfolioSimulationService

router = APIRouter(prefix="/portfolio-simulations", tags=["portfolio-simulations"])

@router.post("/run", response_model=PortfolioSimulationResponse)
async def run_portfolio_simulation(data: PortfolioSimulationCreate):
    try:
        # Normalize asset_configs keys to int (in case they come as strings from JSON)
        if data.asset_configs:
            normalized = {}
            for k, v in list(data.asset_configs.items()):
                int_key = int(k) if isinstance(k, str) else k
                normalized[int_key] = v
            data.asset_configs.clear()
            data.asset_configs.update(normalized)
        
        return PortfolioSimulationService.run_simulation(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error running portfolio simulation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during simulation.")

@router.get("/history")
async def get_portfolio_simulation_history(limit: int = 20):
    return PortfolioSimulationService.get_portfolio_history(limit)

@router.get("/{simulation_id}", response_model=PortfolioSimulationResponse)
async def get_portfolio_simulation_details(simulation_id: int):
    try:
        return PortfolioSimulationService.get_simulation(simulation_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{simulation_id}")
async def delete_portfolio_simulation(simulation_id: int):
    try:
        PortfolioSimulationService.delete_simulation(simulation_id)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/all/delete")
async def delete_all_portfolio_simulations(favorites_only: bool = False, non_favorites_only: bool = False):
    try:
        PortfolioSimulationService.delete_all_simulations(favorites_only, non_favorites_only)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{simulation_id}/favorite")
async def toggle_portfolio_simulation_favorite(simulation_id: int):
    try:
        is_fav = PortfolioSimulationService.toggle_favorite(simulation_id)
        return {"is_favorite": is_fav}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
