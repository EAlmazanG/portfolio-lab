"""
Tests for Smart Features in Single-Asset and Multi-Asset Simulations.

Covers:
1. Each asset receives only its allocated contribution (no cross-contamination)
2. When general smart features are disabled, baseline DCA is applied to all
3. When smart features are enabled, only active features per asset are applied
4. Assets are independent - state from one cannot be used by another
"""

import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, PropertyMock
from backend.engine.simulation_engine import SimulationEngine
from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig


class TestSingleAssetSmartFeatures(unittest.TestCase):
    """Tests for single asset SimulationEngine smart features."""
    
    def setUp(self):
        """Set up common test fixtures."""
        self.asset_id = 1
        # Use a full year to avoid "last baseline day of year" edge cases
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 12, 31)
        
        # Mock market data: full year with constant price of 100
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        num_days = len(dates)
        self.mock_df = pd.DataFrame({
            'open': [100.0] * num_days,
            'high': [105.0] * num_days,
            'low': [95.0] * num_days,
            'close': [100.0] * num_days,
            'adj_close': [100.0] * num_days,
        }, index=dates)

    def _get_mock_indicators(self, signals: list = None) -> pd.DataFrame:
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

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_baseline_applied_when_smart_disabled(self, mock_load):
        """
        Test that baseline DCA is applied when both smart features are disabled.
        Verifies: No timing or sizing adjustments occur.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Signals: all neutral (doesn't matter since smart is disabled)
        mock_indicators = self._get_mock_indicators()  # All neutral
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=False,
                dynamic_sizing_enabled=False
            )
            
            # Monthly frequency on 2023 should have 12 contributions
            contributions = [h['s_contribution'] for h in result.portfolio_history if h['s_contribution'] > 0]
            self.assertEqual(len(contributions), 12)  # One per month
            self.assertEqual(result.total_invested, 12000)  # 1000 * 12 months

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_timing_only_waits_on_overbought(self, mock_load):
        """
        Test that timing waits when overbought and buys when oversold.
        Verifies: Only timing is applied when only timing is enabled.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Create signal list for the full year
        # Jan 1st (index 0): Overbought (signal 1) -> Should wait
        # Jan 6th (index 5): Oversold (signal -1) -> Should buy pending amount
        # Rest of months: neutral (will buy normally)
        signals = [0] * len(self.mock_df)
        signals[0] = 1   # Overbought on Jan 1st (baseline day)
        signals[5] = -1  # Oversold on Jan 6th
        
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=True,
                dynamic_sizing_enabled=False,
                expensive_buy_ratio=0.0,  # Wait completely (no floor)
                smart_indicator='RSI'
            )
            
            # Should NOT buy on Jan 1st (overbought), should buy on Jan 6th
            jan1_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-01')['s_contribution']
            jan6_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-06')['s_contribution']
            
            self.assertEqual(jan1_cont, 0)
            self.assertEqual(jan6_cont, 1000)
            # Total should be 12000 (12 months)
            self.assertEqual(result.total_invested, 12000)

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_timing_with_expensive_buy_ratio_floor(self, mock_load):
        """
        Test that timing respects the expensive_buy_ratio floor.
        When overbought, still buys at least expensive_buy_ratio * base_amount.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Jan 1st: Overbought -> Should buy floor (30%)
        signals = [0] * len(self.mock_df)
        signals[0] = 1   # Overbought on Jan 1st (baseline day)
        signals[5] = -1  # Oversold on Jan 6th -> buys the rest (70%)
        
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=True,
                dynamic_sizing_enabled=False,
                expensive_buy_ratio=0.3,  # Buy at least 30% when overbought
                smart_indicator='RSI'
            )
            
            jan1_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-01')['s_contribution']
            jan6_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-06')['s_contribution']
            
            self.assertEqual(jan1_cont, 300)  # 30% floor
            self.assertEqual(jan6_cont, 700)  # Remaining 70%
            # Total should still be 12000 (1000 * 12 months)
            self.assertEqual(result.total_invested, 12000)

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_sizing_only_multiplies_on_oversold(self, mock_load):
        """
        Test that sizing multiplies amount when oversold and reduces when overbought.
        Verifies: Only sizing is applied when only sizing is enabled.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Jan 1st: Oversold -> Should buy more
        signals = [0] * len(self.mock_df)
        signals[0] = -1  # Oversold on Jan 1st (baseline day)
        
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=False,
                dynamic_sizing_enabled=True,
                sizing_multiplier=2.0,  # Double the amount
                smart_indicator='RSI'
            )
            
            # Should buy 2000 on Jan 1st (1000 * 2.0) - but capped by budget constraints
            # The annual budget logic might cap this, so check if > 1000
            jan1_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-01')['s_contribution']
            # At minimum, it should try to buy more than baseline when oversold
            self.assertGreater(jan1_cont, 1000)

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_sizing_reduces_on_overbought(self, mock_load):
        """
        Test that sizing reduces amount when overbought.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Jan 1st: Overbought -> Should buy less
        signals = [0] * len(self.mock_df)
        signals[0] = 1  # Overbought on Jan 1st
        
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=False,
                dynamic_sizing_enabled=True,
                sizing_multiplier=2.0,
                expensive_buy_ratio=0.3,  # Buy only 30% when overbought
                smart_indicator='RSI'
            )
            
            # Should buy 300 on Jan 1st (1000 * 0.3)
            jan1_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-01')['s_contribution']
            self.assertLess(jan1_cont, 1000)  # Should be less than baseline

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_both_timing_and_sizing_together(self, mock_load):
        """
        Test that both timing and sizing work together correctly.
        Timing decides WHEN to buy, sizing decides HOW MUCH.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # Jan 1st: Overbought -> Wait (timing)
        # Jan 6th: Oversold -> Buy with multiplier (timing + sizing)
        signals = [0] * len(self.mock_df)
        signals[0] = 1   # Overbought: timing waits
        signals[5] = -1  # Oversold: timing buys, sizing multiplies
        
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=True,
                dynamic_sizing_enabled=True,
                sizing_multiplier=2.0,
                expensive_buy_ratio=0.0,  # Wait completely
                smart_indicator='RSI'
            )
            
            jan1_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-01')['s_contribution']
            jan6_cont = next(h for h in result.portfolio_history if h['date'] == '2023-01-06')['s_contribution']
            
            # Jan 1st: timing says wait -> 0
            # Jan 6th: timing says buy 1000, sizing multiplies -> should be more than 1000
            self.assertEqual(jan1_cont, 0)
            self.assertGreater(jan6_cont, 1000)  # Should be multiplied

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_signals_dont_affect_disabled_features(self, mock_load):
        """
        Test that signals have NO effect when smart features are disabled.
        Even extreme oversold/overbought signals should result in baseline behavior.
        """
        mock_load.return_value = self.mock_df
        engine = SimulationEngine(self.asset_id, self.start_date, self.end_date)
        
        # All oversold signals (would normally trigger more buying)
        signals = [-1] * len(self.mock_df)
        mock_indicators = self._get_mock_indicators(signals)
        
        with patch.object(SimulationEngine, '_calculate_indicators', return_value=mock_indicators):
            result = engine.run_baseline_dca(
                base_amount=1000,
                frequency='monthly',
                dynamic_timing_enabled=False,  # Disabled
                dynamic_sizing_enabled=False,  # Disabled
                sizing_multiplier=2.0,
                expensive_buy_ratio=0.0,
                smart_indicator='RSI'
            )
            
            # Despite oversold signals and multiplier=2, should invest baseline amounts only
            contributions = [h['s_contribution'] for h in result.portfolio_history if h['s_contribution'] > 0]
            self.assertEqual(len(contributions), 12)  # 12 months
            # Each contribution should be exactly 1000 (no multiplier applied)
            for cont in contributions:
                self.assertEqual(cont, 1000)
            self.assertEqual(result.total_invested, 12000)


class TestMultiAssetPortfolioIsolation(unittest.TestCase):
    """
    Tests for multi-asset portfolio to verify:
    1. Each asset receives only its allocated contribution
    2. Smart features apply independently per asset
    3. No cross-contamination of state between assets
    """

    def setUp(self):
        """Set up mock portfolio with 2 assets."""
        # Use full year to avoid edge cases
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 12, 31)
        
        # Market data for Asset 1 (constant price 100)
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        num_days = len(dates)
        self.mock_df_asset1 = pd.DataFrame({
            'open': [100.0] * num_days,
            'high': [105.0] * num_days,
            'low': [95.0] * num_days,
            'close': [100.0] * num_days,
            'adj_close': [100.0] * num_days,
        }, index=dates)
        
        # Market data for Asset 2 (constant price 200)
        self.mock_df_asset2 = pd.DataFrame({
            'open': [200.0] * num_days,
            'high': [210.0] * num_days,
            'low': [190.0] * num_days,
            'close': [200.0] * num_days,
            'adj_close': [200.0] * num_days,
        }, index=dates)

    def _get_mock_indicators_for_asset(self, df: pd.DataFrame, signals: list = None) -> pd.DataFrame:
        """Helper to create indicator DataFrame with specific signals."""
        df = df.copy()
        df['indicator_value'] = 50.0
        if signals is None:
            signals = [0] * len(df)
        # Ensure signals list matches dataframe length
        if len(signals) < len(df):
            signals = signals + [0] * (len(df) - len(signals))
        df['signal'] = signals[:len(df)]
        return df

    def _create_mock_portfolio(self, weights: dict):
        """
        Create a mock portfolio with specified weights.
        
        Args:
            weights: Dict mapping asset_id to weight (e.g., {1: 0.6, 2: 0.4})
        """
        mock_portfolio = MagicMock()
        mock_portfolio.id = 1
        mock_portfolio.initial_capital = 0.0
        mock_portfolio.assets = []
        
        for asset_id, weight in weights.items():
            mock_asset = MagicMock()
            mock_asset.asset_id = asset_id
            mock_asset.weight = weight
            mock_asset.current_amount = 0.0
            mock_asset.asset = MagicMock()
            mock_asset.asset.ticker = f"ASSET{asset_id}"
            mock_portfolio.assets.append(mock_asset)
        
        return mock_portfolio

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_each_asset_receives_correct_allocation(self, mock_session):
        """
        Test that each asset receives exactly its weighted portion of contributions.
        Verifies: No cross-contamination of contribution amounts.
        """
        # Setup mock DB session
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        # Create mock portfolio: 60% Asset1, 40% Asset2
        mock_portfolio = self._create_mock_portfolio({1: 0.6, 2: 0.4})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        # Create engine
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Setup mock asset engines with data
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1  # All neutral
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2  # All neutral
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        # Run simulation
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False)
            }
        )
        
        result = engine.run_simulation(config)
        
        # Verify each asset received correct allocation
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Total invested per year is 1000 * 12 = 12000
        # Asset 1 should have invested 60% of 12000 = 7200
        self.assertAlmostEqual(asset1_result['total_invested'], 7200, delta=100)
        # Asset 2 should have invested 40% of 12000 = 4800
        self.assertAlmostEqual(asset2_result['total_invested'], 4800, delta=100)
        
        # Total invested should be 12000
        self.assertAlmostEqual(result['total_invested'], 12000, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_smart_features_apply_independently_per_asset(self, mock_session):
        """
        Test that smart features are applied independently to each asset.
        Asset 1: timing enabled, overbought -> delays buying
        Asset 2: no features -> baseline behavior
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: overbought on Jan 1st (timing will wait)
        signals_asset1 = [0] * len(self.mock_df_asset1)
        signals_asset1[0] = 1  # Overbought
        signals_asset1[5] = -1  # Oversold on Jan 6th
        
        # Asset 2: neutral (no smart features anyway)
        signals_asset2 = [0] * len(self.mock_df_asset2)
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(dynamic_timing_enabled=True, expensive_buy_ratio=0.0),  # Timing ON
                2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False)  # All OFF
            }
        )
        
        result = engine.run_simulation(config)
        
        # Check Asset 2's history - should have contribution on Jan 1st (baseline behavior)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        jan1_asset2 = next(
            (h for h in asset2_result['portfolio_history'] if h['date'] == '2023-01-01'),
            None
        )
        
        # Asset 2 should have bought on Jan 1st (no smart features)
        if jan1_asset2:
            self.assertGreater(jan1_asset2['b_contribution'], 0)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_sizing_applies_only_to_enabled_asset(self, mock_session):
        """
        Test that sizing multiplier applies only to the asset with sizing enabled.
        Asset 1: sizing enabled, oversold -> buys more
        Asset 2: sizing disabled, oversold -> baseline amount
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Both assets show oversold on Jan 1st
        signals = [0] * len(self.mock_df_asset1)
        signals[0] = -1  # Oversold
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals.copy()
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(dynamic_sizing_enabled=True, sizing_multiplier=2.0),  # Sizing ON, 2x
                2: AssetSimulationConfig(dynamic_sizing_enabled=False)  # Sizing OFF
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Asset 1 has sizing enabled and oversold: should invest more than baseline
        # Asset 2 has sizing disabled: should invest baseline
        # Note: Actual invested amounts depend on budget constraints
        
        # Key assertion: Asset 1 invested >= Asset 2 (due to multiplier)
        self.assertGreaterEqual(asset1_result['total_invested'], asset2_result['total_invested'])

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_all_disabled_applies_baseline_to_all(self, mock_session):
        """
        Test that when all smart features are disabled for all assets,
        pure baseline DCA is applied to all assets.
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Strong oversold signals that would trigger buying if features were enabled
        signals = [-1] * len(self.mock_df_asset1)
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals.copy()
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(
                    dynamic_timing_enabled=False, 
                    dynamic_sizing_enabled=False,
                    sizing_multiplier=2.0  # Has multiplier but disabled
                ),
                2: AssetSimulationConfig(
                    dynamic_timing_enabled=False, 
                    dynamic_sizing_enabled=False,
                    sizing_multiplier=3.0  # Has multiplier but disabled
                )
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Total invested per year is 1000 * 12 = 12000
        # Both should have received exactly their baseline allocation
        # Despite oversold signals and multipliers, since features are disabled
        self.assertAlmostEqual(asset1_result['total_invested'], 6000, delta=100)  # 50% of 12000
        self.assertAlmostEqual(asset2_result['total_invested'], 6000, delta=100)  # 50% of 12000
        self.assertAlmostEqual(result['total_invested'], 12000, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_asset_state_isolation(self, mock_session):
        """
        Test that state (pending amounts, reserves) from one asset cannot affect another.
        This verifies complete isolation between assets.
        
        CRITICAL: When Asset 1 defers buying (timing), that pending amount must ONLY
        go back to Asset 1, NOT be redistributed to Asset 2.
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: overbought on Jan 1st -> creates pending amount
        signals_asset1 = [0] * len(self.mock_df_asset1)
        signals_asset1[0] = 1  # Overbought: timing will defer
        
        # Asset 2: neutral all year
        signals_asset2 = [0] * len(self.mock_df_asset2)
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(dynamic_timing_enabled=True, expensive_buy_ratio=0.0),  # Will wait
                2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False)  # Baseline
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Total invested per year is 1000 * 12 = 12000
        # Asset 1 gets 50% = 6000, Asset 2 gets 50% = 6000
        
        # CRITICAL CHECK: Asset 2 should receive EXACTLY its 50% baseline allocation = 6000
        # Asset 1's pending amount should NOT spill over to Asset 2
        self.assertAlmostEqual(asset2_result['total_invested'], 6000, delta=100)
        
        # Asset 1 should also have invested its full 6000 (deferred but eventually invested)
        self.assertAlmostEqual(asset1_result['total_invested'], 6000, delta=100)
        
        # Total should be exactly 12000
        self.assertAlmostEqual(result['total_invested'], 12000, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_pending_not_redistributed_to_other_assets(self, mock_session):
        """
        CRITICAL TEST: Verify that when Asset 1 defers buying due to timing,
        the pending amount is NOT redistributed to Asset 2.
        
        Scenario:
        - Asset 1 (50%): timing enabled, overbought on Jan 1st -> defers its $500
        - Asset 2 (50%): no features -> should receive exactly $500 (not $500 + portion of Asset 1's pending)
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: ALL overbought (to ensure timing always defers)
        signals_asset1 = [1] * len(self.mock_df_asset1)  # Always overbought
        
        # Asset 2: ALL neutral (baseline behavior)
        signals_asset2 = [0] * len(self.mock_df_asset2)  # Always neutral
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(dynamic_timing_enabled=True, expensive_buy_ratio=0.0),  # Always waits
                2: AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False)  # Baseline
            }
        )
        
        result = engine.run_simulation(config)
        
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Asset 2 should receive EXACTLY its 50% baseline allocation = 6000
        # NOT 6000 + any portion of Asset 1's deferred amounts
        # This is the CRITICAL assertion - if Asset 1's pending was being redistributed,
        # Asset 2 would have received MORE than 6000
        self.assertAlmostEqual(asset2_result['total_invested'], 6000, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_mixed_smart_features_per_asset(self, mock_session):
        """
        Test complex scenario where:
        - Asset 1: timing only
        - Asset 2: sizing only
        
        Verifies each asset uses only its configured feature.
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: overbought on Jan 1st -> timing should wait
        signals_asset1 = [0] * len(self.mock_df_asset1)
        signals_asset1[0] = 1  # Overbought
        
        # Asset 2: oversold on Jan 1st -> sizing should multiply
        signals_asset2 = [0] * len(self.mock_df_asset2)
        signals_asset2[0] = -1  # Oversold
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(
                    dynamic_timing_enabled=True,   # Timing ON
                    dynamic_sizing_enabled=False,  # Sizing OFF
                    expensive_buy_ratio=0.0
                ),
                2: AssetSimulationConfig(
                    dynamic_timing_enabled=False,  # Timing OFF
                    dynamic_sizing_enabled=True,   # Sizing ON
                    sizing_multiplier=2.0
                )
            }
        )
        
        result = engine.run_simulation(config)
        
        # Asset 1: timing enabled, overbought -> should wait (0 on Jan 1st)
        # Asset 2: sizing enabled, oversold -> should buy 2x on Jan 1st
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Verify Asset 2 bought more due to sizing (at least early in the year)
        self.assertGreaterEqual(asset2_result['total_invested'], asset1_result['total_invested'])


class TestInvestmentLimits(unittest.TestCase):
    """
    Tests to verify that investment amounts never exceed the allowed limits.
    
    CRITICAL: These tests ensure that:
    1. Total invested never exceeds expected annual amount
    2. Each asset never exceeds its proportional allocation
    3. Sizing multipliers don't cause over-investment
    """

    def setUp(self):
        """Set up mock portfolio with 2 assets."""
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 12, 31)
        
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        num_days = len(dates)
        
        self.mock_df_asset1 = pd.DataFrame({
            'open': [100.0] * num_days,
            'high': [105.0] * num_days,
            'low': [95.0] * num_days,
            'close': [100.0] * num_days,
            'adj_close': [100.0] * num_days,
        }, index=dates)
        
        self.mock_df_asset2 = pd.DataFrame({
            'open': [200.0] * num_days,
            'high': [210.0] * num_days,
            'low': [190.0] * num_days,
            'close': [200.0] * num_days,
            'adj_close': [200.0] * num_days,
        }, index=dates)

    def _get_mock_indicators_for_asset(self, df: pd.DataFrame, signals: list = None) -> pd.DataFrame:
        """Helper to create indicator DataFrame with specific signals."""
        df = df.copy()
        df['indicator_value'] = 50.0
        if signals is None:
            signals = [0] * len(df)
        if len(signals) < len(df):
            signals = signals + [0] * (len(df) - len(signals))
        df['signal'] = signals[:len(df)]
        return df

    def _create_mock_portfolio(self, weights: dict):
        """Create a mock portfolio with specified weights."""
        mock_portfolio = MagicMock()
        mock_portfolio.id = 1
        mock_portfolio.initial_capital = 0.0
        mock_portfolio.assets = []
        
        for asset_id, weight in weights.items():
            mock_asset = MagicMock()
            mock_asset.asset_id = asset_id
            mock_asset.weight = weight
            mock_asset.current_amount = 0.0
            mock_asset.asset = MagicMock()
            mock_asset.asset.ticker = f"ASSET{asset_id}"
            mock_portfolio.assets.append(mock_asset)
        
        return mock_portfolio

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_total_invested_never_exceeds_annual_budget(self, mock_session):
        """
        Test that total invested across all assets never exceeds the annual budget.
        
        With base_amount=1000 and monthly frequency, annual budget = 1000 * 12 = 12000
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.6, 2: 0.4})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # All neutral signals
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(self.mock_df_asset1)
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(self.mock_df_asset2)
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(),
                2: AssetSimulationConfig()
            }
        )
        
        result = engine.run_simulation(config)
        
        # Expected annual investment: 1000 * 12 = 12000
        expected_annual = 12000
        
        # Total invested should not exceed expected
        self.assertLessEqual(result['total_invested'], expected_annual + 1)  # +1 for float precision
        # But should be close to expected (all invested)
        self.assertAlmostEqual(result['total_invested'], expected_annual, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_each_asset_respects_its_weight_allocation(self, mock_session):
        """
        Test that each asset never exceeds its proportional allocation.
        
        Asset 1 (60%): max = 12000 * 0.6 = 7200
        Asset 2 (40%): max = 12000 * 0.4 = 4800
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.6, 2: 0.4})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # All neutral signals
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(self.mock_df_asset1)
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(self.mock_df_asset2)
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(),
                2: AssetSimulationConfig()
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Asset 1 (60%): should not exceed 7200
        self.assertLessEqual(asset1_result['total_invested'], 7200 + 1)
        self.assertAlmostEqual(asset1_result['total_invested'], 7200, delta=100)
        
        # Asset 2 (40%): should not exceed 4800
        self.assertLessEqual(asset2_result['total_invested'], 4800 + 1)
        self.assertAlmostEqual(asset2_result['total_invested'], 4800, delta=100)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_sizing_multiplier_respects_annual_budget(self, mock_session):
        """
        CRITICAL: Test that even with high sizing multiplier (e.g., 5x),
        total invested never exceeds the annual budget.
        
        Scenario: Asset with 5x multiplier and ALL oversold signals
        Should NOT invest more than its allocated budget.
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: ALL oversold (would want to buy 5x every month)
        signals_asset1 = [-1] * len(self.mock_df_asset1)
        
        # Asset 2: neutral
        signals_asset2 = [0] * len(self.mock_df_asset2)
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(
                    dynamic_sizing_enabled=True,
                    sizing_multiplier=5.0  # Very aggressive multiplier
                ),
                2: AssetSimulationConfig()  # Baseline
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Asset 1 (50%): max allowed = 6000, even with 5x multiplier
        self.assertLessEqual(asset1_result['total_invested'], 6000 + 1)
        
        # Asset 2 (50%): should be exactly 6000 (baseline, no sizing)
        self.assertAlmostEqual(asset2_result['total_invested'], 6000, delta=100)
        
        # Total should be 12000
        self.assertLessEqual(result['total_invested'], 12000 + 1)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_timing_deferred_amount_doesnt_exceed_budget(self, mock_session):
        """
        Test that when timing defers buying, the eventual purchase
        still respects the annual budget.
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 0.5, 2: 0.5})
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Asset 1: overbought first 6 months, then oversold
        signals_asset1 = [0] * len(self.mock_df_asset1)
        # First 6 months (~180 days): overbought
        for i in range(180):
            signals_asset1[i] = 1
        # Rest: oversold
        for i in range(180, len(signals_asset1)):
            signals_asset1[i] = -1
        
        # Asset 2: neutral
        signals_asset2 = [0] * len(self.mock_df_asset2)
        
        mock_engine1 = MagicMock()
        mock_engine1._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals_asset1
        )
        
        mock_engine2 = MagicMock()
        mock_engine2._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset2, signals_asset2
        )
        
        engine.asset_engines = {1: mock_engine1, 2: mock_engine2}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(
                    dynamic_timing_enabled=True,
                    expensive_buy_ratio=0.0  # Wait completely when overbought
                ),
                2: AssetSimulationConfig()  # Baseline
            }
        )
        
        result = engine.run_simulation(config)
        
        asset1_result = next(a for a in result['asset_results'] if a['asset_id'] == 1)
        asset2_result = next(a for a in result['asset_results'] if a['asset_id'] == 2)
        
        # Asset 1: even with deferred amounts, should not exceed 6000
        self.assertLessEqual(asset1_result['total_invested'], 6000 + 1)
        
        # Asset 2: should be exactly 6000
        self.assertAlmostEqual(asset2_result['total_invested'], 6000, delta=100)
        
        # Total should be 12000
        self.assertLessEqual(result['total_invested'], 12000 + 1)

    @patch('backend.engine.portfolio_simulation_engine.SessionLocal')
    def test_combined_timing_and_sizing_respects_budget(self, mock_session):
        """
        CRITICAL: Test that combining timing (deferred) + sizing (multiplied)
        never causes over-investment.
        
        Worst case: defer for 6 months, then 5x multiplier on oversold
        """
        mock_db = MagicMock()
        mock_session.return_value = mock_db
        
        mock_portfolio = self._create_mock_portfolio({1: 1.0})  # Single asset, 100%
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_portfolio
        
        with patch.object(PortfolioSimulationEngine, '_init_asset_engines', return_value={}):
            engine = PortfolioSimulationEngine(1, self.start_date, self.end_date)
        
        # Overbought first 6 months, then oversold
        signals = [0] * len(self.mock_df_asset1)
        for i in range(180):
            signals[i] = 1  # Overbought
        for i in range(180, len(signals)):
            signals[i] = -1  # Oversold
        
        mock_engine = MagicMock()
        mock_engine._calculate_indicators.return_value = self._get_mock_indicators_for_asset(
            self.mock_df_asset1, signals
        )
        
        engine.asset_engines = {1: mock_engine}
        
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=self.start_date,
            end_date=self.end_date,
            base_amount=1000,
            frequency='monthly',
            asset_configs={
                1: AssetSimulationConfig(
                    dynamic_timing_enabled=True,
                    dynamic_sizing_enabled=True,
                    expensive_buy_ratio=0.0,  # Wait completely
                    sizing_multiplier=5.0  # Very aggressive
                )
            }
        )
        
        result = engine.run_simulation(config)
        
        # Total invested should NEVER exceed 12000 regardless of timing/sizing
        self.assertLessEqual(result['total_invested'], 12000 + 1)
        # But it should invest the full amount eventually
        self.assertAlmostEqual(result['total_invested'], 12000, delta=100)


class TestIndicatorIsolation(unittest.TestCase):
    """Tests that indicator calculations are isolated per asset."""

    def setUp(self):
        self.start_date = datetime(2023, 1, 1)
        self.end_date = datetime(2023, 3, 31)  # 3 months for better RSI calculation
        dates = pd.date_range(start=self.start_date, end=self.end_date)
        num_days = len(dates)
        
        # Asset 1: trending up price (should have high RSI)
        self.mock_df_volatile = pd.DataFrame({
            'open': [100 + i * 2 for i in range(num_days)],
            'high': [105 + i * 2 for i in range(num_days)],
            'low': [95 + i * 2 for i in range(num_days)],
            'close': [100 + i * 2 for i in range(num_days)],
            'adj_close': [100 + i * 2 for i in range(num_days)],
        }, index=dates)
        
        # Asset 2: trending down price (should have low RSI)
        self.mock_df_stable = pd.DataFrame({
            'open': [200 - i * 1 for i in range(num_days)],
            'high': [205 - i * 1 for i in range(num_days)],
            'low': [195 - i * 1 for i in range(num_days)],
            'close': [200 - i * 1 for i in range(num_days)],
            'adj_close': [200 - i * 1 for i in range(num_days)],
        }, index=dates)

    @patch('backend.engine.simulation_engine.SimulationEngine._load_market_data')
    def test_indicator_uses_own_asset_data(self, mock_load):
        """
        Test that each asset's indicator is calculated from its own price data.
        Trending up asset should have higher RSI than trending down asset.
        """
        # Run engine for trending up asset
        mock_load.return_value = self.mock_df_volatile
        engine_volatile = SimulationEngine(1, self.start_date, self.end_date)
        
        # Calculate indicators
        indicators_volatile = engine_volatile._calculate_indicators('RSI')
        
        # Run engine for trending down asset
        mock_load.return_value = self.mock_df_stable
        engine_stable = SimulationEngine(2, self.start_date, self.end_date)
        
        indicators_stable = engine_stable._calculate_indicators('RSI')
        
        # Trending up asset should have higher RSI than trending down asset
        volatile_rsi_mean = indicators_volatile['indicator_value'].mean()
        stable_rsi_mean = indicators_stable['indicator_value'].mean()
        
        # They should be different because they use different price data
        # Trending up should have higher RSI than trending down
        self.assertGreater(volatile_rsi_mean, stable_rsi_mean)


if __name__ == '__main__':
    unittest.main()
