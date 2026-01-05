export interface Asset {
  id: number;
  ticker: string;
  name: string;
  asset_type: string;
}

export interface PortfolioPoint {
  date: string;
  value: number;
  invested: number;
}

export interface SimulationResults {
  final_value: number;
  total_invested: number;
  total_return_percent: number;
  avg_purchase_price: number;
  total_assets_accumulated: number;
  portfolio_history: PortfolioPoint[];
}

export interface SimulationConfig {
  asset_id: number;
  start_date: string;
  end_date: string;
  base_amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  commission_fee_percent: number;
}

export interface SimulationResponse {
  id: number | null;
  config: SimulationConfig;
  results: SimulationResults;
}

