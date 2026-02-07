"""Service for managing assets via the Assets Manager UI."""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from sqlalchemy import func

from backend.db.session import SessionLocal
from backend.db import crud
from backend.data_ingestion.yfinance_client import YahooFinanceClient
from backend.models.asset import Asset
from backend.models.market_data import MarketData
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


class AssetsManagerService:
    """Service layer for asset management."""

    @staticmethod
    def _build_asset_item(db, asset: Asset) -> AssetManagerListItem:
        stats = db.query(
            func.count(MarketData.id).label("count"),
            func.min(MarketData.date).label("min_date"),
            func.max(MarketData.date).label("max_date"),
        ).filter(MarketData.asset_id == asset.id).one()

        min_date = stats.min_date.strftime("%Y-%m-%d") if stats.min_date else None
        max_date = stats.max_date.strftime("%Y-%m-%d") if stats.max_date else None

        return AssetManagerListItem(
            id=asset.id,
            ticker=asset.ticker,
            name=asset.name,
            asset_type=asset.asset_type,
            interval=asset.interval,
            sector=asset.sector,
            is_active=bool(asset.is_active),
            min_date=min_date,
            max_date=max_date,
            record_count=int(stats.count or 0),
        )

    @staticmethod
    def list_assets() -> List[AssetManagerListItem]:
        db = SessionLocal()
        try:
            assets = db.query(Asset).order_by(Asset.ticker.asc()).all()
            return [AssetsManagerService._build_asset_item(db, asset) for asset in assets]
        finally:
            db.close()

    @staticmethod
    def get_settings() -> AssetManagerSettings:
        db = SessionLocal()
        try:
            years = int(crud.get_setting(db, "ingestion_years", "10"))
            interval = crud.get_setting(db, "ingestion_interval", "1d")
            return AssetManagerSettings(ingestion_years=years, ingestion_interval=interval)
        finally:
            db.close()

    @staticmethod
    def update_settings(payload: AssetManagerSettings) -> AssetManagerSettings:
        db = SessionLocal()
        try:
            crud.update_setting(
                db,
                "ingestion_years",
                str(payload.ingestion_years),
                "Years of history to download for new assets",
            )
            crud.update_setting(
                db,
                "ingestion_interval",
                payload.ingestion_interval,
                "Historical data interval",
            )
            return AssetManagerSettings(
                ingestion_years=payload.ingestion_years,
                ingestion_interval=payload.ingestion_interval,
            )
        finally:
            db.close()

    @staticmethod
    def search_assets(query: str) -> List[AssetSearchResult]:
        client = YahooFinanceClient()
        results = client.search_assets(query)
        mapped = []
        for item in results or []:
            name = item.get("longname") or item.get("shortname") or item.get("symbol") or "Unknown"
            mapped.append(
                AssetSearchResult(
                    ticker=item.get("symbol") or "",
                    name=name,
                    quote_type=item.get("quoteType"),
                    exchange=item.get("exchange"),
                    currency=item.get("currency"),
                    sector=item.get("sector"),
                )
            )
        return mapped

    @staticmethod
    def get_asset_info(ticker: str) -> Dict[str, Any]:
        client = YahooFinanceClient()
        return client.get_asset_info(ticker)

    @staticmethod
    def create_asset(payload: AssetCreateRequest) -> AssetCreateResponse:
        db = SessionLocal()
        try:
            existing = crud.get_asset_by_ticker(db, payload.ticker)
            if existing:
                raise ValueError(f"Asset {payload.ticker} already exists.")

            client = YahooFinanceClient()
            info = client.get_asset_info(payload.ticker)

            name = payload.name or info.get("longName") or info.get("shortName") or payload.ticker
            asset_type = (payload.asset_type or info.get("quoteType") or "stock").lower()
            sector = payload.sector or info.get("sector")

            interval = payload.download_interval or crud.get_setting(db, "ingestion_interval", "1d")
            asset = crud.create_asset(db, payload.ticker, name, asset_type, sector)
            asset.interval = interval
            db.commit()

            downloaded = 0
            if payload.download_history:
                years = payload.download_years or int(crud.get_setting(db, "ingestion_years", "10"))
                start_date = datetime.now(timezone.utc) - timedelta(days=years * 365)
                df = client.get_historical_data(payload.ticker, start_date=start_date, interval=interval)
                if not df.empty:
                    downloaded = crud.save_market_data(db, asset.id, df)

            return AssetCreateResponse(
                asset=AssetsManagerService._build_asset_item(db, asset),
                downloaded_records=downloaded,
            )
        finally:
            db.close()

    @staticmethod
    def delete_asset(asset_id: int):
        db = SessionLocal()
        try:
            success = crud.delete_asset(db, asset_id)
            if not success:
                raise ValueError("Asset not found")
        finally:
            db.close()

    @staticmethod
    def download_asset_history(asset_id: int, payload: AssetDownloadRequest) -> AssetDownloadResponse:
        db = SessionLocal()
        try:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if not asset:
                raise ValueError("Asset not found")

            interval = payload.interval or asset.interval or crud.get_setting(db, "ingestion_interval", "1d")
            client = YahooFinanceClient()

            start_date = payload.start_date
            end_date = payload.end_date
            period = payload.period or "max"

            if payload.years:
                start_date = datetime.now(timezone.utc) - timedelta(days=payload.years * 365)

            df = client.get_historical_data(
                asset.ticker,
                start_date=start_date,
                end_date=end_date,
                period=period,
                interval=interval,
            )
            if df.empty:
                return AssetDownloadResponse(saved_records=0)

            saved = crud.save_market_data(db, asset.id, df)
            return AssetDownloadResponse(saved_records=saved)
        finally:
            db.close()

    @staticmethod
    def update_all_assets() -> UpdateAllAssetsResponse:
        db = SessionLocal()
        try:
            assets = crud.get_assets(db)
            if not assets:
                return UpdateAllAssetsResponse(assets_updated=0, records_saved=0)

            years = int(crud.get_setting(db, "ingestion_years", "10"))
            interval = crud.get_setting(db, "ingestion_interval", "1d")
            client = YahooFinanceClient()

            total_assets_updated = 0
            total_records_saved = 0
            today = datetime.now(timezone.utc).date()

            for asset in assets:
                latest_date = db.query(func.max(MarketData.date)).filter(MarketData.asset_id == asset.id).scalar()
                earliest_date = db.query(func.min(MarketData.date)).filter(MarketData.asset_id == asset.id).scalar()

                target_start_date = datetime.now(timezone.utc) - timedelta(days=years * 365)

                if earliest_date and earliest_date.replace(tzinfo=timezone.utc) > target_start_date:
                    df_back = client.get_historical_data(
                        asset.ticker,
                        start_date=target_start_date,
                        end_date=earliest_date,
                        interval=interval,
                    )
                    if not df_back.empty:
                        total_records_saved += crud.save_market_data(db, asset.id, df_back)

                if latest_date:
                    last_date = latest_date.date() if hasattr(latest_date, "date") else latest_date
                    start_date = latest_date + timedelta(days=1)

                    if last_date < today:
                        df = client.get_historical_data(
                            asset.ticker,
                            start_date=start_date,
                            interval=interval,
                        )
                        if not df.empty:
                            total_records_saved += crud.save_market_data(db, asset.id, df)
                            total_assets_updated += 1
                else:
                    df = client.get_historical_data(
                        asset.ticker,
                        start_date=target_start_date,
                        interval=interval,
                    )
                    if not df.empty:
                        total_records_saved += crud.save_market_data(db, asset.id, df)
                        total_assets_updated += 1

            return UpdateAllAssetsResponse(
                assets_updated=total_assets_updated,
                records_saved=total_records_saved,
            )
        finally:
            db.close()
