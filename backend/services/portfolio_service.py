from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.schemas.portfolio import PortfolioCreate, PortfolioUpdate
from typing import List, Optional
from datetime import datetime

class PortfolioService:
    @staticmethod
    def create_portfolio(obj_in: PortfolioCreate) -> Portfolio:
        db = SessionLocal()
        try:
            db_portfolio = Portfolio(
                name=obj_in.name,
                description=obj_in.description
            )
            db.add(db_portfolio)
            db.flush()  # Get ID

            for asset_in in obj_in.assets:
                db_asset = PortfolioAsset(
                    portfolio_id=db_portfolio.id,
                    asset_id=asset_in.asset_id,
                    weight=asset_in.weight
                )
                db.add(db_asset)
            
            db.commit()
            db.refresh(db_portfolio)
            return db_portfolio
        finally:
            db.close()

    @staticmethod
    def get_portfolios() -> List[Portfolio]:
        db = SessionLocal()
        try:
            return db.query(Portfolio).all()
        finally:
            db.close()

    @staticmethod
    def get_portfolio(portfolio_id: int) -> Optional[Portfolio]:
        db = SessionLocal()
        try:
            return db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        finally:
            db.close()

    @staticmethod
    def update_portfolio(portfolio_id: int, obj_in: PortfolioUpdate) -> Optional[Portfolio]:
        db = SessionLocal()
        try:
            db_portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            if not db_portfolio:
                return None
            
            if obj_in.name is not None:
                db_portfolio.name = obj_in.name
            if obj_in.description is not None:
                db_portfolio.description = obj_in.description
            
            if obj_in.assets is not None:
                # Delete old assets
                db.query(PortfolioAsset).filter(PortfolioAsset.portfolio_id == portfolio_id).delete()
                # Add new ones
                for asset_in in obj_in.assets:
                    db_asset = PortfolioAsset(
                        portfolio_id=portfolio_id,
                        asset_id=asset_in.asset_id,
                        weight=asset_in.weight
                    )
                    db.add(db_asset)
            
            db.commit()
            db.refresh(db_portfolio)
            return db_portfolio
        finally:
            db.close()

    @staticmethod
    def delete_portfolio(portfolio_id: int) -> bool:
        db = SessionLocal()
        try:
            db_portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            if not db_portfolio:
                return False
            
            db.delete(db_portfolio)
            db.commit()
            return True
        finally:
            db.close()
