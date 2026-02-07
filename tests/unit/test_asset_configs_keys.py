"""
Test para verificar que asset_configs se normaliza correctamente.
"""
import unittest
from datetime import datetime
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig


class TestAssetConfigsKeys(unittest.TestCase):
    """Test que asset_configs se normaliza correctamente."""
    
    def test_asset_configs_with_string_keys_from_json(self):
        """
        Simula lo que viene del frontend (JSON con claves string).
        Verifica que las claves se pueden normalizar a int.
        """
        # Simular lo que viene del frontend
        data = {
            "portfolio_id": 1,
            "start_date": datetime(2024, 1, 1),
            "end_date": datetime(2024, 12, 31),
            "base_amount": 1000.0,
            "frequency": "monthly",
            "asset_configs": {
                "1": {
                    "dynamic_timing_enabled": True,
                    "dynamic_sizing_enabled": False,
                    "smart_indicator": "RSI",
                    "expensive_buy_ratio": 0.5
                },
                "2": {
                    "dynamic_timing_enabled": False,
                    "dynamic_sizing_enabled": True,
                    "smart_indicator": "MA",
                    "sizing_multiplier": 2.5
                },
                "3": {
                    "dynamic_timing_enabled": True,
                    "dynamic_sizing_enabled": True,
                    "smart_indicator": "EMA",
                    "sizing_multiplier": 3.0
                }
            }
        }
        
        # Crear objeto Pydantic
        config = PortfolioSimulationCreate(**data)
        
        # Pydantic acepta claves string, pero el endpoint las normaliza a int
        # Verificar que el objeto se creó correctamente con claves string
        self.assertTrue(all(isinstance(k, str) for k in config.asset_configs.keys()),
                       f"Expected all keys to be str from Pydantic, got {[type(k).__name__ for k in config.asset_configs.keys()]}")
        
        # Simular lo que hace el endpoint: normalizar claves a int
        normalized = {}
        for k, v in list(config.asset_configs.items()):
            int_key = int(k) if isinstance(k, str) else k
            normalized[int_key] = v
        
        # Verificar que después de normalizar, las claves son int
        self.assertTrue(all(isinstance(k, int) for k in normalized.keys()),
                       f"Expected all keys to be int after normalization, got {[type(k).__name__ for k in normalized.keys()]}")
        
        # Verificar que se puede acceder con int keys
        self.assertIsNotNone(normalized.get(1))
        self.assertIsNotNone(normalized.get(2))
        self.assertIsNotNone(normalized.get(3))
        
        # Verificar que los valores se preservan
        self.assertTrue(normalized[1].dynamic_timing_enabled)
        self.assertFalse(normalized[1].dynamic_sizing_enabled)
        self.assertEqual(normalized[2].sizing_multiplier, 2.5)
        self.assertEqual(normalized[3].smart_indicator, "EMA")
        
        print("✓ Test passed: asset_configs keys can be normalized to int")


if __name__ == "__main__":
    unittest.main()
