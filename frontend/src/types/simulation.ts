export interface Asset {
  id: number;
  ticker: string;
  name: string;
  asset_type: string;
}

export interface PortfolioPoint {
  date: string;
  price: number;
  invested: number;
  baseline_value: number;
  smart_value: number;
  cumulative_fees: number;
}

export interface SimulationResults {
  final_value: number;
  total_invested: number;
  total_return_percent: number;
  avg_purchase_price: number;
  total_assets_accumulated: number;
  portfolio_history: PortfolioPoint[];
  baseline_final_value: number;
  baseline_return_percent: number;
  baseline_avg_purchase_price: number;
  dca_efficiency: number;
  total_fees: number;
  fees_percentage: number;
}

export interface SimulationConfig {
  asset_id: number;
  start_date: string;
  end_date: string;
  initial_capital: number;
  base_amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  investment_mode: 'annual' | 'per_contribution';
  commission_fee_percent: number;
  minimum_fee_per_trade: number;
  maintenance_fee_annual_percent: number;
}

export interface SimulationResponse {
  id: number | null;
  config: SimulationConfig;
  results: SimulationResults;
}

export interface SimulationHistoryItem {
  id: number;
  asset_ticker: string;
  asset_name: string;
  start_date: string;
  end_date: string;
  final_value: number;
  total_invested: number;
  gross_profit: number;
  net_profit: number;
  total_fees: number;
  total_return_percent: number;
  smart_vs_baseline_diff: number;
  created_at: string;
}

