"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Calendar, Download, Sliders, Play, BarChart2, BrainCircuit,
  ChevronDown, ChevronRight, ChevronLeft, LineChart as LineChartIcon, Settings as SettingsIcon,
  Search, Info, Trash2, AlertTriangle, X, CheckCircle2, ArrowUpRight, Clock, Layout,
  PieChart as PieChartIcon, Activity, CreditCard, Scale, Coins, History, Plus, RefreshCcw, Star,
  DollarSign, Layers, Zap, Edit3, ToggleLeft, ToggleRight, Target as TargetIcon
} from "lucide-react";
import {
  getPortfolios, getPortfolio, getAssetHistory,
  runPortfolioSimulation, getPortfolioSimulationHistory, getPortfolioSimulationDetails,
  deletePortfolioSimulation, togglePortfolioSimulationFavorite
} from "../../lib/api";
import {
  Portfolio, PortfolioListItem, PortfolioAsset
} from "../../types/portfolio";
import {
  PortfolioSimulationConfig, PortfolioSimulationResponse, PortfolioSimulationHistoryItem,
  AssetSimulationConfig, PortfolioSimulationPoint, AssetSimulationResultItem
} from "../../types/portfolio_simulation";
import { Asset } from "../../types/simulation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell, ComposedChart, Brush, Line, PieChart as RechartsPieChart, Pie, Legend
} from "recharts";
import Header from "../../components/Header";
import { useRouter, useSearchParams } from "next/navigation";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ["#13ec5b", "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function PortfolioAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolioDetails, setSelectedPortfolioDetails] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [simulation, setSimulation] = useState<PortfolioSimulationResponse | null>(null);
  const [history, setHistory] = useState<PortfolioSimulationHistoryItem[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'favorites'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    section1: false,
    section2: false,
    section3: true,
    section4: true,
    assetSmart: false
  });
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Toggles for enabling/disabling sections (similar to single asset)
  const [isFeesEnabled, setIsFeesEnabled] = useState(false);
  const [isSmartDcaEnabled, setIsSmartDcaEnabled] = useState(false);

  const [config, setConfig] = useState<PortfolioSimulationConfig>({
    portfolio_id: 0,
    start_date: "2021-01-01",
    end_date: new Date().toISOString().split("T")[0],
    base_amount: 1000,
    frequency: "monthly",
    investment_mode: "per_contribution",
    rebalancing_mode: "none",
    rebalancing_interval_months: 6,
    commission_fee_percent: 0.1,
    minimum_fee_per_trade: 0,
    maintenance_fee_annual_percent: 0,
    asset_configs: {},
    is_favorite: false
  });

  useEffect(() => {
    loadData();
    const portfolioIdFromUrl = searchParams.get('portfolioId');
    if (portfolioIdFromUrl) {
      handlePortfolioChange(Number(portfolioIdFromUrl));
    }
  }, []);

  const loadData = async () => {
    try {
      const data = await getPortfolios();
      setPortfolios(data);
      const historyData = await getPortfolioSimulationHistory();
      setHistory(historyData);
    } catch (error) {
      console.error("Error loading portfolios:", error);
    }
  };

  const loadPortfolioPreview = async (portfolio: Portfolio) => {
    setLoadingPreview(true);
    try {
      // Get 1 year of history for each asset to create a weighted index
      const end = new Date();
      const start = new Date();
      start.setFullYear(end.getFullYear() - 1);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      
      const assetHistories = await Promise.all(
        portfolio.assets.map(pa => getAssetHistory(pa.asset_id, startStr, endStr))
      );
      
      // Combine into a single index
      const dates = assetHistories[0]?.map(h => h.date) || [];
      const indexPoints = dates.map((date, idx) => {
        let weightedSum = 0;
        portfolio.assets.forEach((pa, assetIdx) => {
          const history = assetHistories[assetIdx];
          const priceAtDate = history?.find(h => h.date === date)?.price || 0;
          const firstPrice = history?.[0]?.price || 1;
          const normalizedPrice = (priceAtDate / firstPrice) * 100;
          weightedSum += normalizedPrice * pa.weight;
        });
        return { date, value: weightedSum };
      });
      
      setPreviewData(indexPoints);
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePortfolioChange = async (portfolioId: number) => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const details = await getPortfolio(portfolioId);
      setSelectedPortfolioDetails(details);
      setSimulation(null);
      
      // Initialize asset configs with defaults
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
          expensive_buy_ratio: 0.1
        };
      });

      setConfig(prev => ({ 
        ...prev, 
        portfolio_id: portfolioId, 
        asset_configs: assetConfigs,
        name: `Analysis: ${details.name}`
      }));
      
      loadPortfolioPreview(details);
    } catch (error) {
      console.error("Error loading portfolio details:", error);
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

  const handleRunSimulation = async () => {
    if (!config.portfolio_id) return;
    setLoading(true);
    try {
      // Prepare config for API (ensure Fees and Smart DCA flags are applied)
      const finalConfig = {
        ...config,
        commission_fee_percent: isFeesEnabled ? config.commission_fee_percent : 0,
        minimum_fee_per_trade: isFeesEnabled ? config.minimum_fee_per_trade : 0,
        maintenance_fee_annual_percent: isFeesEnabled ? config.maintenance_fee_annual_percent : 0,
        // If Smart DCA is disabled globally, disable it for all assets in the request
        asset_configs: Object.fromEntries(
          Object.entries(config.asset_configs).map(([id, cfg]) => [
            id,
            isSmartDcaEnabled ? cfg : { ...cfg, dynamic_timing_enabled: false, dynamic_sizing_enabled: false }
          ])
        )
      };

      const result = await runPortfolioSimulation(finalConfig);
      setSimulation(result);
      loadData(); // Refresh history
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Error running simulation. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const isFav = await togglePortfolioSimulationFavorite(id);
      setHistory(prev => prev.map(item => item.id === id ? { ...item, is_favorite: isFav } : item));
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      <Header />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: Configuration */}
        <aside className={cn(
          "relative flex flex-col border-r border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20 shadow-2xl",
          leftSidebarOpen ? "w-full max-w-[380px]" : "w-0 border-r-0"
        )}>
          {/* Toggle Handle */}
          <button 
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className={cn(
              "absolute -right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50",
              !leftSidebarOpen && "translate-x-3"
            )}
          >
            {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[380px] transition-opacity duration-300",
            leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 border-b border-border-dark/30">
                <h1 className="text-white tracking-tight text-2xl font-black leading-tight">Simulation Config</h1>
                <p className="text-text-secondary text-[11px] uppercase font-bold tracking-widest opacity-60 mt-1">Portfolio Backtesting</p>
              </div>

              {/* 1. Asset & Timeline */}
              <div className="border-b border-border-dark/30">
                <div 
                  onClick={() => setCollapsedSections(prev => ({ ...prev, section1: !prev.section1 }))}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
                >
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Layout size={14} className="text-primary" />
                    1. Portfolio & Timeline
                  </h3>
                  <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section1 && "-rotate-90")}>
                    <ChevronDown size={14} />
                  </div>
                </div>
                
                {!collapsedSections.section1 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">Target Portfolio</label>
                      <select 
                        className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm"
                        value={config.portfolio_id}
                        onChange={(e) => handlePortfolioChange(Number(e.target.value))}
                      >
                        <option value={0} disabled>Select a portfolio...</option>
                        {portfolios.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Start Date</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-3 text-sm"
                          type="date" 
                          value={config.start_date}
                          onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">End Date</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-3 text-sm"
                          type="date" 
                          value={config.end_date}
                          onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Strategy & Capital */}
              <div className="border-b border-border-dark/30">
                <div 
                  onClick={() => setCollapsedSections(prev => ({ ...prev, section2: !prev.section2 }))}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
                >
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Coins size={14} className="text-primary" />
                    2. Capital & Strategy
                  </h3>
                  <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section2 && "-rotate-90")}>
                    <ChevronDown size={14} />
                  </div>
                </div>

                {!collapsedSections.section2 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Frequency</label>
                        <select 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm"
                          value={config.frequency}
                          onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="bi-monthly">Bi-monthly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Base Amount ($)</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm"
                          type="number" 
                          min="1"
                          step="50"
                          value={config.base_amount}
                          onChange={(e) => setConfig({ ...config, base_amount: Math.max(1, Number(e.target.value)) })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">Investment Mode</label>
                      <select 
                        className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm"
                        value={config.investment_mode}
                        onChange={(e) => setConfig({ ...config, investment_mode: e.target.value as any })}
                      >
                        <option value="per_contribution">Fixed per contribution</option>
                        <option value="annual">Annual Budget</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Fees (Global) */}
              <div className="border-b border-border-dark/30">
                <div 
                  onClick={() => setCollapsedSections(prev => ({ ...prev, section3: !prev.section3 }))}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
                >
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <CreditCard size={14} className="text-primary" />
                    3. FEES & COMMISSIONS
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsFeesEnabled(!isFeesEnabled); }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all",
                        isFeesEnabled ? "bg-red-400/10 text-red-400 border border-red-400/20" : "bg-surface-dark text-text-secondary border border-border-dark"
                      )}
                    >
                      {isFeesEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                    <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section3 && "-rotate-90")}>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {isFeesEnabled && !collapsedSections.section3 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Trade %</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                          min="0" step="0.1" type="number" 
                          value={config.commission_fee_percent}
                          onChange={(e) => setConfig({ ...config, commission_fee_percent: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Min ($)</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                          min="0" step="0.1" type="number" 
                          value={config.minimum_fee_per_trade}
                          onChange={(e) => setConfig({ ...config, minimum_fee_per_trade: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Maint %</label>
                        <input 
                          className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                          min="0" step="0.1" type="number" 
                          value={config.maintenance_fee_annual_percent}
                          onChange={(e) => setConfig({ ...config, maintenance_fee_annual_percent: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Smart DCA Section (Global Toggle + Per-Asset Details) */}
              <div className="border-b border-border-dark/30">
                <div 
                  onClick={() => setCollapsedSections(prev => ({ ...prev, section4: !prev.section4 }))}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
                >
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-primary" />
                    4. SMART FEATURES
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsSmartDcaEnabled(!isSmartDcaEnabled); }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all",
                        isSmartDcaEnabled ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-dark text-text-secondary border border-border-dark"
                      )}
                    >
                      {isSmartDcaEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                    <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section4 && "-rotate-90")}>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {isSmartDcaEnabled && !collapsedSections.section4 && (
                  <div className="px-6 pb-5 flex flex-col gap-5 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40 italic">Configure Smart DCA parameters per asset below:</p>
                    
                    {selectedPortfolioDetails?.assets.map(pa => (
                      <div key={pa.id} className="bg-surface-dark/50 border border-border-active/20 rounded-xl overflow-hidden">
                        <div 
                          onClick={() => setCollapsedSections(prev => ({ ...prev, [`asset_${pa.asset_id}`]: !prev[`asset_${pa.asset_id}`] }))}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-light/20 transition-colors"
                        >
                          <span className="font-black text-primary text-xs uppercase tracking-tight">{pa.asset?.ticker}</span>
                          <ChevronDown size={12} className={cn("text-text-secondary transition-transform", collapsedSections[`asset_${pa.asset_id}`] && "-rotate-90")} />
                        </div>

                        {!collapsedSections[`asset_${pa.asset_id}`] && (
                          <div className="p-4 pt-0 flex flex-col gap-5 animate-in slide-in-from-top-1">
                            {/* Feature 1: Dynamic Timing */}
                            <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Dynamic Timing</span>
                                <button 
                                  onClick={() => updateAssetConfig(pa.asset_id, { dynamic_timing_enabled: !config.asset_configs[pa.asset_id]?.dynamic_timing_enabled })}
                                  className={cn("transition-colors", config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? "text-primary" : "text-text-secondary")}
                                >
                                  {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                              </div>
                              {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled && (
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[9px] font-bold text-text-secondary uppercase">
                                    <span>Conservative</span>
                                    <span className="text-primary">Aggressive ({config.asset_configs[pa.asset_id]?.timing_aggressiveness})</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="1" step="0.05" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none"
                                    value={config.asset_configs[pa.asset_id]?.timing_aggressiveness}
                                    onChange={(e) => updateAssetConfig(pa.asset_id, { timing_aggressiveness: Number(e.target.value) })}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Feature 2: Dynamic Sizing */}
                            <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Dynamic Sizing</span>
                                <button 
                                  onClick={() => updateAssetConfig(pa.asset_id, { dynamic_sizing_enabled: !config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled })}
                                  className={cn("transition-colors", config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled ? "text-primary" : "text-text-secondary")}
                                >
                                  {config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                              </div>
                              {config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled && (
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[9px] font-bold text-text-secondary uppercase">
                                    <span>Max Multiplier</span>
                                    <span className="text-primary">{config.asset_configs[pa.asset_id]?.sizing_multiplier}x</span>
                                  </div>
                                  <input 
                                    type="range" min="1" max="5" step="0.1" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none"
                                    value={config.asset_configs[pa.asset_id]?.sizing_multiplier}
                                    onChange={(e) => updateAssetConfig(pa.asset_id, { sizing_multiplier: Number(e.target.value) })}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Indicators */}
                            <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                              <label className="text-[9px] uppercase font-bold text-text-secondary">Technical Indicator</label>
                              <select 
                                className="bg-background-dark border border-border-active rounded-lg h-8 px-2 text-xs"
                                value={config.asset_configs[pa.asset_id]?.smart_indicator}
                                onChange={(e) => updateAssetConfig(pa.asset_id, { smart_indicator: e.target.value as any })}
                              >
                                <option value="RSI">RSI</option>
                                <option value="MA">Simple Moving Average</option>
                                <option value="EMA">Exponential Moving Average</option>
                              </select>
                              
                              {config.asset_configs[pa.asset_id]?.smart_indicator === 'RSI' ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-text-secondary uppercase">Buy Limit</span>
                                    <input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.rsi_threshold_low} onChange={(e) => updateAssetConfig(pa.asset_id, { rsi_threshold_low: Number(e.target.value) })} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-text-secondary uppercase">Wait Limit</span>
                                    <input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.rsi_threshold_high} onChange={(e) => updateAssetConfig(pa.asset_id, { rsi_threshold_high: Number(e.target.value) })} />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-text-secondary uppercase">Short</span>
                                    <input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.ma_period_short} onChange={(e) => updateAssetConfig(pa.asset_id, { ma_period_short: Number(e.target.value) })} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-text-secondary uppercase">Long</span>
                                    <input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.ma_period_long} onChange={(e) => updateAssetConfig(pa.asset_id, { ma_period_long: Number(e.target.value) })} />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Safety Floor */}
                            <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Safety Floor</span>
                                <span className="text-[10px] font-black text-primary">{(config.asset_configs[pa.asset_id]?.expensive_buy_ratio! * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="1" step="0.05" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none"
                                value={config.asset_configs[pa.asset_id]?.expensive_buy_ratio}
                                onChange={(e) => updateAssetConfig(pa.asset_id, { expensive_buy_ratio: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Run Button Sticky */}
            <div className="p-6 border-t border-border-dark bg-background-dark sticky bottom-0 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <button 
                onClick={handleRunSimulation}
                disabled={loading || !config.portfolio_id}
                className="w-full py-4 bg-primary text-background-dark font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-[#3af578] shadow-2xl active:scale-[0.98] disabled:opacity-30"
              >
                {loading ? <RefreshCcw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                Run Portfolio Analysis
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 z-10 custom-scrollbar relative">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="max-w-[1600px] mx-auto z-10 relative">
            {simulation ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Result Header */}
                <div className="bg-surface-dark/40 border border-border-active/20 p-8 rounded-[32px] backdrop-blur-sm shadow-xl">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex-1">
                      <h2 className="text-3xl font-black text-white tracking-tight mb-2 leading-tight">{selectedPortfolioDetails?.name}</h2>
                      <div className="flex items-center gap-4 text-[10px] text-text-secondary font-black uppercase tracking-widest opacity-60">
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary" /> {config.start_date} → {config.end_date}</span>
                        <div className="size-1 rounded-full bg-border-dark"></div>
                        <span className="flex items-center gap-1.5"><TargetIcon size={12} className="text-primary" /> {selectedPortfolioDetails?.assets.length} Assets Simulated</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-50">Ending Wealth</span>
                      <span className="text-4xl font-black text-primary drop-shadow-[0_0_20px_rgba(19,236,91,0.3)] tabular-nums">${simulation.results.final_value.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-[24px] shadow-lg group hover:border-primary/20 transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-4 opacity-50">Total Return</span>
                    <div className="flex items-baseline justify-between">
                      <span className={cn("text-3xl font-black tabular-nums", simulation.results.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>
                        {simulation.results.total_return_percent >= 0 ? "+" : ""}{simulation.results.total_return_percent.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-text-secondary font-bold opacity-40">Base: {simulation.results.baseline_return_percent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-[24px] shadow-lg group hover:border-primary/20 transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-4 opacity-50">Capital Invested</span>
                    <span className="text-3xl font-black text-white tabular-nums">${simulation.results.total_invested.toLocaleString()}</span>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-[24px] shadow-lg group hover:border-primary/20 transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-4 opacity-50">Smart Alpha</span>
                    <span className={cn("text-3xl font-black tabular-nums", (simulation.results.total_return_percent - simulation.results.baseline_return_percent) >= 0 ? "text-primary" : "text-red-400")}>
                      +{(simulation.results.total_return_percent - simulation.results.baseline_return_percent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-[24px] shadow-lg group hover:border-primary/20 transition-all">
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-4 opacity-50">Total Fees</span>
                    <span className="text-3xl font-black text-white tabular-nums">${simulation.results.total_fees.toLocaleString()}</span>
                  </div>
                </div>

                {/* Main Performance Chart */}
                <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-10">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                      <TrendingUp size={18} />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Wealth Accumulation</h3>
                  </div>
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
                          contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.5)' }}
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
                          animationDuration={2000}
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
                          stroke="#ffffff20" 
                          strokeWidth={1}
                          fill="transparent" 
                          name="Capital Invested"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Asset Breakdown Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                  <div className="lg:col-span-2 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl h-full min-h-[500px] flex flex-col">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <PieChartIcon size={18} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Final Distribution</h3>
                    </div>
                    <div className="flex-1">
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
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: '#333', strokeWidth: 1.5 }}
                            animationDuration={1500}
                          >
                            {simulation.results.asset_results.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px' }}
                            itemStyle={{ fontWeight: '900', color: '#fff' }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-3 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl overflow-hidden h-full">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Activity size={18} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Asset Performance</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {simulation.results.asset_results.map((ar, idx) => (
                        <div key={ar.asset_id} className="bg-background-dark/40 border border-border-active/10 p-5 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all">
                          <div className="flex items-center gap-5">
                            <div className="size-12 rounded-xl flex items-center justify-center font-black text-base border-2 border-border-dark shadow-inner" style={{ color: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}08` }}>
                              {ar.ticker}
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-white font-black text-lg tracking-tight group-hover:text-primary transition-colors">{ar.ticker}</span>
                              <span className="text-[9px] text-text-secondary font-black uppercase tracking-widest opacity-50">Acc: {ar.assets_accumulated.toFixed(4)} Units</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={cn("text-xl font-black tabular-nums", ar.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>
                              {ar.total_return_percent >= 0 ? "+" : ""}{ar.total_return_percent.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-text-secondary font-black opacity-40 uppercase tracking-widest">${ar.final_value.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedPortfolioDetails ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Compact Preview Header */}
                <div className="bg-surface-dark/40 border border-border-active/20 p-8 rounded-[32px] backdrop-blur-sm shadow-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <h2 className="text-3xl font-black text-white tracking-tight leading-tight truncate">{selectedPortfolioDetails.name}</h2>
                    <div className="flex items-center gap-4 text-[10px] text-text-secondary font-black uppercase tracking-widest mt-2 opacity-60">
                      <span className="flex items-center gap-1.5"><Layers size={12} className="text-primary" /> {selectedPortfolioDetails.assets.length} Strategy Components</span>
                      <div className="size-1 rounded-full bg-border-dark"></div>
                      <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary" /> Target: {config.start_date} → {config.end_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 pl-10 border-l border-border-dark/30">
                     <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-50">Strategic Assets</span>
                        <span className="text-3xl font-black text-white tabular-nums">{selectedPortfolioDetails.assets.length}</span>
                     </div>
                  </div>
                </div>

                {/* Compact Preview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Price Index Preview */}
                  <div className="lg:col-span-3 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl group hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <TrendingUp size={18} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Portfolio Index (1Y)</h3>
                    </div>
                    <div className="h-[320px]">
                      {loadingPreview ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6">
                          <RefreshCcw size={32} className="animate-spin text-primary opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40">Syncing index data...</span>
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
                            <XAxis dataKey="date" hide />
                            <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '12px' }}
                              itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: '900' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(val: number) => [val.toFixed(2), "Price Index"]}
                            />
                            <Area type="monotone" dataKey="value" stroke="#13ec5b" strokeWidth={3} fillOpacity={1} fill="url(#colorPreview)" animationDuration={2000} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Weight Distribution Preview */}
                  <div className="lg:col-span-2 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl group hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <PieChartIcon size={18} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Strategic Weights</h3>
                    </div>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={selectedPortfolioDetails.assets.map((pa, idx) => ({
                              name: pa.asset?.ticker || "Unknown",
                              value: pa.weight * 100
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                            label={({ name, value }) => `${name} ${value.toFixed(0)}%`}
                            labelLine={{ stroke: '#333', strokeWidth: 1.5 }}
                            animationDuration={2000}
                          >
                            {selectedPortfolioDetails.assets.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px' }}
                            itemStyle={{ fontWeight: '900', color: '#fff' }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in duration-700">
                <div className="size-24 rounded-[32px] bg-primary/5 border border-primary/10 flex items-center justify-center text-primary mb-8">
                  <PieChartIcon size={48} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-4">Portfolio Analysis</h2>
                <p className="text-text-secondary max-w-md mx-auto font-medium leading-relaxed mb-10">
                  Select a portfolio from the configuration panel to begin backtesting and optimization.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
