"use client";

import { useState, useEffect } from "react";
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
  RefreshCcw
} from "lucide-react";
import { 
  getAssets, 
  runSimulation, 
  getSimulationHistory, 
  getSimulationDetails,
  deleteSimulation,
  getAssetHistory
} from "../lib/api";
import { 
  Asset, 
  SimulationConfig, 
  SimulationResponse, 
  SimulationHistoryItem 
} from "../types/simulation";
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
  Brush,
  Line
} from "recharts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AssetSimulationPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsedHistory, setCollapsedHistory] = useState<Record<number, boolean>>({});
  const [assetPreviewData, setAssetPreviewData] = useState<{date: string, price: number}[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showAssetWarning, setShowAssetWarning] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [isSmartDcaEnabled, setIsSmartDcaEnabled] = useState(true);
  const [visibleContributions, setVisibleContributions] = useState({
    baseline: true,
    smart: true
  });
  const [visibleSeries, setVisibleSeries] = useState({
    smart: true,
    baseline: true,
    invested: true,
    price: true,
    fees: true,
    net: true
  });

  // Form state
  const [config, setConfig] = useState<SimulationConfig>({
    asset_id: 0,
    start_date: "2021-01-01",
    end_date: new Date().toISOString().split("T")[0],
    initial_capital: 1000,
    base_amount: 500,
    frequency: "weekly",
    investment_mode: "per_contribution",
    commission_fee_percent: 0.1,
    minimum_fee_per_trade: 0,
    maintenance_fee_annual_percent: 0,
    dynamic_timing_enabled: true,
    timing_aggressiveness: 0.75,
    dynamic_sizing_enabled: true,
    sizing_multiplier: 2.5,
    smart_indicator: 'RSI',
    rsi_threshold_low: 30,
    rsi_threshold_high: 70,
    ma_period_short: 50,
    ma_period_long: 200,
  });

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getSimulationHistory();
      setHistory(data);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAssetPreview = async (assetId: number) => {
    if (!assetId) return;
    setLoadingPreview(true);
    try {
      const data = await getAssetHistory(assetId, config.start_date, config.end_date);
      setAssetPreviewData(data);
    } catch (error) {
      console.error("Error loading asset preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    getAssets().then((data: Asset[]) => {
      setAssets(data);
    });
    loadHistory();
  }, []);

  const handleNewSimulation = () => {
    setSimulation(null);
    setAssetPreviewData([]);
    setConfig(prev => ({ ...prev, asset_id: 0 }));
  };

  const handleCollapseAllHistory = () => {
    const allCollapsed: Record<number, boolean> = {};
    history.forEach(item => {
      allCollapsed[item.id] = true;
    });
    setCollapsedHistory(allCollapsed);
  };

  const handleDeleteAllSimulations = async () => {
    try {
      // In a real app, we might have a single endpoint for this.
      // For now, let's delete them one by one or suggest adding a backend endpoint.
      // But looking at current API, we only have deleteSimulation(id).
      // Let's do it sequentially for now but inform about efficiency.
      for (const item of history) {
        await deleteSimulation(item.id);
      }
      setSimulation(null);
      setHistory([]);
      setShowDeleteAllConfirm(false);
    } catch (error) {
      console.error("Error deleting all simulations:", error);
      alert("Error deleting all simulations.");
    }
  };

  const handleRunSimulation = async () => {
    if (!config.asset_id || config.asset_id === 0) {
      setShowAssetWarning(true);
      return;
    }
    setLoading(true);
    setSimulation(null); // Clear previous results to avoid undefined issues
    setAssetPreviewData([]); // Clear preview when running simulation
    try {
      const runConfig = {
        ...config,
        dynamic_timing_enabled: isSmartDcaEnabled ? config.dynamic_timing_enabled : false,
        dynamic_sizing_enabled: isSmartDcaEnabled ? config.dynamic_sizing_enabled : false,
      };
      const results = await runSimulation(runConfig as any);
      setSimulation(results);
      loadHistory(); // Refresh history
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Error running simulation. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSimulation = async (id: number) => {
    setLoading(true);
    try {
      const details = await getSimulationDetails(id);
      setSimulation(details);
      // Update config form to match the loaded simulation
      setConfig({
        ...details.config,
        start_date: details.config.start_date.split("T")[0],
        end_date: details.config.end_date.split("T")[0],
        // Ensure all smart fields are present (with defaults if missing)
        smart_indicator: details.config.smart_indicator || 'RSI',
        rsi_threshold_low: details.config.rsi_threshold_low || 30,
        rsi_threshold_high: details.config.rsi_threshold_high || 70,
        ma_period_short: details.config.ma_period_short || 50,
        ma_period_long: details.config.ma_period_long || 200,
        dynamic_timing_enabled: !!details.config.dynamic_timing_enabled,
        dynamic_sizing_enabled: !!details.config.dynamic_sizing_enabled,
      } as any);
      setIsSmartDcaEnabled(!!details.config.dynamic_timing_enabled || !!details.config.dynamic_sizing_enabled);
    } catch (error) {
      console.error("Error loading simulation details:", error);
      alert("Error loading simulation details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSimulation = async (id: number) => {
    try {
      await deleteSimulation(id);
      if (simulation?.id === id) setSimulation(null);
      setDeleteConfirm(null);
      loadHistory();
    } catch (error) {
      console.error("Error deleting simulation:", error);
      alert("Error deleting simulation.");
    }
  };

  const selectedAsset = assets.find((a: Asset) => a.id === config.asset_id);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      {/* Asset Selection Warning Modal */}
      {showAssetWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-yellow-400/10 flex items-center justify-center text-yellow-400 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">No Asset Selected</h3>
            <p className="text-text-secondary text-sm text-center mb-8">
              Please select an asset before running the simulation.
            </p>
            <button 
              onClick={() => setShowAssetWarning(false)}
              className="w-full px-6 py-3 rounded-xl bg-primary text-background-dark font-bold hover:bg-[#3af578] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Clear All History?</h3>
            <p className="text-text-secondary text-sm text-center mb-8">
              This will permanently delete all {history.length} simulations in your history. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-border-active bg-surface-dark text-white font-bold hover:bg-border-active transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAllSimulations}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete Simulation?</h3>
            <p className="text-text-secondary text-sm text-center mb-8">
              This action cannot be undone. All data associated with this simulation will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-border-active bg-surface-dark text-white font-bold hover:bg-border-active transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteSimulation(deleteConfirm)}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 flex-shrink-0 z-20 bg-background-dark">
        <div className="flex items-center gap-4 text-white">
          <div className="size-8 text-primary flex items-center justify-center rounded-lg bg-primary/10">
            <LineChartIcon size={20} />
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] hidden sm:block">Portfolio-Lab</h2>
        </div>

        <div className="flex flex-1 justify-end items-center gap-4">
          <div className="hidden md:flex items-center gap-6 border-l border-border-dark pl-6">
            <div className="flex items-center gap-6">
            <a className="text-white text-sm font-medium leading-normal border-b-2 border-primary pb-0.5" href="#">Asset</a>
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium leading-normal" href="#">Settings</a>
          </div>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-border-dark overflow-hidden">
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6FEfyCMU5tIgsG5lpl75XFWc16gRg42Yb9rxpGvHRi_s4_kosZicLAFzxAdGrmN9ENPAqBDRkAFt7OTV5peIv8MkTG7QYA9lyWuxQ5JbmPSsa6IxFPO8uwF-K8whM2vt_vcTxgZbfX4iWo9vBkhcg6t86lnbMRfiUZL4RSJot7ojvOWvoC3GRiToh3FhzylUnEgrczl5VhSaUSF-V_eqQ4cz8-uG4Et6rXDz4shvZRk1Mq12gjpw9S9U-IfGDY0bPZ6RyjRzSeO7d" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

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
            title={leftSidebarOpen ? "Hide Configuration" : "Show Configuration"}
          >
            {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[400px] transition-opacity duration-300",
            leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 border-b border-border-dark/30 bg-background-dark/50">
            <button 
              onClick={handleNewSimulation}
              className="w-full py-3 px-4 bg-surface-dark border border-border-active hover:border-primary hover:bg-background-dark text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all group"
            >
              <Plus size={18} className="text-primary group-hover:scale-110 transition-transform" />
              New Simulation
            </button>
          </div>

          <div className="p-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <h1 className="text-white tracking-light text-[24px] font-bold leading-tight text-left">Configuration</h1>
                  <button
                    onClick={() => setIsSmartDcaEnabled(!isSmartDcaEnabled)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                      isSmartDcaEnabled 
                        ? "bg-primary/20 text-primary border border-primary/30" 
                        : "bg-surface-dark text-text-secondary border border-border-dark"
                    )}
                  >
                    Smart DCA: {isSmartDcaEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <p className="text-text-secondary text-sm">Set up your {isSmartDcaEnabled ? 'smart' : 'baseline'} DCA parameters.</p>
          </div>

          {/* 1. Asset & Dates Section */}
          <div className="border-b border-border-dark/30">
            <div 
              onClick={() => setCollapsedSections(prev => ({ ...prev, section1: !prev.section1 }))}
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
            >
              <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                <Layout size={14} className="text-primary" />
                1. Asset & Timeline
              </h3>
              <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section1 && "-rotate-90")}>
                <ChevronDown size={14} />
              </div>
            </div>
            
            {!collapsedSections.section1 && (
              <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col gap-2">
                  <label className="text-white text-[13px] font-medium opacity-80">Target Asset</label>
                  <div className="relative">
                    <select 
                      className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm font-normal cursor-pointer"
                      value={config.asset_id}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setConfig({ ...config, asset_id: newId });
                        if (newId === 0) {
                          setAssetPreviewData([]);
                          setSimulation(null);
                        } else if (!simulation) {
                          loadAssetPreview(newId);
                        } else {
                          // If changing asset after simulation, revert to preview mode
                          setSimulation(null);
                          loadAssetPreview(newId);
                        }
                      }}
                    >
                      <option value={0} disabled>Select an asset...</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.ticker})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Start Date</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-3 text-sm"
                      type="date" 
                      value={config.start_date}
                      onChange={(e) => {
                        setConfig({ ...config, start_date: e.target.value });
                        if (!simulation) loadAssetPreview(config.asset_id);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">End Date</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-3 text-sm"
                      type="date" 
                      value={config.end_date}
                      onChange={(e) => {
                        setConfig({ ...config, end_date: e.target.value });
                        if (!simulation) loadAssetPreview(config.asset_id);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Capital & Investment Section */}
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
                    <label className="text-white text-[13px] font-medium opacity-80">Initial Capital ($)</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm"
                      type="number" 
                      value={config.initial_capital}
                      onChange={(e) => setConfig({ ...config, initial_capital: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Investment Mode</label>
                    <div className="relative">
                      <select 
                        className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-[12px] cursor-pointer"
                        value={config.investment_mode}
                        onChange={(e) => setConfig({ ...config, investment_mode: e.target.value as any })}
                      >
                        <option value="per_contribution">Fixed Amount</option>
                        <option value="annual">Annual Budget</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">Frequency</label>
                    <div className="relative">
                      <select 
                        className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm cursor-pointer"
                        value={config.frequency}
                        onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[13px] font-medium opacity-80">
                      {config.investment_mode === "annual" ? "Annual ($)" : "Trade ($)"}
                    </label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-4 text-sm"
                      type="number" 
                      value={config.base_amount}
                      onChange={(e) => setConfig({ ...config, base_amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Fees Section */}
          <div className="border-b border-border-dark/30">
            <div 
              onClick={() => setCollapsedSections(prev => ({ ...prev, section3: !prev.section3 }))}
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
            >
              <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                <CreditCard size={14} className="text-primary" />
                3. Commissions & Fees
              </h3>
              <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section3 && "-rotate-90")}>
                <ChevronDown size={14} />
              </div>
            </div>

            {!collapsedSections.section3 && (
              <div className="px-6 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[11px] font-medium opacity-80">Trade %</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                      step="0.01" 
                      type="number" 
                      value={config.commission_fee_percent}
                      onChange={(e) => setConfig({ ...config, commission_fee_percent: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[11px] font-medium opacity-80">Min ($)</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                      step="0.1" 
                      type="number" 
                      value={config.minimum_fee_per_trade}
                      onChange={(e) => setConfig({ ...config, minimum_fee_per_trade: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[11px] font-medium opacity-80">Maint %</label>
                    <input 
                      className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-11 px-2 text-center text-sm"
                      step="0.01" 
                      type="number" 
                      value={config.maintenance_fee_annual_percent}
                      onChange={(e) => setConfig({ ...config, maintenance_fee_annual_percent: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Smart Optimization Section */}
              {isSmartDcaEnabled && (
          <div className="border-b border-border-dark/30">
            <div 
              onClick={() => setCollapsedSections(prev => ({ ...prev, section4: !prev.section4 }))}
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-dark/30 transition-colors"
            >
              <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2">
                <BrainCircuit size={14} className="text-primary" />
                4. Smart Optimization
              </h3>
              <div className={cn("text-text-secondary transition-transform duration-200", collapsedSections.section4 && "-rotate-90")}>
                <ChevronDown size={14} />
              </div>
            </div>

            {!collapsedSections.section4 && (
              <div className="px-6 pb-5 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-200">
                      {/* Indicator Selection */}
                      <div className="bg-surface-dark rounded-xl p-4 border border-border-active/50">
                        <div className="flex flex-col gap-3">
                          <label className="text-white text-[13px] font-medium opacity-80 flex items-center gap-2">
                            <Activity size={14} className="text-primary" />
                            Smart Indicator
                          </label>
                          <div className="relative">
                            <select 
                              className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-10 px-4 text-sm cursor-pointer"
                              value={config.smart_indicator}
                              onChange={(e) => setConfig({ ...config, smart_indicator: e.target.value as any })}
                            >
                              <option value="RSI">RSI (Relative Strength Index)</option>
                              <option value="MA">Simple Moving Average</option>
                              <option value="EMA">Exponential Moving Average</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                              <ChevronDown size={14} />
                            </div>
                          </div>

                          {/* RSI Specific Params */}
                          {config.smart_indicator === 'RSI' && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">Oversold (Buy)</label>
                                <input 
                                  className="flex w-full rounded-lg text-white border border-border-active bg-background-dark h-9 px-3 text-xs"
                                  type="number" 
                                  value={config.rsi_threshold_low}
                                  onChange={(e) => setConfig({ ...config, rsi_threshold_low: Number(e.target.value) })}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">Overbought (Sell)</label>
                                <input 
                                  className="flex w-full rounded-lg text-white border border-border-active bg-background-dark h-9 px-3 text-xs"
                                  type="number" 
                                  value={config.rsi_threshold_high}
                                  onChange={(e) => setConfig({ ...config, rsi_threshold_high: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          )}

                          {/* MA or EMA Specific Params */}
                          {(config.smart_indicator === 'MA' || config.smart_indicator === 'EMA') && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">Short Period</label>
                                <input 
                                  className="flex w-full rounded-lg text-white border border-border-active bg-background-dark h-9 px-3 text-xs"
                                  type="number" 
                                  value={config.ma_period_short}
                                  onChange={(e) => setConfig({ ...config, ma_period_short: Number(e.target.value) })}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">Long Period</label>
                                <input 
                                  className="flex w-full rounded-lg text-white border border-border-active bg-background-dark h-9 px-3 text-xs"
                                  type="number" 
                                  value={config.ma_period_long}
                                  onChange={(e) => setConfig({ ...config, ma_period_long: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                {/* Feature 1: Dynamic Timing */}
                <div className="bg-surface-dark rounded-xl p-4 border border-border-active/50">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-sm">Dynamic Timing</span>
                      <span className="text-text-secondary text-xs">Adjust buy timing on volatility</span>
                    </div>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfig({ ...config, dynamic_timing_enabled: !config.dynamic_timing_enabled });
                      }}
                      className={cn(
                        "relative inline-block w-10 h-5 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out select-none",
                        config.dynamic_timing_enabled ? "bg-primary" : "bg-border-dark"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        config.dynamic_timing_enabled ? "translate-x-5" : "translate-x-0"
                      )} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Conservative</span>
                      <span className="text-primary font-bold">Aggressive ({config.timing_aggressiveness})</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={config.timing_aggressiveness}
                      onChange={(e) => setConfig({ ...config, timing_aggressiveness: Number(e.target.value) })}
                      className="w-full" 
                    />
                  </div>
                </div>

                {/* Feature 2: Dynamic Sizing */}
                <div className="bg-surface-dark rounded-xl p-4 border border-border-active/50">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-sm">Dynamic Sizing</span>
                      <span className="text-text-secondary text-xs">Increase amount on dips</span>
                    </div>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfig({ ...config, dynamic_sizing_enabled: !config.dynamic_sizing_enabled });
                      }}
                      className={cn(
                        "relative inline-block w-10 h-5 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out select-none",
                        config.dynamic_sizing_enabled ? "bg-primary" : "bg-border-dark"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        config.dynamic_sizing_enabled ? "translate-x-5" : "translate-x-0"
                      )} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>1.0x</span>
                      <span className="text-primary font-bold">{config.sizing_multiplier}x Max Multiplier</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="0.1" 
                      value={config.sizing_multiplier}
                      onChange={(e) => setConfig({ ...config, sizing_multiplier: Number(e.target.value) })}
                      className="w-full" 
                    />
                  </div>
                </div>
                    </div>
                  )}
              </div>
            )}
          </div>

            {/* Sticky Run Button */}
            <div className="p-6 border-t border-border-dark bg-background-dark sticky bottom-0 z-20">
            <button 
              onClick={handleRunSimulation}
              disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-background-dark text-lg font-bold leading-normal hover:bg-[#3af578] transition-all shadow-[0_0_20px_rgba(19,236,91,0.3)] active:scale-[0.98] disabled:opacity-50"
            >
                {loading ? <RefreshCcw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                  Run Simulation
            </button>
            </div>
          </div>
        </aside>


        {/* Main Content: Results */}
        <main className="flex-1 flex flex-col bg-[#0b0f0c] overflow-hidden relative">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
            {simulation ? (
              <>
                <header className="flex justify-between items-start mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col">
                      <h2 className="text-white text-[28px] font-bold leading-tight mb-2">Simulation Results</h2>
                      <div className="flex items-center gap-2 text-text-secondary text-sm font-medium opacity-80">
                        <Calendar size={14} />
                        <span>{new Date(simulation.config.start_date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(simulation.config.end_date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span className="mx-2 opacity-30">•</span>
                        <span className="text-primary font-bold tracking-tight">{selectedAsset?.name} ({selectedAsset?.ticker})</span>
                      </div>
                    </div>
            <div className="text-right">
              <p className="text-text-secondary text-[10px] uppercase font-black tracking-[0.2em] mb-1 opacity-60">Final Portfolio Value</p>
              <h2 className="text-primary text-4xl font-black tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(19,236,91,0.2)]">
                ${simulation.results.final_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                  {/* Card 1: Smart DCA */}
                  {isSmartDcaEnabled && (
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={64} className="text-primary" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-text-secondary text-sm font-medium">Total Return (Smart DCA)</p>
                      <div className="group/info relative cursor-help">
                        <Info size={14} className="text-text-secondary" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                          Total return percentage including the smart strategies applied over the invested capital.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className={cn("text-3xl font-bold", simulation.results.total_return_percent >= 0 ? "text-white" : "text-red-400")}>
                        {simulation.results.total_return_percent > 0 ? "+" : ""}{simulation.results.total_return_percent}%
                      </h3>
                      <span className="text-primary text-sm font-bold bg-primary/10 px-2 py-0.5 rounded-full flex items-center">
                        <TrendingUp size={12} className="mr-1" /> { (simulation.results.total_return_percent - simulation.results.baseline_return_percent).toFixed(1) }% vs Base
                      </span>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Final Value: ${simulation.results.final_value.toLocaleString()}</p>
                  </div>
                  )}

                  {/* Card 2: Baseline */}
                  <div className={cn(
                    "bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden",
                    !isSmartDcaEnabled && "sm:col-span-2 lg:col-span-2"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-text-secondary text-sm font-medium">Total Return (Standard DCA)</p>
                      <div className="group/info relative cursor-help">
                        <Info size={14} className="text-text-secondary" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                          Return you would have obtained with a fixed recurring investment strategy (Standard DCA) without dynamic adjustments.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-white text-3xl font-bold">{simulation.results.baseline_return_percent > 0 ? "+" : ""}{ simulation.results.baseline_return_percent }%</h3>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Final Value: ${ simulation.results.baseline_final_value.toLocaleString() }</p>
                  </div>

                  {/* Card 3: Total Invested */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Download size={64} className="text-slate-400" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-text-secondary text-sm font-medium">Total Invested Amount</p>
                      <div className="group/info relative cursor-help">
                        <Info size={14} className="text-text-secondary" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                          Total amount of money out of your pocket that has been invested in the asset throughout the entire period.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-white text-3xl font-bold">${simulation.results.total_invested.toLocaleString()}</h3>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Excluding fees and maintenance</p>
                  </div>
                </div>

                {/* Main Chart Area */}
                <div className="flex flex-col gap-10 mb-10 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
                  {/* Portfolio Growth Chart - FULL WIDTH (100%) */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 shadow-sm w-full">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                      <div className="flex flex-col">
                        <h3 className="text-white text-lg font-bold flex items-center gap-2">
                          <Activity size={18} className="text-primary" />
                          Portfolio Value Growth
                        </h3>
                        <p className="text-text-secondary text-[11px]">Cumulative capital growth {isSmartDcaEnabled ? 'vs baseline investment' : ''}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {isSmartDcaEnabled && (
                        <div 
                          className={cn("flex items-center gap-2 cursor-pointer transition-opacity", !visibleSeries.smart && "opacity-30")}
                          onClick={() => setVisibleSeries(prev => ({ ...prev, smart: !prev.smart }))}
                        >
                          <span className="w-3 h-3 rounded-full bg-primary"></span>
                          <span className="text-xs text-white">Smart DCA</span>
                        </div>
                        )}
                        <div 
                          className={cn("flex items-center gap-2 cursor-pointer transition-opacity", !visibleSeries.baseline && "opacity-30")}
                          onClick={() => setVisibleSeries(prev => ({ ...prev, baseline: !prev.baseline }))}
                        >
                          <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                          <span className="text-xs text-text-secondary">Standard DCA</span>
                        </div>
                        <div 
                          className={cn("flex items-center gap-2 cursor-pointer transition-opacity", !visibleSeries.invested && "opacity-30")}
                          onClick={() => setVisibleSeries(prev => ({ ...prev, invested: !prev.invested }))}
                        >
                          <span className="w-3 h-3 border-t-2 border-slate-500 border-dashed"></span>
                          <span className="text-xs text-text-secondary">Invested Amount</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={simulation.results.portfolio_history}>
                          <defs>
                            <linearGradient id="gradientSmart" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#13ec5b" stopOpacity={0.2}/>
                              <stop offset="100%" stopColor="#13ec5b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#9db9a6" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(str) => {
                              const date = new Date(str);
                              return date.getFullYear().toString();
                            }}
                            interval={Math.floor(simulation.results.portfolio_history.length / 5)}
                          />
                          <YAxis 
                            stroke="#9db9a6" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                            labelStyle={{ color: '#9db9a6', marginBottom: '8px', fontWeight: 'bold' }}
                            formatter={(value: any, name: string) => [`$${value.toLocaleString()}`, name]}
                          />
                          {isSmartDcaEnabled && visibleSeries.smart && (
                            <Area 
                              type="monotone" 
                              dataKey="smart_value" 
                              stroke="#13ec5b" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#gradientSmart)" 
                              name="Smart DCA"
                            />
                          )}
                          {visibleSeries.baseline && (
                            <Area 
                              type="monotone" 
                              dataKey="baseline_value" 
                              stroke="#94a3b8" 
                              strokeWidth={2}
                              fill="transparent"
                              name="Standard DCA"
                            />
                          )}
                          {visibleSeries.invested && (
                            <Area 
                              type="monotone" 
                              dataKey="invested" 
                              stroke="#64748b" 
                              strokeWidth={1.5}
                              strokeDasharray="5 5"
                              fill="transparent"
                              name="Invested Amount"
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Asset Price Chart - FULL WIDTH (100%) */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-300 w-full">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                      <div className="flex flex-col">
                        <h3 className="text-white text-lg font-bold flex items-center gap-2">
                          <Activity size={18} className="text-blue-400" />
                          Asset Price Reference
                        </h3>
                        <p className="text-text-secondary text-[11px]">Historical price action for reference</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                        <span className="text-xs text-text-secondary font-bold">Price Line</span>
                      </div>
                    </div>
                    <div className="w-full h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={simulation.results.portfolio_history} syncId="syncTerminal" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                          <XAxis dataKey="date" hide />
                          <YAxis 
                            orientation="right"
                            stroke="#9db9a6" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => `$${Math.round(value).toLocaleString()}`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                            formatter={(value: any) => [`$${value.toLocaleString()}`, "Price"]}
                            labelStyle={{ color: '#9db9a6', fontSize: '10px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="close" 
                            stroke="#60a5fa" 
                            fillOpacity={1} 
                            fill="url(#colorPrice)" 
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Smart Indicator Chart - FULL WIDTH */}
                  {isSmartDcaEnabled && (
                    <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-350 w-full shadow-lg">
                      <div className="flex flex-col mb-4">
                        <h3 className="text-white text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                          <BrainCircuit size={16} className="text-primary" />
                          {config.smart_indicator} Indicator
                        </h3>
                        <p className="text-text-secondary text-[10px]">Technical analysis used for trade decisions</p>
                      </div>
                      <div className="w-full h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={simulation.results.portfolio_history} syncId="syncTerminal" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis 
                              orientation="right"
                              stroke="#9db9a6" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              domain={config.smart_indicator === 'RSI' ? [0, 100] : ['auto', 'auto']}
                              tickFormatter={(value) => value.toFixed(1)}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                              itemStyle={{ fontSize: '11px' }}
                              labelStyle={{ color: '#9db9a6', marginBottom: '4px', fontSize: '10px' }}
                              formatter={(value: any, name: string) => {
                                if (name === 'ma_short') return [value.toFixed(2), `MA ${config.ma_period_short}`];
                                if (name === 'ma_long') return [value.toFixed(2), `MA ${config.ma_period_long}`];
                                return [value.toFixed(4), config.smart_indicator];
                              }}
                            />
                            {config.smart_indicator === 'MA' || config.smart_indicator === 'EMA' ? (
                              <>
                                <Line type="monotone" dataKey="ma_short" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="ma_short" isAnimationActive={false} />
                                <Line type="monotone" dataKey="ma_long" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="ma_long" isAnimationActive={false} />
                              </>
                            ) : (
                              <Line type="monotone" dataKey="indicator_value" stroke="#13ec5b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                            )}
                            {config.smart_indicator === 'RSI' && (
                              <>
                                <Line dataKey={() => config.rsi_threshold_low} stroke="#f87171" strokeDasharray="3 3" dot={false} strokeWidth={1} opacity={0.3} />
                                <Line dataKey={() => config.rsi_threshold_high} stroke="#f87171" strokeDasharray="3 3" dot={false} strokeWidth={1} opacity={0.3} />
                              </>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Contributions Timeline Chart - FULL WIDTH */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-400 w-full shadow-lg">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                      <div className="flex flex-col">
                        <h3 className="text-white text-lg font-bold flex items-center gap-2">
                          <Coins size={18} className="text-primary" />
                          Contributions Timeline
                        </h3>
                        <p className="text-text-secondary text-[11px]">Compare exact contribution amounts and timing</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {isSmartDcaEnabled && (
                          <div 
                            className={cn("flex items-center gap-2 cursor-pointer transition-opacity", !visibleContributions.smart && "opacity-30")}
                            onClick={() => setVisibleContributions(prev => ({ ...prev, smart: !prev.smart }))}
                          >
                            <span className="w-3 h-3 rounded-sm bg-primary"></span>
                            <span className="text-xs text-white">Smart Contribution</span>
                          </div>
                        )}
                        <div 
                          className={cn("flex items-center gap-2 cursor-pointer transition-opacity", !visibleContributions.baseline && "opacity-30")}
                          onClick={() => setVisibleContributions(prev => ({ ...prev, baseline: !prev.baseline }))}
                        >
                          <span className="w-3 h-3 rounded-sm bg-slate-400/30 border border-slate-400/50"></span>
                          <span className="text-xs text-text-secondary">Standard Contribution</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={simulation.results.portfolio_history} syncId="syncTerminal" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#9db9a6" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(str) => {
                              const date = new Date(str);
                              return `${date.getMonth()+1}/${date.getFullYear().toString().slice(-2)}`;
                            }}
                          />
                          <YAxis 
                            orientation="right"
                            stroke="#9db9a6" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                            labelStyle={{ color: '#9db9a6', marginBottom: '8px', fontWeight: 'bold' }}
                            formatter={(value: any, name: string) => [`$${Number(value).toLocaleString()}`, name === 's_contribution' ? 'Smart DCA' : 'Standard DCA']}
                          />
                          {visibleContributions.baseline && (
                            <Bar dataKey="b_contribution" fill="#94a3b8" opacity={0.3} name="Standard DCA" barSize={48} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                          )}
                          {isSmartDcaEnabled && visibleContributions.smart && (
                            <Bar dataKey="s_contribution" fill="#13ec5b" name="Smart DCA" barSize={48} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                          )}
                          <Brush 
                            dataKey="date" 
                            height={40} 
                            stroke="#3b5443" 
                            fill="#0b0f0c"
                            travellerWidth={10}
                            tickFormatter={() => ""}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Fees & Net Value Impact Section - FULL WIDTH */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-200 w-full mx-auto">
                    {/* Cumulative Fees Over Time */}
                    <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                          <h3 className="text-white text-[16px] font-bold flex items-center gap-2">
                            <CreditCard size={16} className="text-red-400" />
                            Commissions Cost
                          </h3>
                          <p className="text-text-secondary text-[11px]">Cumulative fees impact over time</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-400 text-lg font-bold tabular-nums">-${simulation.results.total_fees.toLocaleString()}</p>
                          <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest">{simulation.results.fees_percentage}% del total invertido</p>
                        </div>
                      </div>
                      <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={simulation.results.portfolio_history}>
                            <defs>
                              <linearGradient id="gradientFees" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f87171" stopOpacity={0.2}/>
                                <stop offset="100%" stopColor="#f87171" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis 
                              stroke="#9db9a6" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                              itemStyle={{ fontSize: '11px', color: '#f87171' }}
                              labelStyle={{ color: '#9db9a6', marginBottom: '4px' }}
                              formatter={(value: any) => [`$${value.toLocaleString()}`, "Fees"]}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="cumulative_fees" 
                              stroke="#f87171" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#gradientFees)" 
                              name="Cumulative Fees"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Gross vs Net Final Value */}
                    <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 flex flex-col justify-between shadow-sm">
                      <div className="flex flex-col gap-1 mb-4">
                        <h3 className="text-white text-[16px] font-bold flex items-center gap-2">
                          <Scale size={16} className="text-primary" />
                          Gross vs Net Value
                        </h3>
                        <p className="text-text-secondary text-[11px]">Profitability impact after all fees</p>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center gap-6">
                        {/* Comparison Bars */}
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-text-secondary uppercase">Gross Value (Before Fees)</span>
                              <span className="text-white">${(simulation.results.final_value + simulation.results.total_fees).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-full h-4 bg-border-dark rounded-full overflow-hidden">
                              <div className="h-full bg-slate-500 w-full"></div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-primary uppercase">Net Value (After Fees)</span>
                              <span className="text-primary">${simulation.results.final_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-full h-4 bg-border-dark rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${(simulation.results.final_value / (simulation.results.final_value + simulation.results.total_fees) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Fee Impact Info */}
                        <div className="bg-background-dark/50 rounded-lg p-4 border border-border-dark/50 flex items-center gap-4">
                          <div className="size-12 rounded-full border-4 border-red-400/30 border-t-red-400 flex items-center justify-center text-[10px] font-bold text-red-400">
                            {simulation.results.fees_percentage}%
                          </div>
                          <div>
                            <p className="text-white text-xs font-bold">Coste de Comisiones</p>
                            <p className="text-text-secondary text-[10px]">Las comisiones han reducido tu rentabilidad total en un {simulation.results.fees_percentage}%.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10 animate-in fade-in slide-in-from-top-4 duration-500 delay-500">
                  {/* Performance Metrics Table */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 h-fit">
                    <div className="flex items-center gap-2 mb-4">
                      <h4 className="text-white font-bold">Strategy Metrics</h4>
                      <div className="group/info relative cursor-help">
                        <Info size={14} className="text-text-secondary" />
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                          {isSmartDcaEnabled ? 'Detailed comparison between the baseline and optimized strategy.' : 'Detailed metrics of your DCA strategy.'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm">Avg. Purchase Price</span>
                          <div className="group/info relative cursor-help">
                            <Info size={12} className="text-text-secondary/50" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                              The average price at which you bought the asset during the entire period.
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-slate-400" title="Standard DCA">${ simulation.results.baseline_avg_purchase_price.toLocaleString(undefined, { maximumFractionDigits: 0 }) }</span>
                      {isSmartDcaEnabled && (
                          <span className="text-primary" title="Smart DCA">${ simulation.results.avg_purchase_price.toLocaleString(undefined, { maximumFractionDigits: 0 }) }</span>
                      )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm">Total Assets</span>
                          <div className="group/info relative cursor-help">
                            <Info size={12} className="text-text-secondary/50" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                              Total units of the asset accumulated.
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm font-medium text-white">
                           {simulation.results.total_assets_accumulated.toFixed(4)} {selectedAsset?.ticker}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm">Total Fees Paid</span>
                          <div className="group/info relative cursor-help">
                            <Info size={12} className="text-text-secondary/50" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                              Total sum of purchase and annual maintenance fees.
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-red-400">${simulation.results.total_fees.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm">DCA Efficiency</span>
                          <div className="group/info relative cursor-help">
                            <Info size={12} className="text-text-secondary/50" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-background-dark border border-border-active rounded text-[10px] text-white opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
                              Improvement in the average price compared to buying all at once on day one.
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-primary">{simulation.results.dca_efficiency > 0 ? "+" : ""}{simulation.results.dca_efficiency}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Accumulation Mini Chart */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 h-fit shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <h4 className="text-white font-bold flex items-center gap-2">
                          <PieChart size={16} className="text-primary" />
                          Asset Accumulation
                        </h4>
                        <p className="text-text-secondary text-[11px]">Cumulative units over time</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-xl font-black">{simulation.results.total_assets_accumulated.toFixed(4)}</p>
                        <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest">{selectedAsset?.ticker}</p>
                      </div>
                    </div>
                    
                    <div className="w-full h-[120px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={simulation.results.portfolio_history.filter((_, i) => i % 30 === 0 || i === simulation.results.portfolio_history.length - 1)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                          <XAxis dataKey="date" hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '11px', color: '#13ec5b' }}
                            labelStyle={{ color: '#9db9a6', marginBottom: '4px', fontSize: '10px' }}
                            formatter={(value: any) => [`${Number(value).toFixed(4)} units`, "Accumulated"]}
                          />
                          <Bar dataKey="smart_value" radius={[2, 2, 0, 0]}>
                            {simulation.results.portfolio_history.filter((_, i) => i % 30 === 0 || i === simulation.results.portfolio_history.length - 1).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill="#13ec5b" fillOpacity={0.3 + (index / 25)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : assetPreviewData.length > 0 ? (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                <header className="flex flex-col">
                  <h2 className="text-white text-[28px] font-bold leading-tight mb-2">Market Overview</h2>
                  <div className="flex items-center gap-2 text-text-secondary text-sm font-medium opacity-80">
                    <LineChartIcon size={14} className="text-primary" />
                    <span>Historical performance for </span>
                    <span className="text-primary font-bold">{selectedAsset?.name} ({selectedAsset?.ticker})</span>
                  </div>
                </header>

                <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                    <Activity size={200} className="text-primary" />
                  </div>
                  
                  <div className="flex justify-between items-end mb-8 relative z-10">
                    <div>
                      <p className="text-text-secondary text-xs uppercase font-black tracking-widest mb-1">Current Reference Price</p>
                      <h3 className="text-white text-4xl font-black tabular-nums">
                        ${assetPreviewData[assetPreviewData.length - 1].price.toLocaleString()}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-text-secondary text-xs uppercase font-black tracking-widest mb-1">Period Range</p>
                      <p className="text-white font-bold">{new Date(config.start_date).getFullYear()} — {new Date(config.end_date).getFullYear()}</p>
                    </div>
                  </div>

                  <div className="w-full h-[400px] relative z-10">
                    {loadingPreview && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background-dark/20 backdrop-blur-[2px] z-20 rounded-xl">
                        <RefreshCcw size={30} className="text-primary animate-spin" />
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={assetPreviewData}>
                        <defs>
                          <linearGradient id="previewGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#13ec5b" stopOpacity={0.1}/>
                            <stop offset="100%" stopColor="#13ec5b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9db9a6" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(str) => {
                            const date = new Date(str);
                            return date.getFullYear().toString();
                          }}
                          interval={Math.floor(assetPreviewData.length / 6)}
                        />
                        <YAxis 
                          stroke="#9db9a6" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                          itemStyle={{ fontSize: '14px', color: '#13ec5b', fontWeight: 'bold' }}
                          labelStyle={{ color: '#9db9a6', marginBottom: '8px' }}
                          formatter={(value: any) => [`$${value.toLocaleString()}`, "Price"]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#13ec5b" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#previewGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-center gap-4 py-4 bg-primary/5 rounded-xl border border-primary/10">
                    <span className="text-primary">
                      <Info size={18} />
                    </span>
                    <p className="text-sm text-text-secondary">
                      You are viewing the <span className="text-white font-bold text-base">historical price</span>. Adjust your strategy and click <span className="text-primary font-black uppercase tracking-tight">Run Simulation</span> to analyze results.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-700">
                <div className="size-24 rounded-full bg-surface-dark border border-border-active flex items-center justify-center mb-8 relative group">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping group-hover:animate-none opacity-20"></div>
                  <Sliders size={48} className="text-primary relative z-10" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Ready to Start?</h2>
                <p className="text-text-secondary max-w-sm leading-relaxed">
                  Select an asset from the list to see its history and configure your smart DCA strategy.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: History */}
        <aside className={cn(
          "relative flex flex-col border-l border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20",
          rightSidebarOpen ? "w-[320px]" : "w-0 border-l-0"
        )}>
          {/* Toggle Handle Right */}
          <button 
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className={cn(
              "absolute -left-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-50 active:scale-95",
              !rightSidebarOpen && "-translate-x-3"
            )}
            title={rightSidebarOpen ? "Hide History" : "Show History"}
          >
            {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[320px] transition-opacity duration-300",
            rightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
          <div className="p-6 border-b border-border-dark/30">
              <div className="flex justify-between items-start mb-1">
            <h2 className="text-white text-lg font-bold flex items-center gap-2">
              <History size={18} className="text-primary" />
              Past Simulations
            </h2>
                <div className="flex gap-1">
                  <button 
                    onClick={handleCollapseAllHistory}
                    title="Minimize All"
                    className="p-1.5 text-text-secondary hover:text-white transition-colors rounded-md hover:bg-surface-dark"
                  >
                    <ChevronDown size={16} className="rotate-180" />
                  </button>
                  <button 
                    onClick={() => setShowDeleteAllConfirm(true)}
                    title="Delete All"
                    className="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-md hover:bg-red-400/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="text-text-secondary text-[11px]">Recover your previous analyses</p>
          </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingHistory ? (
              <div className="p-10 text-center text-text-secondary text-sm">Loading...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center text-text-secondary text-sm opacity-50 italic">No historical data yet</div>
            ) : (
              <div className="flex flex-col">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "border-b border-border-dark/30 hover:bg-surface-dark/30 transition-all text-left relative overflow-hidden",
                      simulation?.id === item.id ? "bg-surface-dark/50 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                    )}
                  >
                    {/* Header: Always visible */}
                    <div 
                      onClick={() => handleLoadSimulation(item.id)}
                      className="p-4 cursor-pointer flex justify-between items-start group"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-black text-base group-hover:text-primary transition-colors tracking-tight">{item.asset_ticker}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                            item.total_return_percent >= 0 ? "bg-primary/10 text-primary" : "bg-red-400/10 text-red-400"
                          )}>
                            {item.total_return_percent > 0 ? "+" : ""}{item.total_return_percent}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-text-secondary text-[10px] font-mono flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(item.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-text-secondary opacity-30 text-[10px]">•</span>
                          <span className="text-text-secondary text-[10px] font-medium opacity-70 line-clamp-1">{item.asset_name}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(item.id);
                          }}
                          className="p-2 text-text-secondary hover:text-red-400 transition-all rounded-full hover:bg-red-400/10"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          className="p-2 text-text-secondary hover:text-white transition-colors"
                        >
                          <div className={cn("transition-transform duration-200", collapsedHistory[item.id] ? "-rotate-90" : "rotate-0")}>
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Details: Collapsible */}
                    {!collapsedHistory[item.id] && (
                      <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 bg-background-dark/40 rounded-xl p-3 border border-border-dark/20 shadow-inner">
                          <div className="flex flex-col">
                            <span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">Invested</span>
                            <span className="text-white text-xs font-bold">${item.total_invested.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">Net Profit</span>
                            <span className={cn("text-xs font-bold", item.net_profit >= 0 ? "text-primary" : "text-red-400")}>
                              ${item.net_profit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">Fees Impact</span>
                            <span className="text-red-400 text-xs font-medium">
                              {((item.total_fees / (item.final_value + item.total_fees)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-text-secondary text-[9px] uppercase font-bold tracking-widest">vs Baseline</span>
                            <span className="text-primary text-xs font-black flex items-center gap-0.5">
                              <TrendingUp size={10} />
                              +{item.smart_vs_baseline_diff}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-between items-center opacity-60">
                          <span className="text-text-secondary text-[10px] flex items-center gap-1.5 font-medium">
                            <Calendar size={12} className="opacity-50" />
                            {new Date(item.start_date).getFullYear()} - {new Date(item.end_date).getFullYear()}
                          </span>
                          <div className="size-5 rounded-full bg-background-dark flex items-center justify-center border border-border-dark">
                            <ArrowUpRight size={10} className="text-text-secondary" />
                          </div>
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

