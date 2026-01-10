"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download, 
  Sliders, 
  Play, 
  BarChart2, 
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LineChart as LineChartIcon,
  Settings as SettingsIcon,
  Search,
  Info,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Layout,
  PieChart,
  Activity,
  CreditCard,
  Scale,
  Coins,
  History,
  Plus,
  RefreshCcw,
  Star,
  Layers,
  ArrowRightLeft,
  ToggleLeft,
  ToggleRight,
  Target,
  Zap,
  Box,
  Target as TargetIcon
} from "lucide-react";
import { 
  getPortfolios, 
  getPortfolio,
  runPortfolioSimulation,
  getPortfolioSimulationHistory,
  getAssetHistory
} from "../../lib/api";
import { Portfolio, PortfolioListItem } from "../../types/portfolio";
import { 
  PortfolioSimulationConfig, 
  PortfolioSimulationResponse, 
  PortfolioSimulationHistoryItem,
  AssetSimulationConfig
} from "../../types/portfolio_simulation";
import Header from "../../components/Header";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Cell, 
  ComposedChart,
  Line,
  PieChart as RechartsPieChart,
  Pie
} from "recharts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#13ec5b', '#3af578', '#6ef99c', '#9efcc0', '#cfffe4', '#0ea541', '#097a2d'];

export default function PortfolioAnalysisPage() {
  const searchParams = useSearchParams();
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolioDetails, setSelectedPortfolioDetails] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<PortfolioSimulationResponse | null>(null);
  const [history, setHistory] = useState<PortfolioSimulationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [isRebalancingEnabled, setIsRebalancingEnabled] = useState(false);
  const [previewData, setPreviewData] = useState<{date: string, value: number}[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form state
  const [config, setConfig] = useState<PortfolioSimulationConfig>({
    portfolio_id: 0,
    start_date: "2021-01-01",
    end_date: new Date().toISOString().split("T")[0],
    base_amount: 1000,
    frequency: "monthly",
    investment_mode: "per_contribution",
    rebalancing_mode: "none",
    rebalancing_interval_months: 6,
    asset_configs: {},
    is_favorite: false
  });

  useEffect(() => {
    loadData();
    const portfolioId = searchParams.get('id');
    if (portfolioId) {
      handlePortfolioChange(Number(portfolioId));
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedPortfolioDetails && !simulation) {
      loadPreview();
    }
  }, [selectedPortfolioDetails, simulation, config.start_date, config.end_date]);

  const loadPreview = async () => {
    if (!selectedPortfolioDetails) return;
    setLoadingPreview(true);
    try {
      const histories = await Promise.all(
        selectedPortfolioDetails.assets.map(async (pa) => {
          const data = await getAssetHistory(pa.asset_id, config.start_date, config.end_date);
          return { weight: pa.weight, data };
        })
      );

      if (histories.length > 0 && histories[0].data.length > 0) {
        const dates = histories[0].data.map(d => d.date);
        const indexValues = dates.map(date => {
          let weightedValue = 0;
          histories.forEach(h => {
            const dayData = h.data.find(d => d.date === date);
            if (dayData && h.data.length > 0) {
              const firstPrice = h.data[0].price;
              const currentPrice = dayData.price;
              const normalizedPrice = (currentPrice / firstPrice) * 100;
              weightedValue += normalizedPrice * h.weight;
            }
          });
          return { date, value: weightedValue };
        });
        setPreviewData(indexValues);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPortfolios();
      setPortfolios(data);
      
      const historyData = await getPortfolioSimulationHistory();
      setHistory(historyData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioChange = async (portfolioId: number) => {
    if (!portfolioId) {
      setSelectedPortfolioDetails(null);
      setConfig(prev => ({ ...prev, portfolio_id: 0, asset_configs: {} }));
      return;
    }

    setLoading(true);
    try {
      const details = await getPortfolio(portfolioId);
      setSelectedPortfolioDetails(details);
      
      // Initialize asset configs
      const assetConfigs: Record<number, AssetSimulationConfig> = {};
      details.assets.forEach(pa => {
        assetConfigs[pa.asset_id] = {
          dynamic_timing_enabled: false,
          timing_aggressiveness: 0.5,
          dynamic_sizing_enabled: false,
          sizing_multiplier: 2.0,
          smart_indicator: 'RSI',
          rsi_threshold_low: 30,
          rsi_threshold_high: 70,
          ma_period_short: 50,
          ma_period_long: 200,
          expensive_buy_ratio: 0.2,
          commission_fee_percent: 0.1,
          minimum_fee_per_trade: 0
        };
      });

      setConfig(prev => ({ 
        ...prev, 
        portfolio_id: portfolioId, 
        asset_configs: assetConfigs 
      }));
    } catch (error) {
      console.error("Error loading portfolio details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!config.portfolio_id) return;
    setLoading(true);
    try {
      const result = await runPortfolioSimulation(config);
      setSimulation(result);
      // Refresh history
      const historyData = await getPortfolioSimulationHistory();
      setHistory(historyData);
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Error running simulation.");
    } finally {
      setLoading(false);
    }
  };

  const updateAssetConfig = (assetId: number, updates: Partial<AssetSimulationConfig>) => {
    setConfig(prev => ({
      ...prev,
      asset_configs: {
        ...prev.asset_configs,
        [assetId]: { ...prev.asset_configs[assetId], ...updates }
      }
    }));
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      <Header />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: Configuration */}
        <aside className={cn(
          "relative flex flex-col border-r border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20",
          leftSidebarOpen ? "w-full max-w-[400px]" : "w-0 border-r-0"
        )}>
          {/* Toggle Handle Left */}
          <button 
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className={cn(
              "absolute -right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50 active:scale-95",
              !leftSidebarOpen && "translate-x-3"
            )}
          >
            {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[400px] transition-opacity duration-300",
            leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 border-b border-border-dark/30 bg-background-dark/50">
                <div className="flex flex-col gap-1">
                  <h1 className="text-white tracking-light text-[24px] font-bold leading-tight">Analysis Config</h1>
                  <p className="text-text-secondary text-sm">Configure your portfolio test.</p>
                </div>
              </div>

              {/* 1. Portfolio Selection */}
              <div className="border-b border-border-dark/30">
                <div className="px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    1. Portfolio
                  </h3>
                </div>
                <div className="px-6 pb-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Select Target Strategy</label>
                    <select 
                      className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      value={config.portfolio_id}
                      onChange={(e) => handlePortfolioChange(Number(e.target.value))}
                    >
                      <option value="0">Select a portfolio...</option>
                      {portfolios.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.asset_count} assets)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Timeline & Contribution */}
              <div className="border-b border-border-dark/30">
                <div className="px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Calendar size={14} className="text-primary" />
                    2. Parameters
                  </h3>
                </div>
                <div className="px-6 pb-5 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">Start Date</label>
                      <input 
                        type="date"
                        className="w-full rounded-lg border border-border-active bg-surface-dark h-11 px-4 text-sm text-white"
                        value={config.start_date}
                        onChange={(e) => setConfig({...config, start_date: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">End Date</label>
                      <input 
                        type="date"
                        className="w-full rounded-lg border border-border-active bg-surface-dark h-11 px-4 text-sm text-white"
                        value={config.end_date}
                        onChange={(e) => setConfig({...config, end_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Contribution Amount ($)</label>
                    <input 
                      type="number"
                      className="w-full rounded-lg border border-border-active bg-surface-dark h-11 px-4 text-sm text-white"
                      value={config.base_amount}
                      onChange={(e) => setConfig({...config, base_amount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Frequency</label>
                    <select 
                      className="w-full rounded-lg border border-border-active bg-surface-dark h-11 px-4 text-sm text-white"
                      value={config.frequency}
                      onChange={(e) => setConfig({...config, frequency: e.target.value as any})}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-monthly">Bi-Monthly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Per-Asset Smart Features */}
              {selectedPortfolioDetails && (
                <div className="border-b border-border-dark/30">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                      <Zap size={14} className="text-primary" />
                      3. Asset Smart Config
                    </h3>
                  </div>
                  <div className="px-6 pb-5 flex flex-col gap-4">
                    {selectedPortfolioDetails.assets.map(pa => (
                      <div key={pa.id} className="bg-surface-dark border border-border-active/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-primary text-sm">{pa.asset?.ticker} <span className="text-text-secondary opacity-50 text-[10px]">({Math.round(pa.weight * 100)}%)</span></span>
                          <button 
                            onClick={() => updateAssetConfig(pa.asset_id, { dynamic_timing_enabled: !config.asset_configs[pa.asset_id]?.dynamic_timing_enabled })}
                            className={cn(
                              "p-1 rounded-lg transition-all",
                              config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? "text-primary bg-primary/10" : "text-text-secondary hover:text-white"
                            )}
                          >
                            {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                        </div>
                        
                        {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled && (
                          <div className="flex flex-col gap-3 pt-2 border-t border-border-dark/30 animate-in fade-in slide-in-from-top-1">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] uppercase font-bold text-text-secondary">Indicator</label>
                              <select 
                                className="bg-background-dark border border-border-active rounded-lg h-8 px-2 text-xs"
                                value={config.asset_configs[pa.asset_id]?.smart_indicator}
                                onChange={(e) => updateAssetConfig(pa.asset_id, { smart_indicator: e.target.value as any })}
                              >
                                <option value="RSI">RSI</option>
                                <option value="MA">MA Cross</option>
                                <option value="EMA">EMA Cross</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] uppercase font-bold text-text-secondary">Timing Aggr.</label>
                                <span className="text-xs font-bold text-primary">{(config.asset_configs[pa.asset_id]?.timing_aggressiveness * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                className="accent-primary h-1 bg-surface-light rounded-full appearance-none"
                                value={config.asset_configs[pa.asset_id]?.timing_aggressiveness}
                                onChange={(e) => updateAssetConfig(pa.asset_id, { timing_aggressiveness: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Rebalancing Section (Placeholder) */}
              <div className="border-b border-border-dark/30">
                <div 
                  onClick={() => setCollapsedSections(prev => ({ ...prev, rebalance: !prev.rebalance }))}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
                >
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Scale size={14} className="text-primary" />
                    4. Rebalancing (Coming Soon)
                  </h3>
                  <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.rebalance && "-rotate-90")}>
                    <ChevronDown size={14} />
                  </div>
                </div>
                
                {!collapsedSections.rebalance && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between bg-surface-dark border border-border-active/30 p-3 rounded-xl">
                      <span className="text-xs font-medium">Automatic Rebalancing</span>
                      <button 
                        onClick={() => setIsRebalancingEnabled(!isRebalancingEnabled)}
                        className={cn(
                          "transition-all",
                          isRebalancingEnabled ? "text-primary" : "text-text-secondary"
                        )}
                      >
                        {isRebalancingEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                    
                    {isRebalancingEnabled && (
                      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-text-secondary uppercase">Rebalancing Strategy</label>
                          <select 
                            className="bg-surface-dark border border-border-active rounded-lg h-9 px-3 text-xs text-white"
                            value={config.rebalancing_mode}
                            onChange={(e) => setConfig({...config, rebalancing_mode: e.target.value as any})}
                          >
                            <option value="periodic">Time-based (Interval)</option>
                            <option value="contribution">At every contribution</option>
                          </select>
                        </div>
                        
                        {config.rebalancing_mode === 'periodic' && (
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-text-secondary uppercase">Interval (Months)</label>
                            <select 
                              className="bg-surface-dark border border-border-active rounded-lg h-9 px-3 text-xs text-white"
                              value={config.rebalancing_interval_months}
                              onChange={(e) => setConfig({...config, rebalancing_interval_months: Number(e.target.value)})}
                            >
                              <option value="6">Every 6 Months</option>
                              <option value="12">Every 12 Months</option>
                              <option value="18">Every 18 Months</option>
                              <option value="24">Every 24 Months</option>
                            </select>
                          </div>
                        )}
                        
                        <p className="text-[10px] text-yellow-400/60 italic leading-relaxed">
                          <AlertTriangle size={10} className="inline mr-1" />
                          Backend support for rebalancing is under development. This simulation currently assumes no rebalancing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 sticky bottom-0 bg-background-dark border-t border-border-dark mt-auto">
                <button 
                  onClick={handleRunSimulation}
                  disabled={loading || !config.portfolio_id}
                  className="w-full py-4 bg-primary text-background-dark font-black uppercase tracking-wider rounded-xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed shadow-xl shadow-primary/10"
                >
                  {loading ? <RefreshCcw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                  Run Analysis
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col bg-[#0b0f0c] overflow-hidden relative">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-8 z-10 custom-scrollbar">
            {simulation ? (
              <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Result Header */}
                <div className="bg-surface-dark/40 border border-border-active/20 p-8 rounded-[32px] backdrop-blur-sm">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight mb-2">Portfolio Simulation: {selectedPortfolioDetails?.name}</h2>
                      <div className="flex items-center gap-4 text-xs text-text-secondary font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" /> {config.start_date} to {config.end_date}</span>
                        <div className="size-1 rounded-full bg-border-dark"></div>
                        <span className="flex items-center gap-1.5"><TargetIcon size={14} className="text-primary" /> {selectedPortfolioDetails?.assets.length} Assets</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Final Portfolio Value</span>
                      <span className="text-4xl font-black text-primary drop-shadow-[0_0_20px_rgba(19,236,91,0.3)]">${simulation.results.final_value.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-4">Total Return</span>
                    <div className="flex items-end justify-between">
                      <span className={cn("text-3xl font-black", simulation.results.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>
                        {simulation.results.total_return_percent >= 0 ? "+" : ""}{simulation.results.total_return_percent.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-text-secondary mb-1 opacity-60">Baseline: {simulation.results.baseline_return_percent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-4">Capital Invested</span>
                    <span className="text-3xl font-black text-white">${simulation.results.total_invested.toLocaleString()}</span>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-4">Smart Alpha</span>
                    <span className={cn("text-3xl font-black", (simulation.results.total_return_percent - simulation.results.baseline_return_percent) >= 0 ? "text-primary" : "text-red-400")}>
                      +{(simulation.results.total_return_percent - simulation.results.baseline_return_percent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-4">Total Fees Paid</span>
                    <span className="text-3xl font-black text-white">${simulation.results.total_fees.toLocaleString()}</span>
                  </div>
                </div>

                {/* Main Performance Chart */}
                <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                    <TrendingUp size={18} className="text-primary" />
                    Portfolio Wealth Accumulation
                  </h3>
                  <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulation.results.portfolio_history}>
                        <defs>
                          <linearGradient id="colorSmart" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#13ec5b" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#13ec5b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} opacity={0.4} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#666', fontSize: 10, fontWeight: 'bold'}}
                          minTickGap={80}
                          tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", {month: 'short', year: '2d'})}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#666', fontSize: 10, fontWeight: 'bold'}}
                          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '16px' }}
                          itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: '900' }}
                          labelStyle={{ color: '#666', fontSize: '10px', marginBottom: '8px', fontWeight: 'black' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="smart_value" 
                          stroke="#13ec5b" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorSmart)" 
                          name="Smart Portfolio"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="baseline_value" 
                          stroke="#666" 
                          strokeWidth={2}
                          fill="transparent" 
                          strokeDasharray="5 5"
                          name="Baseline DCA"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="invested" 
                          stroke="#ffffff30" 
                          strokeWidth={1}
                          fill="transparent" 
                          name="Capital Invested"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Asset Breakdown Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                      <PieChart size={18} className="text-primary" />
                      Final Asset Distribution
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={simulation.results.asset_results.map((ar, idx) => ({
                              name: ar.ticker,
                              value: ar.final_value
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {simulation.results.asset_results.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 overflow-hidden">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                      <Activity size={18} className="text-primary" />
                      Individual Asset Performance
                    </h3>
                    <div className="space-y-4">
                      {simulation.results.asset_results.map((ar, idx) => (
                        <div key={ar.asset_id} className="bg-background-dark/40 border border-border-active/10 p-5 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-xl flex items-center justify-center font-black text-sm border border-border-dark" style={{ color: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}10` }}>
                              {ar.ticker}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white font-bold">{ar.ticker}</span>
                              <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Accumulated: {ar.assets_accumulated.toFixed(4)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={cn("text-base font-black", ar.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>
                              {ar.total_return_percent >= 0 ? "+" : ""}{ar.total_return_percent.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-text-secondary font-black opacity-60">Value: ${ar.final_value.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedPortfolioDetails ? (
              <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Preview Header */}
                <div className="bg-surface-dark/40 border border-border-active/20 p-8 rounded-[32px] backdrop-blur-sm">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight mb-2">Strategy Architect: {selectedPortfolioDetails.name}</h2>
                      <p className="text-text-secondary text-sm font-medium opacity-60">Review your portfolio framework before executing the deep analysis simulation.</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Total Framework Assets</span>
                          <span className="text-3xl font-black text-white">{selectedPortfolioDetails.assets.length}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Preview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Price Index Preview */}
                  <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-3">
                        <TrendingUp size={18} className="text-primary" />
                        Portfolio Price Index (1Y)
                      </h3>
                    </div>
                    <div className="h-[350px]">
                      {loadingPreview ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <RefreshCcw size={32} className="animate-spin text-primary opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Syncing historical data...</span>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={previewData}>
                            <defs>
                              <linearGradient id="colorPreview" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#13ec5b" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#13ec5b" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} opacity={0.4} />
                            <XAxis 
                              dataKey="date" 
                              hide
                            />
                            <YAxis 
                              hide
                              domain={['dataMin - 5', 'dataMax + 5']}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '12px' }}
                              itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: '900' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(val: number) => [val.toFixed(2), "Price Index"]}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#13ec5b" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorPreview)" 
                              animationDuration={2000}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Weight Distribution Preview */}
                  <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                      <PieChart size={18} className="text-primary" />
                      Target Allocation
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={selectedPortfolioDetails.assets.map((pa, idx) => ({
                              name: pa.asset?.ticker || "Unknown",
                              value: pa.weight * 100
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                            label={({ name, value }) => `${name} (${value.toFixed(0)}%)`}
                          >
                            {selectedPortfolioDetails.assets.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-10">
                   <div className="flex flex-col items-center gap-6 max-w-md text-center">
                      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                         <Play size={32} fill="currentColor" className="ml-1" />
                      </div>
                      <h4 className="text-xl font-black text-white">Ready to Simulate?</h4>
                      <p className="text-text-secondary text-sm font-medium opacity-60 leading-relaxed">
                        Execute the historical backtest to analyze how this strategy would have performed using Smart DCA features compared to a regular investment schedule.
                      </p>
                      <button 
                        onClick={handleRunSimulation}
                        className="px-10 py-4 bg-primary text-background-dark font-black uppercase tracking-wider rounded-2xl hover:bg-[#3af578] transition-all shadow-xl shadow-primary/10 active:scale-95 text-sm mt-4"
                      >
                        Launch Deep Analysis
                      </button>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-1000">
                <div className="size-32 rounded-[32px] bg-surface-dark border border-border-active flex items-center justify-center mb-10 relative group mx-auto transform rotate-6 hover:rotate-0 transition-all duration-700 shadow-2xl">
                  <div className="absolute inset-0 rounded-[32px] bg-primary/20 animate-pulse group-hover:animate-none opacity-20 blur-3xl"></div>
                  <BarChart2 size={64} className="text-primary relative z-10" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight leading-tight">Strategic Intelligence</h2>
                <p className="text-text-secondary max-w-lg leading-relaxed mx-auto font-medium text-base opacity-60 px-6">
                  Select a portfolio architecture from the left sidebar and run a deep multi-asset simulation to analyze performance and smart feature impact.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar: History */}
        <aside className={cn(
          "relative flex flex-col border-l border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20",
          rightSidebarOpen ? "w-full max-w-[320px]" : "w-0 border-l-0"
        )}>
          {/* Toggle Handle Right */}
          <button 
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className={cn(
              "absolute -left-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50 active:scale-95",
              !rightSidebarOpen && "translate-x-3"
            )}
          >
            {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[320px] transition-opacity duration-300",
            rightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="p-6 border-b border-border-dark/30 bg-background-dark/50">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                <History size={14} className="text-primary" />
                Simulation Archive
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {history.map(item => (
                <div key={item.id} className="bg-surface-dark/50 border border-border-dark rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-white group-hover:text-primary transition-colors">{item.portfolio_name}</span>
                    <span className={cn("text-[10px] font-black", item.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>
                      {item.total_return_percent >= 0 ? "+" : ""}{item.total_return_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-60">
                    <span>${(item.final_value / 1000).toFixed(1)}k Final</span>
                    <div className="size-1 rounded-full bg-border-dark"></div>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="py-10 text-center opacity-30">
                  <Clock size={24} className="mx-auto mb-2" />
                  <p className="text-xs uppercase font-bold tracking-widest">No past tests</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
