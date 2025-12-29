from sqlalchemy.orm import Session
from backend.models.asset import Asset
from backend.models.market_data import MarketData
from datetime import datetime
import pandas as pd
from typing import List, Optional

def get_asset_by_ticker(db: Session, ticker: str) -> Optional[Asset]:
    """Get an asset by its ticker symbol."""
    return db.query(Asset).filter(Asset.ticker == ticker).first()

def create_asset(db: Session, ticker: str, name: str, asset_type: str, sector: Optional[str] = None) -> Asset:
    """Create a new asset."""
    db_asset = Asset(ticker=ticker, name=name, asset_type=asset_type, sector=sector)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

def get_assets(db: Session) -> List[Asset]:
    """Get all assets."""
    return db.query(Asset).all()

def get_latest_market_data_date(db: Session, asset_id: int) -> Optional[datetime]:
    """Get the latest date of market data for a specific asset."""
    result = db.query(MarketData.date).filter(MarketData.asset_id == asset_id).order_by(MarketData.date.desc()).first()
    return result[0] if result else None

def save_market_data(db: Session, asset_id: int, df: pd.DataFrame):
    """Save market data from a DataFrame to the database."""
    # Convert DataFrame to list of MarketData objects
    market_data_objects = []
    
    for date, row in df.iterrows():
        # Check if record already exists to avoid unique constraint error
        # In a production environment, we might use an upsert operation (ON CONFLICT)
        existing = db.query(MarketData).filter(
            MarketData.asset_id == asset_id,
            MarketData.date == date
        ).first()
        
        if not existing:
            md = MarketData(
                asset_id=asset_id,
                date=date,
                open=float(row['open']),
                high=float(row['high']),
                low=float(row['low']),
                close=float(row['close']),
                volume=float(row['volume']) if pd.notnull(row.get('volume')) else None,
                adj_close=float(row['adj_close']) if pd.notnull(row.get('adj_close')) else None
            )
            market_data_objects.append(md)
    
    if market_data_objects:
        db.bulk_save_objects(market_data_objects)
        db.commit()
        return len(market_data_objects)
    return 0

