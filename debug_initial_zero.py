import pandas as pd
import numpy as np
from datetime import datetime
from backend.engine.simulation_engine import SimulationEngine

def test_initial_zero_debug():
    print("--- DEBUGGING INITIAL ZERO ISSUE ---")
    start_date = datetime(2021, 1, 1)
    end_date = datetime(2021, 1, 5)
    
    # Create mock data where the first day has 0 price
    dates = pd.date_range(start=start_date, end=end_date)
    mock_df = pd.DataFrame({
        'open': [0.0, 100.0, 101.0, 102.0, 103.0],
        'high': [0.0, 105.0, 106.0, 107.0, 108.0],
        'low': [0.0, 95.0, 96.0, 97.0, 98.0],
        'close': [0.0, 100.0, 101.0, 102.0, 103.0],
        'adj_close': [0.0, 100.0, 101.0, 102.0, 103.0],
        'indicator_value': [50.0] * 5,
        'signal': [0] * 5
    }, index=dates)

    engine = SimulationEngine(1, start_date, end_date)
    engine.market_data = mock_df
    
    # We mock _calculate_indicators to return our mock_df
    engine._calculate_indicators = lambda *args, **kwargs: mock_df
    
    result = engine.run_baseline_dca(
        base_amount=100,
        frequency='monthly',
        initial_capital=1000,
        investment_mode='per_contribution'
    )
    
    history = result.portfolio_history
    print(f"Total history points: {len(history)}")
    for i, point in enumerate(history):
        print(f"Point {i}: Date={point['date']}, Price={point['price']}, BaselineValue={point['baseline_value']}, SmartValue={point['smart_value']}")
        if point['price'] == 0 or point['baseline_value'] == 0:
            print(f"  >>> FAILURE: Zero detected at point {i}")

if __name__ == "__main__":
    test_initial_zero_debug()
