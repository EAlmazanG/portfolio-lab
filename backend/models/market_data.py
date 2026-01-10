from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.db.base import Base

class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=True)
    adj_close = Column(Float, nullable=True)

    # Relationship with asset
    asset = relationship("Asset", back_populates="market_data")

    # Ensure uniqueness of date per asset
    __table_args__ = (UniqueConstraint('asset_id', 'date', name='_asset_date_uc'),)

    def __repr__(self):
        return f"<MarketData(asset_id={self.asset_id}, date='{self.date}', close={self.close})>"

