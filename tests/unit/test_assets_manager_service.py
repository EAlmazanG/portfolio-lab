import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

import pandas as pd

from backend.schemas.assets_manager import (
    AssetManagerSettings,
    AssetCreateRequest,
    AssetManagerListItem,
)
from backend.services.assets_manager_service import AssetsManagerService


class TestAssetsManagerService(unittest.TestCase):
    def test_update_settings_updates_crud(self):
        payload = AssetManagerSettings(ingestion_years=15, ingestion_interval="1wk")

        with patch("backend.services.assets_manager_service.SessionLocal") as mock_session, \
             patch("backend.services.assets_manager_service.crud.update_setting") as mock_update:
            mock_db = MagicMock()
            mock_session.return_value = mock_db

            result = AssetsManagerService.update_settings(payload)

            self.assertEqual(result.ingestion_years, 15)
            self.assertEqual(result.ingestion_interval, "1wk")
            mock_update.assert_any_call(
                mock_db,
                "ingestion_years",
                "15",
                "Years of history to download for new assets",
            )
            mock_update.assert_any_call(
                mock_db,
                "ingestion_interval",
                "1wk",
                "Historical data interval",
            )

    def test_search_assets_maps_results(self):
        mock_results = [
            {
                "symbol": "AAPL",
                "longname": "Apple Inc.",
                "quoteType": "EQUITY",
                "exchange": "NASDAQ",
                "currency": "USD",
                "sector": "Technology",
            }
        ]

        with patch("backend.services.assets_manager_service.YahooFinanceClient") as mock_client:
            mock_client.return_value.search_assets.return_value = mock_results
            results = AssetsManagerService.search_assets("Apple")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].ticker, "AAPL")
        self.assertEqual(results[0].name, "Apple Inc.")
        self.assertEqual(results[0].quote_type, "EQUITY")

    def test_create_asset_downloads_history(self):
        payload = AssetCreateRequest(
            ticker="AAPL",
            download_history=True,
            download_years=2,
            download_interval="1d",
        )

        mock_asset = MagicMock()
        mock_asset.id = 42
        mock_asset.ticker = "AAPL"
        mock_asset.name = "Apple"
        mock_asset.asset_type = "stock"
        mock_asset.interval = "1d"
        mock_asset.sector = "Tech"
        mock_asset.is_active = True

        mock_item = AssetManagerListItem(
            id=42,
            ticker="AAPL",
            name="Apple",
            asset_type="stock",
            interval="1d",
            sector="Tech",
            is_active=True,
            min_date=None,
            max_date=None,
            record_count=0,
        )

        with patch("backend.services.assets_manager_service.SessionLocal") as mock_session, \
             patch("backend.services.assets_manager_service.crud.get_asset_by_ticker", return_value=None), \
             patch("backend.services.assets_manager_service.crud.create_asset", return_value=mock_asset), \
             patch("backend.services.assets_manager_service.crud.save_market_data", return_value=5), \
             patch("backend.services.assets_manager_service.AssetsManagerService._build_asset_item", return_value=mock_item), \
             patch("backend.services.assets_manager_service.YahooFinanceClient") as mock_client:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_client.return_value.get_asset_info.return_value = {
                "longName": "Apple",
                "quoteType": "stock",
                "sector": "Tech",
            }
            mock_client.return_value.get_historical_data.return_value = pd.DataFrame(
                {"open": [1], "high": [1], "low": [1], "close": [1], "volume": [1], "adj_close": [1]},
                index=[datetime(2023, 1, 1)],
            )

            result = AssetsManagerService.create_asset(payload)

        self.assertEqual(result.downloaded_records, 5)
        self.assertEqual(result.asset.ticker, "AAPL")

    def test_delete_asset_raises_when_missing(self):
        with patch("backend.services.assets_manager_service.SessionLocal") as mock_session, \
             patch("backend.services.assets_manager_service.crud.delete_asset", return_value=False):
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            with self.assertRaises(ValueError):
                AssetsManagerService.delete_asset(999)


if __name__ == "__main__":
    unittest.main()
