"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Calendar, Download, Sliders, Play, BarChart2, BrainCircuit,
  ChevronDown, ChevronRight, ChevronLeft, LineChart as LineChartIcon, Settings as SettingsIcon,
  Search, Info, Trash2, AlertTriangle, X, CheckCircle2, ArrowUpRight, Clock, Layout,
  PieChart as PieChartIcon, Activity, CreditCard, Scale, Coins, History, Plus, RefreshCcw, Star,
  DollarSign, Layers, Zap, Edit3, ToggleLeft, ToggleRight, Target as TargetIcon,
  ShieldAlert, Gauge
} from "lucide-react";
import {
  getPortfolios, getPortfolio, getAssetHistory,
  runPortfolioSimulation, getPortfolioSimulationHistory, getPortfolioSimulationDetails,
  deletePortfolioSimulation, togglePortfolioSimulationFavorite, deleteAllPortfolioSimulations
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'favorites'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    section1: false,
    section2: false,
    section3: true,
    section4: true
  });
  const [collapsedHistory, setCollapsedHistory] = useState<Record<number, boolean>>({});
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Toggles for enabling/disabling sections
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

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const historyData = await getPortfolioSimulationHistory();
      setHistory(historyData);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadData = async () => {
    try {
      const data = await getPortfolios();
      setPortfolios(data);
      await loadHistory();
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  useEffect(() => {
    loadData();
    const portfolioIdFromUrl = searchParams.get('portfolioId');
    if (portfolioIdFromUrl) {
      handlePortfolioChange(Number(portfolioIdFromUrl));
    }
  }, []);

  const loadPortfolioPreview = async (portfolio: Portfolio) => {
    setLoadingPreview(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setFullYear(end.getFullYear() - 1);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      
      const assetHistories = await Promise.all(
        portfolio.assets.map(pa => getAssetHistory(pa.asset_id, startStr, endStr))
      );
      
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
          expensive_buy_ratio: 0.1,
          commission_fee_percent: 0,
          minimum_fee_per_trade: 0
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
      const finalConfig = {
        ...config,
        commission_fee_percent: isFeesEnabled ? config.commission_fee_percent : 0,
        minimum_fee_per_trade: isFeesEnabled ? config.minimum_fee_per_trade : 0,
        maintenance_fee_annual_percent: isFeesEnabled ? config.maintenance_fee_annual_percent : 0,
        asset_configs: Object.fromEntries(
          Object.entries(config.asset_configs).map(([id, cfg]) => [
            id,
            isSmartDcaEnabled ? cfg : { ...cfg, dynamic_timing_enabled: false, dynamic_sizing_enabled: false }
          ])
        )
      };

      const result = await runPortfolioSimulation(finalConfig);
      setSimulation(result);
      await loadHistory();
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Error running simulation. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSimulation = () => {
    setSimulation(null);
    setSelectedPortfolioDetails(null);
    setConfig(prev => ({ ...prev, portfolio_id: 0, asset_configs: {} }));
    setPreviewData([]);
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

  const handleLoadSimulation = async (id: number) => {
    setLoading(true);
    try {
      const details = await getPortfolioSimulationDetails(id);
      setSimulation(details);
      
      if (details.config.portfolio_id) {
        const portDetails = await getPortfolio(details.config.portfolio_id);
        setSelectedPortfolioDetails(portDetails);
      }
      
      setConfig({
        ...details.config,
        start_date: details.config.start_date.split("T")[0],
        end_date: details.config.end_date.split("T")[0]
      });
      
      setIsFeesEnabled(details.config.commission_fee_percent > 0 || details.config.minimum_fee_per_trade > 0 || details.config.maintenance_fee_annual_percent > 0);
      const hasSmart = Object.values(details.config.asset_configs).some(c => c.dynamic_timing_enabled || c.dynamic_sizing_enabled);
      setIsSmartDcaEnabled(hasSmart);
      
    } catch (error) {
      console.error("Error loading simulation details:", error);
      alert("Error loading simulation details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSimulation = async (id: number) => {
    try {
      await deletePortfolioSimulation(id);
      if (simulation?.id === id) setSimulation(null);
      setDeleteConfirm(null);
      await loadHistory();
    } catch (error) {
      console.error("Error deleting simulation:", error);
      alert("Error deleting simulation.");
    }
  };

  const handleDeleteAllSimulations = async () => {
    try {
      const favoritesOnly = activeHistoryTab === 'favorites';
      const nonFavoritesOnly = activeHistoryTab === 'all' && history.some(i => i.is_favorite);
      
      await deleteAllPortfolioSimulations(favoritesOnly, nonFavoritesOnly);
      setShowDeleteAllConfirm(false);
      await loadHistory();
      if (simulation && !history.find(h => h.id === simulation.id)) {
        setSimulation(null);
      }
    } catch (error) {
      console.error("Error deleting simulations:", error);
      alert("Error deleting simulations.");
    }
  };

  const handleCollapseAllHistory = () => {
    const allCollapsed: Record<number, boolean> = {};
    history.forEach(item => {
      allCollapsed[item.id] = true;
    });
    setCollapsedHistory(allCollapsed);
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      {/* Modals */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete Simulation?</h3>
            <p className="text-text-secondary text-sm text-center mb-8">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-6 py-3 rounded-xl border border-border-active bg-surface-dark text-white font-bold hover:bg-border-active transition-colors">Cancel</button>
              <button onClick={() => handleDeleteSimulation(deleteConfirm)} className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              {activeHistoryTab === 'favorites' ? "Clear Favorites?" : "Clear Non-Favorites?"}
            </h3>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowDeleteAllConfirm(false)} className="flex-1 px-6 py-3 rounded-xl border border-border-active bg-surface-dark text-white font-bold hover:bg-border-active transition-colors">Cancel</button>
              <button onClick={handleDeleteAllSimulations} className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <Header />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: Configuration */}
        <aside className={cn(
          "relative flex flex-col border-r border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20",
          leftSidebarOpen ? "w-full max-w-[400px]" : "w-0 border-r-0"
        )}>
          <button 
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className={cn("absolute -right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50 active:scale-95", !leftSidebarOpen && "translate-x-3")}
          >
            {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn("flex flex-col h-full min-w-[400px] transition-opacity duration-300", leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 border-b border-border-dark/30 bg-background-dark/50">
                <button 
                  onClick={handleNewSimulation}
                  className="w-full py-3 px-4 bg-surface-dark border border-border-active hover:border-primary hover:bg-background-dark text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all group"
                >
                  <Plus size={18} className="text-primary group-hover:scale-110 transition-transform" />
                  New Analysis
                </button>
              </div>

              <div className="p-6 pb-2">
                <div className="flex flex-col gap-1 mb-4">
                  <h1 className="text-white tracking-light text-[24px] font-bold leading-tight text-left">Portfolio Config</h1>
                  <p className="text-text-secondary text-sm">Set up your portfolio backtest.</p>
                </div>
              </div>

              {/* 1. Portfolio & Timeline */}
              <div className="border-b border-border-dark/30">
                <div onClick={() => setCollapsedSections(prev => ({ ...prev, section1: !prev.section1 }))} className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Layout size={14} className="text-primary" /> 1. Portfolio & Timeline
                  </h3>
                  <ChevronDown size={14} className={cn("text-text-secondary transition-transform", collapsedSections.section1 && "-rotate-90")} />
                </div>
                {!collapsedSections.section1 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">Target Portfolio</label>
                      <select 
                        className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm cursor-pointer"
                        value={config.portfolio_id}
                        onChange={(e) => handlePortfolioChange(Number(e.target.value))}
                      >
                        <option value={0} disabled>Select a portfolio...</option>
                        {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Start Date</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-3 text-sm" type="date" value={config.start_date} onChange={(e) => setConfig({ ...config, start_date: e.target.value })} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">End Date</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-3 text-sm" type="date" value={config.end_date} onChange={(e) => setConfig({ ...config, end_date: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Capital & Strategy */}
              <div className="border-b border-border-dark/30">
                <div onClick={() => setCollapsedSections(prev => ({ ...prev, section2: !prev.section2 }))} className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <Coins size={14} className="text-primary" /> 2. Capital & Strategy
                  </h3>
                  <ChevronDown size={14} className={cn("text-text-secondary transition-transform", collapsedSections.section2 && "-rotate-90")} />
                </div>
                {!collapsedSections.section2 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Frequency</label>
                        <select className="appearance-none flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm cursor-pointer" value={config.frequency} onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="bi-monthly">Bi-monthly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[13px] font-medium opacity-80">Base Amount ($)</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm" type="number" min="1" step="50" value={config.base_amount} onChange={(e) => setConfig({ ...config, base_amount: Math.max(1, Number(e.target.value)) })} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-white text-[13px] font-medium opacity-80">Investment Mode</label>
                      <select className="appearance-none flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-4 text-sm cursor-pointer" value={config.investment_mode} onChange={(e) => setConfig({ ...config, investment_mode: e.target.value as any })}>
                        <option value="per_contribution">Fixed per contribution</option>
                        <option value="annual">Annual Budget</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Fees */}
              <div className="border-b border-border-dark/30">
                <div onClick={() => setCollapsedSections(prev => ({ ...prev, section3: !prev.section3 }))} className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <CreditCard size={14} className="text-primary" /> 3. FEES & COMMISSIONS
                  </h3>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setIsFeesEnabled(!isFeesEnabled); }} className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all", isFeesEnabled ? "bg-red-400/10 text-red-400 border border-red-400/20" : "bg-surface-dark text-text-secondary border border-border-dark")}>{isFeesEnabled ? "ENABLED" : "DISABLED"}</button>
                    <ChevronDown size={14} className={cn("text-text-secondary transition-transform", collapsedSections.section3 && "-rotate-90")} />
                  </div>
                </div>
                {isFeesEnabled && !collapsedSections.section3 && (
                  <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Trade %</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm" min="0" step="0.1" type="number" value={config.commission_fee_percent} onChange={(e) => setConfig({ ...config, commission_fee_percent: Math.max(0, Number(e.target.value)) })} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Min ($)</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm" min="0" step="0.1" type="number" value={config.minimum_fee_per_trade} onChange={(e) => setConfig({ ...config, minimum_fee_per_trade: Math.max(0, Number(e.target.value)) })} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-white text-[11px] font-medium opacity-80">Maint %</label>
                        <input className="flex w-full rounded-lg text-white border border-border-active bg-surface-dark h-11 px-2 text-center text-sm" min="0" step="0.1" type="number" value={config.maintenance_fee_annual_percent} onChange={(e) => setConfig({ ...config, maintenance_fee_annual_percent: Math.max(0, Number(e.target.value)) })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Smart DCA */}
              <div className="border-b border-border-dark/30">
                <div onClick={() => setCollapsedSections(prev => ({ ...prev, section4: !prev.section4 }))} className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors">
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-primary" /> 4. SMART FEATURES
                  </h3>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setIsSmartDcaEnabled(!isSmartDcaEnabled); }} className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all", isSmartDcaEnabled ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-dark text-text-secondary border border-border-dark")}>{isSmartDcaEnabled ? "ENABLED" : "DISABLED"}</button>
                    <ChevronDown size={14} className={cn("text-text-secondary transition-transform", collapsedSections.section4 && "-rotate-90")} />
                  </div>
                </div>
                {isSmartDcaEnabled && !collapsedSections.section4 && (
                  <div className="px-6 pb-5 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest opacity-40 italic mb-2">Configure parameters per asset:</p>
                    {selectedPortfolioDetails?.assets.map(pa => {
                      const isAnySmartEnabled = config.asset_configs[pa.asset_id]?.dynamic_timing_enabled || config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled;
                      return (
                        <div key={pa.id} className={cn("bg-surface-dark/40 border rounded-xl overflow-hidden transition-all duration-300", isAnySmartEnabled ? "border-primary/20" : "border-border-active/5")}>
                          <div onClick={() => setCollapsedSections(prev => ({ ...prev, [`asset_${pa.asset_id}`]: !prev[`asset_${pa.asset_id}`] }))} className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-light/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn("size-2 rounded-full", isAnySmartEnabled ? "bg-primary animate-pulse" : "bg-border-dark")}></div>
                              <span className="font-black text-white text-[13px] tracking-tight uppercase">{pa.asset?.ticker}</span>
                            </div>
                            <ChevronDown size={12} className={cn("text-text-secondary transition-transform", collapsedSections[`asset_${pa.asset_id}`] && "-rotate-90")} />
                          </div>
                          {!collapsedSections[`asset_${pa.asset_id}`] && (
                            <div className="p-4 pt-0 flex flex-col gap-6 animate-in slide-in-from-top-1">
                              {/* Feature 1: Dynamic Timing */}
                              <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Dynamic Timing</span>
                                  <button onClick={() => updateAssetConfig(pa.asset_id, { dynamic_timing_enabled: !config.asset_configs[pa.asset_id]?.dynamic_timing_enabled })} className={cn("transition-colors", config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? "text-primary" : "text-text-secondary opacity-30")}>
                                    {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  </button>
                                </div>
                                {config.asset_configs[pa.asset_id]?.dynamic_timing_enabled && (
                                  <div className="space-y-2"><div className="flex justify-between text-[9px] font-bold text-text-secondary uppercase"><span>Conservative</span><span className="text-primary">Aggressive ({config.asset_configs[pa.asset_id]?.timing_aggressiveness})</span></div><input type="range" min="0" max="1" step="0.05" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none" value={config.asset_configs[pa.asset_id]?.timing_aggressiveness} onChange={(e) => updateAssetConfig(pa.asset_id, { timing_aggressiveness: Number(e.target.value) })} /></div>
                                )}
                              </div>
                              {/* Feature 2: Dynamic Sizing */}
                              <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Dynamic Sizing</span>
                                  <button onClick={() => updateAssetConfig(pa.asset_id, { dynamic_sizing_enabled: !config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled })} className={cn("transition-colors", config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled ? "text-primary" : "text-text-secondary opacity-30")}>
                                    {config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  </button>
                                </div>
                                {config.asset_configs[pa.asset_id]?.dynamic_sizing_enabled && (
                                  <div className="space-y-2"><div className="flex justify-between text-[9px] font-bold text-text-secondary uppercase"><span>Max Multiplier</span><span className="text-primary">{config.asset_configs[pa.asset_id]?.sizing_multiplier}x</span></div><input type="range" min="1" max="5" step="0.1" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none" value={config.asset_configs[pa.asset_id]?.sizing_multiplier} onChange={(e) => updateAssetConfig(pa.asset_id, { sizing_multiplier: Number(e.target.value) })} /></div>
                                )}
                              </div>
                              {/* Indicators */}
                              <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                                <label className="text-[9px] uppercase font-bold text-text-secondary">Signal Source</label>
                                <select className="bg-background-dark border border-border-active rounded-lg h-8 px-2 text-xs" value={config.asset_configs[pa.asset_id]?.smart_indicator} onChange={(e) => updateAssetConfig(pa.asset_id, { smart_indicator: e.target.value as any })}>
                                  <option value="RSI">RSI (Relative Strength)</option><option value="MA">MA (Moving Average)</option><option value="EMA">EMA (Exponential MA)</option>
                                </select>
                                {config.asset_configs[pa.asset_id]?.smart_indicator === 'RSI' ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-text-secondary uppercase">Buy &lt;</span><input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.rsi_threshold_low} onChange={(e) => updateAssetConfig(pa.asset_id, { rsi_threshold_low: Number(e.target.value) })} /></div>
                                    <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-text-secondary uppercase">Wait &gt;</span><input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.rsi_threshold_high} onChange={(e) => updateAssetConfig(pa.asset_id, { rsi_threshold_high: Number(e.target.value) })} /></div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-text-secondary uppercase">Short</span><input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.ma_period_short} onChange={(e) => updateAssetConfig(pa.asset_id, { ma_period_short: Number(e.target.value) })} /></div>
                                    <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-text-secondary uppercase">Long</span><input type="number" className="bg-background-dark border border-border-active rounded-lg h-7 px-2 text-[10px]" value={config.asset_configs[pa.asset_id]?.ma_period_long} onChange={(e) => updateAssetConfig(pa.asset_id, { ma_period_long: Number(e.target.value) })} /></div>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-3 pt-3 border-t border-border-dark/30">
                                <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Safety Floor</span><span className="text-[10px] font-black text-primary">{(config.asset_configs[pa.asset_id]?.expensive_buy_ratio! * 100).toFixed(0)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" className="w-full h-1 accent-primary bg-surface-light rounded-full appearance-none" value={config.asset_configs[pa.asset_id]?.expensive_buy_ratio} onChange={(e) => updateAssetConfig(pa.asset_id, { expensive_buy_ratio: Number(e.target.value) })} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-border-dark bg-background-dark sticky bottom-0 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <button 
                onClick={handleRunSimulation} 
                disabled={loading || !config.portfolio_id}
                className="w-full py-4 bg-primary text-background-dark font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-[#3af578] shadow-2xl active:scale-[0.98] disabled:opacity-30"
              >
                {loading ? <RefreshCcw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                Analyze Portfolio
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
                <header className="flex justify-between items-start mb-8">
                  <div className="flex flex-col">
                    <h2 className="text-white text-[28px] font-bold leading-tight mb-2">Portfolio Simulation Results</h2>
                    <div className="flex items-center gap-2 text-text-secondary text-sm font-medium opacity-80">
                      <Calendar size={14} />
                      <span>{new Date(simulation.config.start_date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(simulation.config.end_date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="mx-2 opacity-30">•</span>
                      <span className="text-primary font-bold tracking-tight">{selectedPortfolioDetails?.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-text-secondary text-[10px] uppercase font-black tracking-[0.2em] mb-1 opacity-60">Final Portfolio Value</p>
                    <h2 className="text-primary text-4xl font-black tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(19,236,91,0.2)]">
                      ${simulation.results.final_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                  </div>
                </header>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={48} className="text-primary" /></div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Return</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className={cn("text-3xl font-bold", simulation.results.total_return_percent >= 0 ? "text-white" : "text-red-400")}>
                        {simulation.results.total_return_percent > 0 ? "+" : ""}{simulation.results.total_return_percent}%
                      </h3>
                      <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-full flex items-center">
                        <TrendingUp size={10} className="mr-1" /> {(simulation.results.total_return_percent - simulation.results.baseline_return_percent).toFixed(1)}% Alpha
                      </span>
                    </div>
                  </div>
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Download size={48} className="text-slate-400" /></div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Invested</p>
                    <h3 className="text-white text-3xl font-bold">${simulation.results.total_invested.toLocaleString()}</h3>
                  </div>
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Gauge size={48} className="text-yellow-400" /></div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Volatility (Std Dev)</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-white text-3xl font-bold">{simulation.results.volatility || "0.0"}%</h3>
                      <span className="text-text-secondary text-[10px] font-bold opacity-40 uppercase tracking-widest">Risk Index</span>
                    </div>
                  </div>
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert size={48} className="text-red-400" /></div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Max Drawdown</p>
                    <h3 className="text-red-400 text-3xl font-bold">{simulation.results.max_drawdown || "0.0"}%</h3>
                  </div>
                </div>

                {/* Wealth Accumulation Chart */}
                <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 shadow-sm w-full">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div className="flex flex-col">
                      <h3 className="text-white text-lg font-bold flex items-center gap-2"><Activity size={18} className="text-primary" /> Portfolio Growth Evolution</h3>
                      <p className="text-text-secondary text-[11px]">Weekly performance baseline vs smart simulation</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary"></span><span className="text-xs text-white font-bold">Smart Portfolio</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400"></span><span className="text-xs text-text-secondary">Standard DCA</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 border-t-2 border-slate-500 border-dashed"></span><span className="text-xs text-text-secondary">Invested Amount</span></div>
                    </div>
                  </div>
                  <div className="w-full h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulation.results.portfolio_history}>
                        <defs><linearGradient id="gradientSmartPort" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#13ec5b" stopOpacity={0.15}/><stop offset="100%" stopColor="#13ec5b" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" stroke="#9db9a6" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(str) => { const date = new Date(str); return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(-2)}`; }} minTickGap={60} />
                        <YAxis stroke="#9db9a6" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} itemStyle={{ fontSize: '13px', fontWeight: 'bold' }} labelStyle={{ color: '#9db9a6', marginBottom: '8px', fontWeight: 'bold' }} formatter={(value: any) => [`$${Math.round(value).toLocaleString()}`]} />
                        <Area type="monotone" dataKey="smart_value" stroke="#13ec5b" strokeWidth={3} fillOpacity={1} fill="url(#gradientSmartPort)" name="Smart DCA" animationDuration={1500} />
                        <Area type="monotone" dataKey="baseline_value" stroke="#94a3b8" strokeWidth={2} fill="transparent" name="Standard DCA" strokeDasharray="4 4" />
                        <Area type="monotone" dataKey="invested" stroke="#64748b" strokeWidth={1.5} strokeDasharray="8 8" fill="transparent" name="Invested Amount" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Individual Asset Breakdown Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Final Allocation Pie Chart */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6">
                    <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-6"><PieChartIcon size={18} className="text-primary" /> Final Portfolio Allocation</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie data={simulation.results.asset_results.map(ar => ({ name: ar.ticker, value: ar.final_value }))} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {simulation.results.asset_results.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '12px' }} itemStyle={{ fontWeight: 'bold', color: '#fff' }} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Asset Performance Table */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6">
                    <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-6"><Activity size={18} className="text-primary" /> Individual Asset Performance</h3>
                    <div className="space-y-3">
                      {simulation.results.asset_results.map((ar, idx) => (
                        <div key={ar.asset_id} className="bg-background-dark/40 border border-border-active/10 p-4 rounded-xl flex items-center justify-between group hover:border-primary/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-lg flex items-center justify-center font-black text-xs border-2 border-border-dark" style={{ color: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}08` }}>{ar.ticker}</div>
                            <div className="flex flex-col"><span className="text-white font-bold text-sm">{ar.ticker}</span><span className="text-[10px] text-text-secondary opacity-50">{ar.assets_accumulated.toFixed(4)} Units</span></div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={cn("text-lg font-bold tabular-nums", ar.total_return_percent >= 0 ? "text-primary" : "text-red-400")}>{ar.total_return_percent > 0 ? "+" : ""}{ar.total_return_percent.toFixed(1)}%</span>
                            <span className="text-[10px] text-text-secondary opacity-40 font-bold">${Math.round(ar.final_value).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cumulative Fees Chart */}
                <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 shadow-sm w-full">
                  <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-6"><CreditCard size={18} className="text-red-400" /> Cumulative Fees & Strategy Leakage</h3>
                  <div className="w-full h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulation.results.portfolio_history}>
                        <defs><linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.1}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" hide />
                        <YAxis orientation="right" stroke="#9db9a6" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '12px' }} itemStyle={{ color: '#f87171' }} formatter={(val: any) => [`$${val.toLocaleString()}`, "Cumulative Fees"]} />
                        <Area type="monotone" dataKey="cumulative_fees" stroke="#f87171" fillOpacity={1} fill="url(#colorFees)" strokeWidth={2} name="Fees" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-text-secondary/60">
                    <span>Total Fees: ${simulation.results.total_fees.toLocaleString()}</span>
                    <span>Fees Percentage: {simulation.results.fees_percentage}% of Principal</span>
                  </div>
                </div>
              </div>
            ) : selectedPortfolioDetails ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-surface-dark/40 border border-border-active/20 p-8 rounded-[32px] backdrop-blur-sm shadow-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <h2 className="text-3xl font-black text-white tracking-tight leading-tight truncate">{selectedPortfolioDetails.name}</h2>
                    <div className="flex items-center gap-4 text-[10px] text-text-secondary font-black uppercase tracking-widest mt-2 opacity-60">
                      <span className="flex items-center gap-1.5"><Layers size={12} className="text-primary" /> {selectedPortfolioDetails.assets.length} Assets</span>
                      <div className="size-1 rounded-full bg-border-dark"></div>
                      <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary" /> Target: {config.start_date} → {config.end_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 pl-10 border-l border-border-dark/30"><div className="flex flex-col items-end"><span className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-50">Portfolio Size</span><span className="text-3xl font-black text-white tabular-nums">{selectedPortfolioDetails.assets.length}</span></div></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  <div className="lg:col-span-3 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl group hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3 mb-8"><div className="p-2 bg-primary/10 rounded-xl text-primary"><TrendingUp size={18} /></div><h3 className="text-[11px] font-black uppercase tracking-widest text-white">Portfolio Index (1Y)</h3></div>
                    <div className="h-[320px]">
                      {loadingPreview ? <div className="h-full flex flex-col items-center justify-center gap-6"><RefreshCcw size={32} className="animate-spin text-primary opacity-40" /><span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40">Syncing index data...</span></div> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={previewData}><defs><linearGradient id="colorPreview" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#13ec5b" stopOpacity={0.1}/><stop offset="95%" stopColor="#13ec5b" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} opacity={0.4} />
                            <XAxis dataKey="date" hide /><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} /><Tooltip contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '12px' }} itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: '900' }} labelStyle={{ display: 'none' }} formatter={(val: number) => [val.toFixed(2), "Price Index"]} />
                            <Area type="monotone" dataKey="value" stroke="#13ec5b" strokeWidth={3} fillOpacity={1} fill="url(#colorPreview)" animationDuration={2000} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-2xl group hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3 mb-8"><div className="p-2 bg-primary/10 rounded-xl text-primary"><PieChartIcon size={18} /></div><h3 className="text-[11px] font-black uppercase tracking-widest text-white">Strategic Weights</h3></div>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie data={selectedPortfolioDetails.assets.map(pa => ({ name: pa.asset?.ticker || "Unknown", value: pa.weight * 100 }))} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none" label={({ name, value }) => `${name} ${value.toFixed(0)}%`} labelLine={{ stroke: '#333', strokeWidth: 1.5 }} animationDuration={2000}>
                            {selectedPortfolioDetails.assets.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none" />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px' }} itemStyle={{ fontWeight: '900', color: '#fff' }} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in duration-700">
                <div className="size-24 rounded-[32px] bg-primary/5 border border-primary/10 flex items-center justify-center text-primary mb-8"><PieChartIcon size={48} /></div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-4">Portfolio Analysis</h2>
                <p className="text-text-secondary max-w-md mx-auto font-medium leading-relaxed mb-10">Select a portfolio from the configuration panel to begin backtesting and optimization.</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: History */}
        <aside className={cn(
          "relative flex flex-col border-l border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20",
          rightSidebarOpen ? "w-[320px]" : "w-0 border-l-0"
        )}>
          <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={cn("absolute -left-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50 active:scale-95", !rightSidebarOpen && "-translate-x-3")}>
            {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={cn("flex flex-col h-full min-w-[320px] transition-opacity duration-300", rightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
            <div className="p-6 border-b border-border-dark/30">
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-white text-lg font-bold flex items-center gap-2"><History size={18} className="text-primary" /> Past Simulations</h2>
                <div className="flex gap-1">
                  <button onClick={handleCollapseAllHistory} title="Minimize All" className="p-1.5 text-text-secondary hover:text-white transition-colors rounded-md hover:bg-surface-dark"><ChevronDown size={16} className="rotate-180" /></button>
                  <button onClick={() => setShowDeleteAllConfirm(true)} title="Delete All" className="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-md hover:bg-red-400/10"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="text-text-secondary text-[11px] mb-4">Recover your previous analyses</p>
              
              <div className="flex bg-surface-dark/50 p-1 rounded-lg border border-border-active/30">
                <button onClick={() => setActiveHistoryTab('all')} className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", activeHistoryTab === 'all' ? "bg-primary text-background-dark shadow-lg" : "text-text-secondary hover:text-white")}>All ({history.length})</button>
                <button onClick={() => setActiveHistoryTab('favorites')} className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5", activeHistoryTab === 'favorites' ? "bg-primary text-background-dark shadow-lg" : "text-text-secondary hover:text-white")}><Star size={10} fill={activeHistoryTab === 'favorites' ? "currentColor" : "none"} /> Favorites ({history.filter(i => i.is_favorite).length})</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loadingHistory ? <div className="p-10 text-center text-text-secondary text-sm">Loading...</div> : history.length === 0 ? <div className="p-10 text-center text-text-secondary text-sm opacity-50 italic">No historical data yet</div> : (
                <div className="flex flex-col">
                  {history.filter(item => activeHistoryTab === 'all' || item.is_favorite).map((item) => (
                    <div key={item.id} className={cn("border-b border-border-dark/30 hover:bg-surface-dark/30 transition-all text-left relative overflow-hidden", simulation?.id === item.id ? "bg-surface-dark/50 border-l-4 border-l-primary" : "border-l-4 border-l-transparent")}>
                      <div onClick={() => handleLoadSimulation(item.id)} className="p-4 cursor-pointer flex justify-between items-start group">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2"><span className="text-white font-black text-base group-hover:text-primary transition-colors tracking-tight">{item.portfolio_name}</span><span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", item.total_return_percent >= 0 ? "bg-primary/10 text-primary" : "bg-red-400/10 text-red-400")}>{item.total_return_percent > 0 ? "+" : ""}{item.total_return_percent.toFixed(1)}%</span></div>
                          <div className="flex items-center gap-2 mt-0.5"><span className="text-text-secondary text-[10px] font-mono flex items-center gap-1"><Clock size={10} /> {new Date(item.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</span></div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={(e) => handleToggleFavorite(e, item.id)} className={cn("p-2 transition-all rounded-full hover:bg-primary/10", item.is_favorite ? "text-primary" : "text-text-secondary hover:text-primary")}><Star size={14} fill={item.is_favorite ? "currentColor" : "none"} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }} className="p-2 text-text-secondary hover:text-red-400 transition-all rounded-full hover:bg-red-400/10"><Trash2 size={14} /></button>
                          <div onClick={(e) => { e.stopPropagation(); setCollapsedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] })); }} className="p-2 text-text-secondary hover:text-white transition-colors"><div className={cn("transition-transform duration-200", collapsedHistory[item.id] ? "-rotate-90" : "rotate-0")}><ChevronDown size={14} /></div></div>
                        </div>
                      </div>
                      {!collapsedHistory[item.id] && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                          <div className="grid grid-cols-2 gap-y-3 gap-x-4 bg-background-dark/40 rounded-xl p-3 border border-border-dark/20 shadow-inner">
                            <div className="flex flex-col"><span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">Invested</span><span className="text-white text-xs font-bold">${item.total_invested.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
                            <div className="flex flex-col"><span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">Final Value</span><span className="text-white text-xs font-bold">${item.final_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
                          </div>
                          <div className="mt-3 flex justify-between items-center opacity-60">
                            <span className="text-text-secondary text-[10px] flex items-center gap-1.5 font-medium"><Calendar size={12} className="opacity-50" /> {new Date(item.start_date).getFullYear()} - {new Date(item.end_date).getFullYear()}</span>
                            <div className="size-5 rounded-full bg-background-dark flex items-center justify-center border border-border-dark"><ArrowUpRight size={10} className="text-text-secondary" /></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
