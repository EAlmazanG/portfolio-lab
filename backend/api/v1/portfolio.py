from fastapi import APIRouter, HTTPException, Depends
from typing import List
from backend.schemas.portfolio import Portfolio, PortfolioCreate, PortfolioUpdate, PortfolioListItem
from backend.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.post("/", response_model=Portfolio)
async def create_portfolio(portfolio: PortfolioCreate):
    return PortfolioService.create_portfolio(portfolio)

@router.get("/", response_model=List[PortfolioListItem])
async def get_portfolios():
    portfolios = PortfolioService.get_portfolios()
    return [
        PortfolioListItem(
            id=p.id,
            name=p.name,
            description=p.description,
            initial_capital=p.initial_capital or 0.0,
            is_favorite=p.is_favorite,
            asset_count=len(p.assets),
            created_at=p.created_at
        ) for p in portfolios
    ]

@router.get("/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(portfolio_id: int):
    portfolio = PortfolioService.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio

@router.put("/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(portfolio_id: int, portfolio: PortfolioUpdate):
    updated = PortfolioService.update_portfolio(portfolio_id, portfolio)
    if not updated:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return updated

@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: int):
    success = PortfolioService.delete_portfolio(portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"status": "success"}

@router.patch("/{portfolio_id}/favorite")
async def toggle_portfolio_favorite(portfolio_id: int):
    try:
        is_fav = PortfolioService.toggle_favorite(portfolio_id)
        return {"is_favorite": is_fav}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
