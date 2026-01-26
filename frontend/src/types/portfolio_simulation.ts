import { SimulationConfig, SimulationResultSchema, PortfolioPoint } from "./simulation";

export interface AssetSimulationConfig {
  dynamic_timing_enabled: boolean;
  timing_aggressiveness: number;
  dynamic_sizing_enabled: boolean;
  sizing_multiplier: number;
  smart_indicator: 'RSI' | 'MA' | 'EMA';
  rsi_threshold_low: number;
  rsi_threshold_high: number;
  ma_period_short: number;
  ma_period_long: number;
  expensive_buy_ratio: number;
  commission_fee_percent: number;
  minimum_fee_per_trade: number;
}

export interface PortfolioSimulationConfig {
  portfolio_id: number;
  name?: string;
  start_date: string;
  end_date: string;
  base_amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'bi-monthly';
  investment_mode: 'annual' | 'per_contribution';
  rebalancing_enabled: boolean;
  periodic_rebalancing_interval: number;
  commission_fee_percent: number;
  minimum_fee_per_trade: number;
  maintenance_fee_annual_percent: number;
  asset_configs: Record<number, AssetSimulationConfig>;
  is_favorite: boolean;
}

export interface AssetSimulationResult {
  asset_id: number;
  ticker: string;
  final_value: number;
  total_invested: number;
  total_return_percent: number;
  assets_accumulated: number;
  avg_price: number;
  portfolio_history: any[];
}

export interface PortfolioSimulationResultSchema extends SimulationResultSchema {
  asset_results: AssetSimulationResult[];
}

export interface PortfolioSimulationResponse {
  id?: number;
  config: PortfolioSimulationConfig;
  results: PortfolioSimulationResultSchema;
}

export interface PortfolioSimulationHistoryItem {
  id: number;
  portfolio_name: string;
  start_date: string;
  end_date: string;
  final_value: number;
  total_invested: number;
  total_return_percent: number;
  baseline_return_percent: number;
  net_profit: number;
  total_fees: number;
  fees_percentage: number;
  volatility: number;
  max_drawdown: number;
  is_favorite: boolean;
  created_at: string;
}
