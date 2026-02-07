"""
Test de depuración para verificar exactamente qué está pasando con el último activo.
"""

import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig
from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.models.asset import Asset


class TestDebugLastAsset(unittest.TestCase):
    """Test de depuración para el último activo."""
    
    @patch('backend.engine.portfolio_simulation_engine.PortfolioSimulationEngine._load_portfolio')
    def test_debug_asset_config_lookup(self, mock_load_portfolio):
        """
        Verifica exactamente cómo el engine busca las configuraciones de cada activo.
        """
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
        
        # Crear config con claves string (como viene del frontend)
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 12, 31),
            base_amount=1000.0,
            frequency="monthly",
            asset_configs={
                "1": AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                "2": AssetSimulationConfig(dynamic_timing_enabled=False, dynamic_sizing_enabled=False),
                "3": AssetSimulationConfig(dynamic_timing_enabled=True, dynamic_sizing_enabled=True, sizing_multiplier=2.5),
            }
        )
        
        print(f"\n=== BEFORE ENDPOINT NORMALIZATION ===")
        print(f"Config keys: {list(config.asset_configs.keys())}")
        print(f"Config key types: {[type(k).__name__ for k in config.asset_configs.keys()]}")
        
        # Simular lo que hace el endpoint
        if config.asset_configs:
            normalized = {}
            for k, v in list(config.asset_configs.items()):
                int_key = int(k) if isinstance(k, str) else k
                normalized[int_key] = v
            config.asset_configs.clear()
            config.asset_configs.update(normalized)
        
        print(f"\n=== AFTER ENDPOINT NORMALIZATION ===")
        print(f"Config keys: {list(config.asset_configs.keys())}")
        print(f"Config key types: {[type(k).__name__ for k in config.asset_configs.keys()]}")
        
        # Simular lo que hace el engine: buscar configuraciones para cada activo
        print(f"\n=== ENGINE LOOKUP ===")
        for pa in portfolio.assets:
            print(f"\nAsset {pa.asset_id}:")
            
            # Intenta con int key primero
            a_cfg = config.asset_configs.get(pa.asset_id)
            print(f"  get({pa.asset_id}): {a_cfg is not None}")
            
            if a_cfg is None:
                # Intenta con string key
                a_cfg = config.asset_configs.get(str(pa.asset_id))
                print(f"  get('{pa.asset_id}'): {a_cfg is not None}")
            
            if a_cfg is None:
                a_cfg = AssetSimulationConfig()
                print(f"  Using default: timing={a_cfg.dynamic_timing_enabled}, sizing={a_cfg.dynamic_sizing_enabled}")
            else:
                print(f"  Found: timing={a_cfg.dynamic_timing_enabled}, sizing={a_cfg.dynamic_sizing_enabled}")
                if pa.asset_id == 3:
                    print(f"  *** ASSET 3 (ÚLTIMO) FOUND WITH CORRECT CONFIG ***")
                    self.assertTrue(a_cfg.dynamic_timing_enabled, "Asset 3 should have timing enabled")
                    self.assertTrue(a_cfg.dynamic_sizing_enabled, "Asset 3 should have sizing enabled")
                    self.assertEqual(a_cfg.sizing_multiplier, 2.5, "Asset 3 should have sizing_multiplier=2.5")


if __name__ == "__main__":
    unittest.main()
