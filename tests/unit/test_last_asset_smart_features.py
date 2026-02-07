"""
Test para verificar que el último activo del portfolio recibe smart features correctamente.
Este test reproduce el bug reportado donde las aportaciones del último activo son baseline
aunque tenga smart features activadas.
"""

import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, PropertyMock
from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.models.asset import Asset


class TestLastAssetSmartFeatures(unittest.TestCase):
    """Test que el último activo recibe smart features correctamente."""
    
    def setUp(self):
        """Set up common test fixtures."""
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 12, 31)
        
        # Mock market data: full year with varying prices
        # Prices start at 100, dip to 80 on day 5, then rise to 120 by end of year
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        num_days = len(dates)
        
        # Create price curve: start at 100, dip to 80 around day 5, then rise to 120
        prices = []
        for i in range(num_days):
            if i < 5:
                # Days 0-4: price = 100
                price = 100.0
            elif i < 10:
                # Days 5-9: price dips from 100 to 80 and back
                price = 100.0 - 20.0 * (1 - abs(i - 7) / 2.5)
            else:
                # Days 10+: price rises from 80 to 120
                price = 80.0 + (120.0 - 80.0) * (i - 10) / (num_days - 10)
            prices.append(price)
        
        self.mock_df = pd.DataFrame({
            'open': prices,
            'high': [p * 1.02 for p in prices],
            'low': [p * 0.98 for p in prices],
            'close': prices,
            'adj_close': prices,
        }, index=dates)

    def _get_mock_indicators_with_signals(self, signals: list = None) -> pd.DataFrame:
        """
        Helper to create indicator DataFrame with specific signals.
        
        Args:
            signals: List of signals (-1: oversold/buy more, 0: neutral, 1: overbought/buy less)
                     If None, defaults to all neutral (0)
        """
        df = self.mock_df.copy()
        df['indicator_value'] = 50.0
        if signals is None:
            signals = [0] * len(df)
        # Ensure signals list matches dataframe length
        if len(signals) < len(df):
            signals = signals + [0] * (len(df) - len(signals))
        df['signal'] = signals[:len(df)]
        return df

    @patch('backend.engine.portfolio_simulation_engine.PortfolioSimulationEngine._load_portfolio')
    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_last_asset_receives_smart_timing(self, mock_load_data, mock_load_portfolio):
        """
        Test que el último activo recibe smart timing features correctamente.
        
        Crea un portfolio con 3 activos donde:
        - Asset 1: Smart timing deshabilitado
        - Asset 2: Smart timing deshabilitado
        - Asset 3 (último): Smart timing HABILITADO
        
        Verifica que el asset 3 tiene contribuciones diferentes al baseline.
        """
        # Mock market data
        mock_load_data.return_value = self.mock_df
        
        # Crear mock portfolio con 3 activos
        asset1 = MagicMock(spec=Asset)
        asset1.id = 1
        asset1.ticker = "ASSET1"
        
        asset2 = MagicMock(spec=Asset)
        asset2.id = 2
        asset2.ticker = "ASSET2"
        
        asset3 = MagicMock(spec=Asset)
        asset3.id = 3
        asset3.ticker = "ASSET3"
        
        pa1 = MagicMock(spec=PortfolioAsset)
        pa1.asset_id = 1
        pa1.asset = asset1
        pa1.weight = 1/3
        pa1.current_amount = 0.0
        
        pa2 = MagicMock(spec=PortfolioAsset)
        pa2.asset_id = 2
        pa2.asset = asset2
        pa2.weight = 1/3
        pa2.current_amount = 0.0
        
        pa3 = MagicMock(spec=PortfolioAsset)
        pa3.asset_id = 3
        pa3.asset = asset3
        pa3.weight = 1/3
        pa3.current_amount = 0.0
        
        portfolio = MagicMock(spec=Portfolio)
        portfolio.id = 1
        portfolio.initial_capital = 0.0
        portfolio.assets = [pa1, pa2, pa3]
        
        mock_load_portfolio.return_value = portfolio
        
        # Crear engine
        engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Crear signals: Asset 3 tiene overbought en el primer día de contribución
        # Esto debería causar que el asset 3 difiera del baseline
        signals = [0] * len(self.mock_df)
        signals[0] = 1  # Overbought en el primer día (baseline day)
        
        # Mock indicators para cada asset
        def get_indicators_side_effect(asset_id, start, end):
            indicators = self._get_mock_indicators_with_signals(signals)
            return indicators
        
        # Patch _calculate_indicators para todos los assets
        with patch.object(engine.asset_engines[1], '_calculate_indicators', 
                         return_value=self._get_mock_indicators_with_signals([0] * len(self.mock_df))):
            with patch.object(engine.asset_engines[2], '_calculate_indicators',
                             return_value=self._get_mock_indicators_with_signals([0] * len(self.mock_df))):
                with patch.object(engine.asset_engines[3], '_calculate_indicators',
                                 return_value=self._get_mock_indicators_with_signals(signals)):
                    
                    # Configuración: Asset 3 (último) tiene smart timing habilitado
                    config_baseline = PortfolioSimulationCreate(
                        portfolio_id=1,
                        start_date=self.start_date,
                        end_date=self.end_date,
                        base_amount=1200.0,
                        frequency="monthly",
                        investment_mode="per_contribution",
                        commission_fee_percent=0.0,
                        minimum_fee_per_trade=0.0,
                        maintenance_fee_annual_percent=0.0,
                        rebalancing_enabled=False,
                        asset_configs={
                            1: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                            2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                            3: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                        }
                    )
                    
                    config_smart = PortfolioSimulationCreate(
                        portfolio_id=1,
                        start_date=self.start_date,
                        end_date=self.end_date,
                        base_amount=1200.0,
                        frequency="monthly",
                        investment_mode="per_contribution",
                        commission_fee_percent=0.0,
                        minimum_fee_per_trade=0.0,
                        maintenance_fee_annual_percent=0.0,
                        rebalancing_enabled=False,
                        asset_configs={
                            1: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                            2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                            3: AssetSimulationConfig(
                                dynamic_timing_enabled=True,
                                dynamic_sizing_enabled=False,
                                smart_indicator="RSI",
                                expensive_buy_ratio=0.5
                            ),
                        }
                    )
                    
                    # Ejecutar simulaciones
                    result_baseline = engine.run_simulation(config_baseline)
                    
                    # Crear nuevo engine para smart (para evitar estado compartido)
                    engine2 = PortfolioSimulationEngine(1, self.start_date, self.end_date)
                    with patch.object(engine2.asset_engines[1], '_calculate_indicators',
                                     return_value=self._get_mock_indicators_with_signals([0] * len(self.mock_df))):
                        with patch.object(engine2.asset_engines[2], '_calculate_indicators',
                                         return_value=self._get_mock_indicators_with_signals([0] * len(self.mock_df))):
                            with patch.object(engine2.asset_engines[3], '_calculate_indicators',
                                             return_value=self._get_mock_indicators_with_signals(signals)):
                                result_smart = engine2.run_simulation(config_smart)
                    
                    # Verificar que el último activo (asset 3) tiene diferentes ROI debido al timing
                    last_asset_baseline = result_baseline['asset_results'][2]  # Índice 2 = asset 3
                    last_asset_smart = result_smart['asset_results'][2]
                    
                    print(f"\nAsset 3 (último activo):")
                    print(f"  Baseline invested: ${last_asset_baseline['total_invested']:.2f}")
                    print(f"  Smart invested: ${last_asset_smart['total_invested']:.2f}")
                    print(f"  Baseline final value: ${last_asset_baseline['final_value']:.2f}")
                    print(f"  Smart final value: ${last_asset_smart['final_value']:.2f}")
                    print(f"  Baseline ROI: {last_asset_baseline['total_return_percent']:.2f}%")
                    print(f"  Smart ROI: {last_asset_smart['total_return_percent']:.2f}%")
                    
                    # El asset 3 debe tener diferente ROI cuando smart timing está habilitado
                    # (aunque el total invertido sea igual, el timing afecta el ROI)
                    self.assertNotEqual(
                        last_asset_baseline['total_return_percent'],
                        last_asset_smart['total_return_percent'],
                        f"Asset 3 (último) debe tener diferente ROI con smart timing. "
                        f"Baseline ROI: {last_asset_baseline['total_return_percent']:.2f}%, "
                        f"Smart ROI: {last_asset_smart['total_return_percent']:.2f}%"
                    )


if __name__ == "__main__":
    unittest.main()
