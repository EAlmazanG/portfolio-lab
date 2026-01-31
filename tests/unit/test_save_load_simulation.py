"""
Test para verificar que las configuraciones smart del último activo se guardan y cargan correctamente.
"""

import unittest
from datetime import datetime
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig


class TestSaveLoadSimulation(unittest.TestCase):
    """Test que verifica el ciclo de guardar y cargar simulaciones."""
    
    def test_asset_configs_serialization(self):
        """
        Verifica que las configuraciones de los activos se serializan correctamente
        cuando se guardan en la base de datos.
        """
        # Crear config con claves string (como viene del frontend)
        config = PortfolioSimulationCreate(
            portfolio_id=1,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 12, 31),
            base_amount=1000.0,
            frequency="monthly",
            asset_configs={
                "1": AssetSimulationConfig(dynamic_timing_enabled=False),
                "2": AssetSimulationConfig(dynamic_timing_enabled=False),
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
        
        print(f"\n=== ORIGINAL CONFIG ===")
        print(f"Keys: {list(config.asset_configs.keys())}")
        for asset_id, cfg in config.asset_configs.items():
            print(f"  Asset {asset_id}: timing={cfg.dynamic_timing_enabled}, sizing={cfg.dynamic_sizing_enabled}")
        
        # Simular lo que hace el servicio: convertir a JSON para guardar en BD
        asset_configs_json = {str(k): v.model_dump() for k, v in config.asset_configs.items()}
        
        print(f"\n=== SERIALIZED TO JSON ===")
        print(f"Keys: {list(asset_configs_json.keys())}")
        for asset_id_str, cfg_data in asset_configs_json.items():
            print(f"  Asset {asset_id_str}: timing={cfg_data['dynamic_timing_enabled']}, sizing={cfg_data['dynamic_sizing_enabled']}")
        
        # Simular lo que hace el servicio al cargar: convertir de JSON a objetos
        asset_configs_loaded = {}
        for asset_id_str, cfg_data in asset_configs_json.items():
            asset_configs_loaded[int(asset_id_str)] = AssetSimulationConfig(**cfg_data)
        
        print(f"\n=== LOADED FROM JSON ===")
        print(f"Keys: {list(asset_configs_loaded.keys())}")
        for asset_id, cfg in asset_configs_loaded.items():
            print(f"  Asset {asset_id}: timing={cfg.dynamic_timing_enabled}, sizing={cfg.dynamic_sizing_enabled}")
        
        # Verificar que el último activo tiene su configuración correcta
        asset_3_cfg = asset_configs_loaded.get(3)
        self.assertIsNotNone(asset_3_cfg, "Asset 3 should be loaded from JSON")
        self.assertTrue(asset_3_cfg.dynamic_timing_enabled, "Asset 3 should have timing enabled")
        self.assertTrue(asset_3_cfg.dynamic_sizing_enabled, "Asset 3 should have sizing enabled")
        self.assertEqual(asset_3_cfg.sizing_multiplier, 2.5, "Asset 3 should have sizing_multiplier=2.5")
        
        print(f"\n✓ Asset 3 configuration preserved through save/load cycle")


if __name__ == "__main__":
    unittest.main()
