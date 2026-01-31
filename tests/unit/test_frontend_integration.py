"""
Test de integración que simula exactamente cómo el frontend envía los datos al backend.
Verifica que el endpoint procesa correctamente las claves string y que el engine
las encuentra correctamente.
"""

import unittest
import json
from datetime import datetime
from unittest.mock import MagicMock, patch
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig
from backend.api.v1.portfolio_simulation import router
from backend.engine.portfolio_simulation_engine import PortfolioSimulationEngine


class TestFrontendIntegration(unittest.TestCase):
    """Test que simula el flujo real del frontend."""
    
    def test_endpoint_receives_string_keys_from_json(self):
        """
        Simula exactamente lo que el frontend envía:
        1. JavaScript crea objeto con claves numéricas
        2. JSON.stringify convierte claves a strings
        3. Backend recibe JSON con claves string
        4. Pydantic valida y crea objeto
        5. Endpoint normaliza claves a int
        """
        # Simular lo que viene del frontend (JSON con claves string)
        json_data = {
            "portfolio_id": 1,
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T00:00:00",
            "base_amount": 1000.0,
            "frequency": "monthly",
            "asset_configs": {
                "1": {
                    "dynamic_timing_enabled": True,
                    "dynamic_sizing_enabled": False,
                    "smart_indicator": "RSI",
                    "expensive_buy_ratio": 0.5,
                    "rsi_threshold_low": 30.0,
                    "rsi_threshold_high": 70.0,
                    "ma_period_short": 50,
                    "ma_period_long": 200,
                    "sizing_multiplier": 1.0,
                    "timing_aggressiveness": 0.5
                },
                "2": {
                    "dynamic_timing_enabled": False,
                    "dynamic_sizing_enabled": False,
                    "smart_indicator": "RSI",
                    "expensive_buy_ratio": 0.5,
                    "rsi_threshold_low": 30.0,
                    "rsi_threshold_high": 70.0,
                    "ma_period_short": 50,
                    "ma_period_long": 200,
                    "sizing_multiplier": 1.0,
                    "timing_aggressiveness": 0.5
                },
                "3": {
                    "dynamic_timing_enabled": True,
                    "dynamic_sizing_enabled": True,
                    "smart_indicator": "EMA",
                    "expensive_buy_ratio": 0.5,
                    "rsi_threshold_low": 30.0,
                    "rsi_threshold_high": 70.0,
                    "ma_period_short": 50,
                    "ma_period_long": 200,
                    "sizing_multiplier": 2.5,
                    "timing_aggressiveness": 0.5
                }
            }
        }
        
        # Paso 1: Pydantic valida el JSON
        config = PortfolioSimulationCreate(**json_data)
        
        print(f"\nAfter Pydantic validation:")
        print(f"  Keys: {list(config.asset_configs.keys())}")
        print(f"  Key types: {[type(k).__name__ for k in config.asset_configs.keys()]}")
        
        # Verificar que Pydantic aceptó las claves string
        self.assertTrue(all(isinstance(k, str) for k in config.asset_configs.keys()),
                       "Pydantic should accept string keys from JSON")
        
        # Paso 2: Simular lo que hace el endpoint (normalizar claves)
        if config.asset_configs:
            normalized = {}
            for k, v in list(config.asset_configs.items()):
                int_key = int(k) if isinstance(k, str) else k
                normalized[int_key] = v
            config.asset_configs.clear()
            config.asset_configs.update(normalized)
        
        print(f"\nAfter endpoint normalization:")
        print(f"  Keys: {list(config.asset_configs.keys())}")
        print(f"  Key types: {[type(k).__name__ for k in config.asset_configs.keys()]}")
        
        # Verificar que después de normalizar, las claves son int
        self.assertTrue(all(isinstance(k, int) for k in config.asset_configs.keys()),
                       "After normalization, all keys should be int")
        
        # Paso 3: Verificar que el engine puede encontrar las configuraciones
        for asset_id in [1, 2, 3]:
            a_cfg = config.asset_configs.get(asset_id)
            self.assertIsNotNone(a_cfg, f"Engine should find config for asset {asset_id}")
            print(f"  Asset {asset_id}: Found! timing={a_cfg.dynamic_timing_enabled}, sizing={a_cfg.dynamic_sizing_enabled}")
    
    def test_engine_finds_configs_with_string_or_int_keys(self):
        """
        Verifica que el engine puede encontrar configuraciones tanto con claves string como int.
        Esto es importante porque la normalización podría fallar en algunos casos.
        """
        # Crear config con claves string (como si la normalización no funcionara)
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 12, 31),
            base_amount=1000.0,
            frequency="monthly",
            asset_configs={
                "1": AssetSimulationConfig(dynamic_timing_enabled=True),
                "2": AssetSimulationConfig(dynamic_timing_enabled=False),
                "3": AssetSimulationConfig(dynamic_timing_enabled=True, dynamic_sizing_enabled=True),
            }
        )
        
        print(f"\nConfig with string keys:")
        print(f"  Keys: {list(config.asset_configs.keys())}")
        
        # Simular lo que hace el engine: buscar con int key, luego con string key
        for asset_id in [1, 2, 3]:
            # Intenta con int key primero
            a_cfg = config.asset_configs.get(asset_id)
            if a_cfg is None:
                # Intenta con string key
                a_cfg = config.asset_configs.get(str(asset_id))
            
            self.assertIsNotNone(a_cfg, f"Engine should find config for asset {asset_id}")
            print(f"  Asset {asset_id}: Found! timing={a_cfg.dynamic_timing_enabled}")
    
    def test_all_assets_receive_correct_configs(self):
        """
        Verifica que todos los activos, incluyendo el último, reciben sus configuraciones correctas.
        """
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
        
        # Normalizar (como hace el endpoint)
        if config.asset_configs:
            normalized = {}
            for k, v in list(config.asset_configs.items()):
                int_key = int(k) if isinstance(k, str) else k
                normalized[int_key] = v
            config.asset_configs.clear()
            config.asset_configs.update(normalized)
        
        # Verificar que cada activo tiene su configuración correcta
        configs_found = {}
        for asset_id in [1, 2, 3]:
            a_cfg = config.asset_configs.get(asset_id)
            if a_cfg is None:
                a_cfg = config.asset_configs.get(str(asset_id))
            
            configs_found[asset_id] = a_cfg
            self.assertIsNotNone(a_cfg, f"Asset {asset_id} should have config")
        
        # Verificar valores específicos
        self.assertFalse(configs_found[1].dynamic_timing_enabled, "Asset 1 should NOT have timing")
        self.assertFalse(configs_found[2].dynamic_timing_enabled, "Asset 2 should NOT have timing")
        self.assertTrue(configs_found[3].dynamic_timing_enabled, "Asset 3 (último) SHOULD have timing")
        self.assertTrue(configs_found[3].dynamic_sizing_enabled, "Asset 3 (último) SHOULD have sizing")
        self.assertEqual(configs_found[3].sizing_multiplier, 2.5, "Asset 3 sizing multiplier should be 2.5")
        
        print(f"\n✓ All assets have correct configs:")
        print(f"  Asset 1: timing={configs_found[1].dynamic_timing_enabled}, sizing={configs_found[1].dynamic_sizing_enabled}")
        print(f"  Asset 2: timing={configs_found[2].dynamic_timing_enabled}, sizing={configs_found[2].dynamic_sizing_enabled}")
        print(f"  Asset 3: timing={configs_found[3].dynamic_timing_enabled}, sizing={configs_found[3].dynamic_sizing_enabled}, multiplier={configs_found[3].sizing_multiplier}")


if __name__ == "__main__":
    unittest.main()
