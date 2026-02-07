import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from backend.engine.simulation_engine import SimulationEngine

class TestSimulationInitialValue(unittest.TestCase):
    def setUp(self):
        self.asset_id = 1
        self.start_date = datetime(2021, 1, 1)
        self.end_date = datetime(2021, 1, 10)
        
        # Mock market data: First day has 0 price (holiday/error), second day has real price
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        self.mock_df = pd.DataFrame({
            'open': [0.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0],
            'high': [0.0, 105.0, 106.0, 107.0, 108.0, 109.0, 110.0, 111.0, 112.0, 113.0],
            'low': [0.0, 95.0, 96.0, 97.0, 98.0, 99.0, 100.0, 101.0, 102.0, 103.0],
            'close': [0.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0],
            'adj_close': [0.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0],
            'indicator_value': [None] * 10,
            'signal': [0] * 10
        }, index=dates)

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_initial_value_not_zero(self, mock_load):
        mock_load.return_value = self.mock_df
        
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        # Manually inject indicator_df since we are testing run_baseline_dca
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=self.mock_df):
            result = engine.run_baseline_dca(
                base_amount=100,
                frequency='monthly',
                initial_capital=1000,
                investment_mode='per_contribution'
            )
            
            # Check the first entry in portfolio_history
            first_entry = result.portfolio_history[0]
            print(f"First entry date: {first_entry['date']}, price: {first_entry['price']}, value: {first_entry['baseline_value']}")
            
            self.assertGreater(first_entry['price'], 0, "Initial price should not be 0")
            self.assertGreater(first_entry['baseline_value'], 0, "Initial baseline value should not be 0")
            self.assertGreater(first_entry['smart_value'], 0, "Initial smart value should not be 0")

if __name__ == '__main__':
    unittest.main()
