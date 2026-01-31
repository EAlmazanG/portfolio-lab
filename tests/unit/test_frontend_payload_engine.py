"""
Test que simula el payload exacto del frontend (Object.fromEntries) y verifica
que el engine aplica smart features al último activo.
"""

import unittest
import json
from datetime import datetime
from unittest.mock import MagicMock, patch
import pandas as pd

from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.models.asset import Asset


class TestFrontendPayloadEngine(unittest.TestCase):
    def setUp(self):
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 12, 31)
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        prices = []
        for i in range(len(dates)):
            if i < 5:
                price = 100.0
            elif i < 10:
                price = 100.0 - 20.0 * (1 - abs(i - 7) / 2.5)
            else:
                price = 80.0 + (120.0 - 80.0) * (i - 10) / (len(dates) - 10)
            prices.append(price)

        self.mock_df = pd.DataFrame({
            "open": prices,
            "high": [p * 1.02 for p in prices],
            "low": [p * 0.98 for p in prices],
            "close": prices,
            "adj_close": prices,
            "indicator_value": [50.0] * len(dates),
            "signal": [0] * len(dates),
        }, index=dates)
        # force overbought on first baseline day
        self.mock_df.iloc[0, self.mock_df.columns.get_loc("signal")] = 1

    @patch("backend.engine.portfolio_simulation_engine.PortfolioSimulationEngine._load_portfolio")
    @patch("backend.engine.simulation_engine.SimulationEngine._load_market_data")
    def test_last_asset_from_frontend_payload(self, mock_load_data, mock_load_portfolio):
        mock_load_data.return_value = self.mock_df

        asset1 = MagicMock(spec=Asset)
        asset1.id = 1
        asset1.ticker = "A1"
        asset2 = MagicMock(spec=Asset)
        asset2.id = 2
        asset2.ticker = "A2"
        asset3 = MagicMock(spec=Asset)
        asset3.id = 3
        asset3.ticker = "A3"

        pa1 = MagicMock(spec=PortfolioAsset)
        pa1.asset_id = 1
        pa1.asset = asset1
        pa1.weight = 1 / 3
        pa1.current_amount = 0.0
        pa2 = MagicMock(spec=PortfolioAsset)
        pa2.asset_id = 2
        pa2.asset = asset2
        pa2.weight = 1 / 3
        pa2.current_amount = 0.0
        pa3 = MagicMock(spec=PortfolioAsset)
        pa3.asset_id = 3
        pa3.asset = asset3
        pa3.weight = 1 / 3
        pa3.current_amount = 0.0

        portfolio = MagicMock(spec=Portfolio)
        portfolio.id = 1
        portfolio.initial_capital = 0.0
        portfolio.assets = [pa1, pa2, pa3]
        mock_load_portfolio.return_value = portfolio

        # Simulate frontend payload: Object.fromEntries + JSON serialization
        frontend_payload = {
            "portfolio_id": 1,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "base_amount": 1200.0,
            "frequency": "monthly",
            "asset_configs": {
                "1": {"dynamic_timing_enabled": False, "dynamic_sizing_enabled": False},
                "2": {"dynamic_timing_enabled": False, "dynamic_sizing_enabled": False},
                "3": {
                    "dynamic_timing_enabled": True,
                    "dynamic_sizing_enabled": False,
                    "smart_indicator": "RSI",
                    "expensive_buy_ratio": 0.5,
                },
            },
        }
        # mimic HTTP JSON round-trip
        frontend_payload = json.loads(json.dumps(frontend_payload))

        config = PortfolioSimulationCreate(**frontend_payload)

        engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        with patch.object(engine.asset_engines[1], "_calculate_indicators", return_value=self.mock_df):
            with patch.object(engine.asset_engines[2], "_calculate_indicators", return_value=self.mock_df):
                with patch.object(engine.asset_engines[3], "_calculate_indicators", return_value=self.mock_df):
                    result_smart = engine.run_simulation(config)

        # Baseline config (no smart features)
        baseline_payload = {**frontend_payload}
        baseline_payload["asset_configs"] = {
            "1": {"dynamic_timing_enabled": False, "dynamic_sizing_enabled": False},
            "2": {"dynamic_timing_enabled": False, "dynamic_sizing_enabled": False},
            "3": {"dynamic_timing_enabled": False, "dynamic_sizing_enabled": False},
        }
        baseline_payload = json.loads(json.dumps(baseline_payload))
        baseline_config = PortfolioSimulationCreate(**baseline_payload)

        engine_baseline = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        with patch.object(engine_baseline.asset_engines[1], "_calculate_indicators", return_value=self.mock_df):
            with patch.object(engine_baseline.asset_engines[2], "_calculate_indicators", return_value=self.mock_df):
                with patch.object(engine_baseline.asset_engines[3], "_calculate_indicators", return_value=self.mock_df):
                    result_baseline = engine_baseline.run_simulation(baseline_config)

        last_asset_smart = result_smart["asset_results"][2]
        last_asset_baseline = result_baseline["asset_results"][2]
        self.assertNotEqual(
            last_asset_smart["total_return_percent"],
            last_asset_baseline["total_return_percent"],
            "Expected last asset ROI to differ when smart timing applies",
        )


if __name__ == "__main__":
    unittest.main()
