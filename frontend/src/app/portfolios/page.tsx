"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Layout as LayoutIcon, 
  X,
  PlusCircle,
  AlertCircle,
  LineChart as LineChartIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Settings as SettingsIcon,
  History,
  Star,
  Info,
  CheckCircle2,
  BarChart2,
  Activity,
  Calendar,
  Layers,
  Zap,
  Clock,
  ArrowRight,
  TrendingDown,
  Maximize2
} from "lucide-react";
import { 
  getAssets, 
  getPortfolios, 
  createPortfolio, 
  deletePortfolio, 
  getPortfolio,
  togglePortfolioFavorite,
  getAssetHistory
} from "../../lib/api";
import { Asset } from "../../types/simulation";
import { Portfolio, PortfolioListItem, PortfolioCreate } from "../../types/portfolio";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#13ec5b', '#3af578', '#6ef99c', '#9efcc0', '#cfffe4', '#0ea541', '#097a2d'];

const METRIC_INFO = {
  concentration: "The Herfindahl-Hirschman Index (HHI) measures portfolio concentration. A lower value indicates better diversification across assets.",
  maxWeight: "The percentage allocated to your largest single position. High concentration increases exposure to specific asset risks.",
  avgWeight: "The mathematical average allocation across all assets in the portfolio.",
  portfolioIndex: "A simulated index representing the portfolio's historical price performance based on current target weights."
};

export default function PortfolioBuilderPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  
  // Interaction states
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);
  const [assetHistories, setAssetHistories] = useState<Record<number, {date: string, price: number}[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<number | null>(null);
  const [portfolioIndexData, setPortfolioIndexData] = useState<{date: string, value: number}[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(false);

  // New Portfolio State
  const [newPortfolio, setNewPortfolio] = useState<PortfolioCreate>({
    name: "",
    assets: [],
    is_favorite: false
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPortfolio) {
      loadPortfolioIndex();
    } else {
      setPortfolioIndexData([]);
    }
  }, [selectedPortfolio]);

  const loadData = async () => {
    setLoading(true);
    try {
      const assetsData = await getAssets();
      setAssets(assetsData || []);

      const portfoliosData = await getPortfolios();
      setPortfolios(portfoliosData || []);
    } catch (error) {
      console.error("Critical error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioIndex = async () => {
    if (!selectedPortfolio || selectedPortfolio.assets.length === 0) return;
    setLoadingIndex(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
      
      const histories = await Promise.all(
        selectedPortfolio.assets.map(async (pa) => {
          const data = await getAssetHistory(pa.asset_id, startDate, endDate);
          return { asset_id: pa.asset_id, weight: pa.weight, data };
        })
      );

      // Align dates and calculate weighted index
      const dates = histories[0].data.map(d => d.date);
      const indexValues = dates.map(date => {
        let weightedValue = 0;
        histories.forEach(h => {
          const dayData = h.data.find(d => d.date === date);
          if (dayData && h.data.length > 0) {
            // Normalize to start at 100
            const firstPrice = h.data[0].price;
            const currentPrice = dayData.price;
            const normalizedPrice = (currentPrice / firstPrice) * 100;
            weightedValue += normalizedPrice * h.weight;
          }
        });
        return { date, value: weightedValue };
      });

      setPortfolioIndexData(indexValues);
    } catch (error) {
      console.error("Failed to load portfolio index:", error);
    } finally {
      setLoadingIndex(false);
    }
  };

  const loadPortfolioDetails = async (id: number) => {
    setLoadingDetails(true);
    setExpandedAssetId(null);
    try {
      const details = await getPortfolio(id);
      setSelectedPortfolio(details);
    } catch (error) {
      console.error("Failed to load portfolio details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleAssetExpand = async (assetId: number) => {
    if (expandedAssetId === assetId) {
      setExpandedAssetId(null);
      return;
    }

    setExpandedAssetId(assetId);
    if (!assetHistories[assetId]) {
      setLoadingHistory(assetId);
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
        const data = await getAssetHistory(assetId, startDate, endDate);
        setAssetHistories(prev => ({ ...prev, [assetId]: data }));
      } catch (error) {
        console.error("Failed to fetch asset history:", error);
      } finally {
        setLoadingHistory(null);
      }
    }
  };

  const totalWeight = useMemo(() => 
    newPortfolio.assets.reduce((sum, a) => sum + a.weight, 0) * 100
  , [newPortfolio.assets]);

  const handleAddAsset = (asset: Asset) => {
    if (newPortfolio.assets.find(a => a.asset_id === asset.id)) return;
    if (totalWeight >= 100) return;

    setNewPortfolio({
      ...newPortfolio,
      assets: [...newPortfolio.assets, { asset_id: asset.id, weight: 0 }]
    });
  };

  const handleRemoveAsset = (assetId: number) => {
    setNewPortfolio({
      ...newPortfolio,
      assets: newPortfolio.assets.filter(a => a.asset_id !== assetId)
    });
  };

  const handleWeightChange = (assetId: number, newWeightPct: number) => {
    const currentAsset = newPortfolio.assets.find(a => a.asset_id === assetId);
    const currentWeightPct = (currentAsset?.weight || 0) * 100;
    const otherAssetsWeightPct = totalWeight - currentWeightPct;
    const maxAllowedWeightPct = Math.max(0, 100 - otherAssetsWeightPct);
    const finalWeightPct = Math.min(newWeightPct, maxAllowedWeightPct);

    setNewPortfolio({
      ...newPortfolio,
      assets: newPortfolio.assets.map(a => 
        a.asset_id === assetId ? { ...a, weight: finalWeightPct / 100 } : a
      )
    });
  };

  const handleSavePortfolio = async () => {
    if (Math.abs(totalWeight - 100) > 0.01) {
      alert("Total weight must be exactly 100%");
      return;
    }
    if (!newPortfolio.name) {
      alert("Portfolio name is required");
      return;
    }

    try {
      const created = await createPortfolio(newPortfolio);
      setShowCreateModal(false);
      setNewPortfolio({ name: "", assets: [], is_favorite: false });
      loadData();
      loadPortfolioDetails(created.id);
    } catch (error) {
      console.error("Failed to save portfolio:", error);
      alert("Failed to save portfolio.");
    }
  };

  const handleDeletePortfolio = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this portfolio?")) return;
    try {
      await deletePortfolio(id);
      if (selectedPortfolio?.id === id) setSelectedPortfolio(null);
      loadData();
    } catch (error) {
      console.error("Failed to delete portfolio:", error);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const isFav = await togglePortfolioFavorite(id);
      setPortfolios(prev => prev.map(p => p.id === id ? { ...p, is_favorite: isFav } : p));
      if (selectedPortfolio?.id === id) {
        setSelectedPortfolio({ ...selectedPortfolio, is_favorite: isFav });
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter(a => 
      a.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assets, searchQuery]);

  const modalChartData = useMemo(() => {
    return newPortfolio.assets
      .filter(pa => pa.weight > 0)
      .map(pa => {
        const asset = assets.find(a => a.id === pa.asset_id);
        return {
          name: asset?.ticker || "Unknown",
          value: pa.weight * 100
        };
      });
  }, [newPortfolio.assets, assets]);

  const selectedPortfolioChartData = useMemo(() => {
    if (!selectedPortfolio) return [];
    return selectedPortfolio.assets.map(pa => {
      return {
        name: pa.asset?.ticker || "Unknown",
        value: pa.weight * 100
      };
    });
  }, [selectedPortfolio]);

  const hhiIndex = useMemo(() => {
    if (!selectedPortfolio) return 0;
    return selectedPortfolio.assets.reduce((sum, pa) => sum + Math.pow(pa.weight * 100, 2), 0);
  }, [selectedPortfolio]);

  const concentrationLabel = useMemo(() => {
    if (hhiIndex < 1500) return { label: "Diversified", color: "text-primary" };
    if (hhiIndex < 2500) return { label: "Moderate", color: "text-yellow-400" };
    return { label: "Concentrated", color: "text-red-400" };
  }, [hhiIndex]);

  const renderInfoIcon = (text: string) => (
    <div className="group relative cursor-help shrink-0">
      <Info size={14} className="text-text-secondary hover:text-white transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-surface-dark border border-border-active rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] text-[10px] leading-relaxed font-bold text-white text-center pointer-events-none">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-surface-dark"></div>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
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
              <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium leading-normal" href="/">Asset</a>
              <a className="text-white text-sm font-medium leading-normal border-b-2 border-primary pb-0.5" href="/portfolios">Portfolios</a>
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
        {/* Sidebar: Saved Portfolios */}
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
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="w-full py-3 px-4 bg-surface-dark border border-border-active hover:border-primary hover:bg-background-dark text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all group"
                >
                  <Plus size={18} className="text-primary group-hover:scale-110 transition-transform" />
                  New Portfolio
                </button>
              </div>

              <div className="p-6 pb-2">
                <div className="flex flex-col gap-1 mb-4">
                  <h1 className="text-white tracking-light text-[24px] font-bold leading-tight text-left">My Portfolios</h1>
                  <p className="text-text-secondary text-sm">Select or manage your portfolios.</p>
                </div>

                <div className="flex gap-4 border-b border-border-dark/30 mb-4">
                  <button 
                    onClick={() => setActiveTab("all")}
                    className={cn(
                      "pb-2 text-xs font-bold uppercase tracking-widest transition-all relative",
                      activeTab === "all" ? "text-primary" : "text-text-secondary hover:text-white"
                    )}
                  >
                    All
                    {activeTab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-300"></div>}
                  </button>
                  <button 
                    onClick={() => setActiveTab("favorites")}
                    className={cn(
                      "pb-2 text-xs font-bold uppercase tracking-widest transition-all relative",
                      activeTab === "favorites" ? "text-primary" : "text-text-secondary hover:text-white"
                    )}
                  >
                    Favorites
                    {activeTab === "favorites" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-300"></div>}
                  </button>
                </div>
              </div>

              <div className="p-6 pt-0 space-y-3">
                {portfolios
                  .filter(p => activeTab === "all" || p.is_favorite)
                  .map(portfolio => (
                  <div 
                    key={portfolio.id} 
                    onClick={() => loadPortfolioDetails(portfolio.id)}
                    className={cn(
                      "bg-surface-dark border border-border-dark rounded-xl p-4 hover:border-primary/50 transition-all group relative cursor-pointer",
                      selectedPortfolio?.id === portfolio.id && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          selectedPortfolio?.id === portfolio.id ? "bg-primary text-background-dark" : "bg-primary/10 text-primary"
                        )}>
                          <PieChartIcon size={18} />
                        </div>
                        <h3 className="font-bold text-sm truncate max-w-[180px]">{portfolio.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => handleToggleFavorite(e, portfolio.id)}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            portfolio.is_favorite ? "text-yellow-400 bg-yellow-400/10" : "text-text-secondary hover:text-white hover:bg-surface-light"
                          )}
                        >
                          <Star size={14} fill={portfolio.is_favorite ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={(e) => handleDeletePortfolio(e, portfolio.id)}
                          className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-text-secondary uppercase font-bold tracking-wider">
                      <span>{portfolio.asset_count} Assets</span>
                      <span>{new Date(portfolio.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {portfolios.length === 0 && !loading && (
                  <div className="py-12 text-center bg-surface-dark/30 border border-dashed border-border-dark rounded-xl text-text-secondary">
                    <PieChartIcon size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-xs px-4">No portfolios created yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content: Portfolio View */}
        <main className="flex-1 flex flex-col bg-[#0b0f0c] overflow-hidden relative">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-12 z-10 custom-scrollbar">
            {selectedPortfolio ? (
              <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12 bg-surface-dark/40 p-8 rounded-3xl border border-border-active/20 backdrop-blur-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                      <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight truncate max-w-[500px]">{selectedPortfolio.name}</h1>
                      <button 
                        onClick={(e) => handleToggleFavorite(e, selectedPortfolio.id)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all border shrink-0",
                          selectedPortfolio.is_favorite 
                            ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" 
                            : "bg-surface-dark border-border-dark text-text-secondary hover:text-white"
                        )}
                      >
                        <Star size={24} fill={selectedPortfolio.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <p className="text-text-secondary flex items-center gap-2 font-medium">
                        <Calendar size={16} className="text-primary" />
                        Created {new Date(selectedPortfolio.created_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="h-4 w-px bg-border-dark hidden sm:block"></div>
                      <p className="text-text-secondary flex items-center gap-2 font-medium">
                        <Layers size={16} className="text-primary" />
                        {selectedPortfolio.assets.length} Active Assets
                      </p>
                      <div className="h-4 w-px bg-border-dark hidden sm:block"></div>
                      <p className={cn("flex items-center gap-2 font-bold uppercase text-[11px] tracking-widest", concentrationLabel.color)}>
                        <Zap size={16} />
                        {concentrationLabel.label}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 w-full lg:w-auto">
                    <button 
                      onClick={() => window.location.href = `/simulate-portfolio?id=${selectedPortfolio.id}`}
                      className="flex-1 lg:flex-none px-8 py-4 bg-primary text-background-dark font-black uppercase tracking-[0.15em] rounded-2xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-primary/20 active:scale-[0.98] group"
                    >
                      <LineChartIcon size={20} className="group-hover:scale-110 transition-transform" />
                      Run Simulation
                      <ArrowRight size={18} className="opacity-50" />
                    </button>
                  </div>
                </header>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <Activity size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Concentration</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.concentration)}
                    </div>
                    <p className="text-2xl font-black text-white">{hhiIndex.toFixed(0)}</p>
                    <div className="w-full h-1 bg-surface-light rounded-full mt-3 overflow-hidden">
                       <div className={cn("h-full transition-all duration-1000", hhiIndex < 1500 ? "bg-primary" : hhiIndex < 2500 ? "bg-yellow-400" : "bg-red-400")} style={{ width: `${Math.min(100, (hhiIndex / 10000) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <PieChartIcon size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Max Weight</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.maxWeight)}
                    </div>
                    <p className="text-2xl font-black text-white">
                      {Math.max(...selectedPortfolio.assets.map(a => a.weight * 100)).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-text-secondary mt-1 font-bold">
                      in {selectedPortfolio.assets.find(a => a.weight === Math.max(...selectedPortfolio.assets.map(pa => pa.weight)))?.asset?.ticker}
                    </p>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <Layers size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Avg Weight</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.avgWeight)}
                    </div>
                    <p className="text-2xl font-black text-white">
                      {(100 / selectedPortfolio.assets.length).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-text-secondary mt-1 font-bold">per asset</p>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <LineChartIcon size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Perf. Index</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.portfolioIndex)}
                    </div>
                    {loadingIndex ? (
                      <div className="h-8 flex items-center"><RefreshCcw size={16} className="animate-spin text-text-secondary" /></div>
                    ) : (
                      <>
                        <p className="text-2xl font-black text-white">
                          {portfolioIndexData.length > 0 ? (portfolioIndexData[portfolioIndexData.length - 1].value).toFixed(1) : "N/A"}
                        </p>
                        <p className={cn(
                          "text-[10px] font-bold mt-1",
                          portfolioIndexData.length > 0 && portfolioIndexData[portfolioIndexData.length - 1].value >= 100 ? "text-primary" : "text-red-400"
                        )}>
                          {portfolioIndexData.length > 0 ? (portfolioIndexData[portfolioIndexData.length - 1].value - 100).toFixed(1) + "%" : ""}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Price Index Chart */}
                <div className="bg-surface-dark/60 border border-border-active/10 rounded-3xl p-8 shadow-2xl mb-10">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-sm font-black uppercase tracking-[0.25em] text-text-secondary flex items-center gap-3">
                      <TrendingUp size={18} className="text-primary" />
                      Portfolio Price Performance (Normalized 1Y)
                    </h3>
                  </div>
                  <div className="h-[300px] w-full">
                    {loadingIndex ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-secondary gap-4">
                        <RefreshCcw size={32} className="animate-spin" />
                        <p className="text-sm font-bold uppercase tracking-widest">Synthesizing Index...</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={portfolioIndexData}>
                          <defs>
                            <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#13ec5b" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#13ec5b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#666', fontSize: 10}} 
                            minTickGap={60}
                            tickFormatter={(str) => new Date(str).toLocaleDateString("en-US", {month: 'short'})}
                          />
                          <YAxis 
                            hide 
                            domain={['dataMin - 10', 'dataMax + 10']}
                          />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}
                            formatter={(val: number) => [val.toFixed(2), "Index Value"]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#13ec5b" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorIndex)" 
                            animationDuration={2000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
                  {/* Assets List */}
                  <div className="xl:col-span-3 bg-surface-dark/60 border border-border-active/10 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-black uppercase tracking-[0.25em] text-text-secondary flex items-center gap-3">
                        <LayoutIcon size={18} className="text-primary" />
                        Asset Breakdown & Market Trends
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {selectedPortfolio.assets.map((pa, idx) => (
                        <div key={pa.id} className="flex flex-col gap-4">
                          <div 
                            onClick={() => toggleAssetExpand(pa.asset_id)}
                            className={cn(
                              "flex items-center justify-between p-6 bg-background-dark/40 rounded-2xl border border-border-dark/30 cursor-pointer group hover:border-primary/40 transition-all duration-300",
                              expandedAssetId === pa.asset_id && "border-primary/40 bg-background-dark ring-1 ring-primary/10"
                            )}
                          >
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-16 rounded-xl flex items-center justify-center font-black text-lg border-2 border-border-dark group-hover:border-primary/30 transition-all shadow-inner relative" style={{ color: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}08` }}>
                                <span className="z-10">{pa.asset?.ticker}</span>
                                <div className="absolute inset-0 opacity-[0.03] z-0 flex items-center justify-center">
                                  <Maximize2 size={32} />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-white text-xl leading-tight truncate group-hover:text-primary transition-colors">{pa.asset?.name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-text-secondary uppercase font-black tracking-widest px-2 py-0.5 bg-surface-light/50 rounded-md">{pa.asset?.asset_type}</span>
                                  {pa.asset?.ticker.includes("USD") ? (
                                    <span className="text-[10px] text-primary font-bold flex items-center gap-1"><Zap size={10} /> High Volatility</span>
                                  ) : (
                                    <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-1"><Layers size={10} /> Core Holding</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right flex flex-col items-end gap-2">
                                <p className="text-3xl font-black text-primary tabular-nums tracking-tighter">{(pa.weight * 100).toFixed(0)}<span className="text-xs ml-0.5 opacity-60 font-black">%</span></p>
                                <div className="w-24 h-2 bg-surface-light rounded-full overflow-hidden shadow-inner">
                                  <div className="h-full bg-primary shadow-[0_0_10px_rgba(19,236,91,0.4)] transition-all duration-1000" style={{ width: `${pa.weight * 100}%` }}></div>
                                </div>
                              </div>
                              <div className={cn("transition-transform duration-300", expandedAssetId === pa.asset_id ? "rotate-180" : "")}>
                                <ChevronDown size={20} className="text-text-secondary" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Chart Area */}
                          {expandedAssetId === pa.asset_id && (
                            <div className="p-8 bg-background-dark/60 rounded-3xl border border-primary/20 animate-in slide-in-from-top-4 duration-300">
                               <div className="flex items-center justify-between mb-6">
                                  <div className="flex items-center gap-3">
                                     <LineChartIcon size={16} className="text-primary" />
                                     <span className="text-xs font-black uppercase tracking-widest text-white">{pa.asset?.ticker} Price Evolution (1Y)</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-[10px] font-bold text-text-secondary">
                                     <span>Min: ${assetHistories[pa.asset_id] ? Math.min(...assetHistories[pa.asset_id].map(d => d.price)).toLocaleString() : "..."}</span>
                                     <span>Max: ${assetHistories[pa.asset_id] ? Math.max(...assetHistories[pa.asset_id].map(d => d.price)).toLocaleString() : "..."}</span>
                                  </div>
                               </div>
                               <div className="h-[200px] w-full">
                                  {loadingHistory === pa.asset_id ? (
                                    <div className="h-full flex items-center justify-center"><RefreshCcw className="animate-spin text-primary" size={24} /></div>
                                  ) : assetHistories[pa.asset_id] ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={assetHistories[pa.asset_id]}>
                                        <defs>
                                          <linearGradient id={`colorPrice-${pa.asset_id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0}/>
                                          </linearGradient>
                                        </defs>
                                        <XAxis hide dataKey="date" />
                                        <YAxis hide domain={['auto', 'auto']} />
                                        <RechartsTooltip 
                                          contentStyle={{ backgroundColor: '#0b0f0c', border: 'none', borderRadius: '8px' }}
                                          itemStyle={{ color: '#fff', fontSize: '10px' }}
                                          labelStyle={{ display: 'none' }}
                                        />
                                        <Area 
                                          type="monotone" 
                                          dataKey="price" 
                                          stroke={COLORS[idx % COLORS.length]} 
                                          strokeWidth={2}
                                          fillOpacity={1} 
                                          fill={`url(#colorPrice-${pa.asset_id})`} 
                                          animationDuration={1500}
                                        />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  ) : null}
                               </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Composition Summary */}
                  <div className="xl:col-span-2 bg-surface-dark/60 border border-border-active/10 rounded-3xl p-8 flex flex-col shadow-2xl sticky top-8">
                    <h3 className="text-sm font-black uppercase tracking-[0.25em] text-text-secondary mb-12 flex items-center gap-3">
                      <PieChartIcon size={18} className="text-primary" />
                      Allocation Weights
                    </h3>
                    <div className="flex-1 min-h-[450px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={selectedPortfolioChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={100}
                            outerRadius={150}
                            paddingAngle={10}
                            dataKey="value"
                            stroke="none"
                            label={({ name, value }) => `${name} ${value.toFixed(0)}%`}
                            labelLine={false}
                          >
                            {selectedPortfolioChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
                        <span className="text-6xl font-black text-primary drop-shadow-[0_0_20px_rgba(19,236,91,0.2)] tabular-nums">{selectedPortfolio.assets.length}</span>
                        <span className="text-[10px] text-text-secondary uppercase font-black tracking-[0.3em]">Total Assets</span>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-border-dark/30 space-y-4">
                       <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-text-secondary">
                          <span>Risk Profile</span>
                          <span className="text-white">Medium-High</span>
                       </div>
                       <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-text-secondary">
                          <span>Rebalance Threshold</span>
                          <span className="text-primary">±5.0%</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-1000">
                <div className="size-32 rounded-3xl bg-surface-dark border border-border-active flex items-center justify-center mb-10 relative group mx-auto transform rotate-6 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-pulse group-hover:animate-none opacity-20 blur-xl"></div>
                  <PieChartIcon size={64} className="text-primary relative z-10" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Portfolio Architect</h2>
                <p className="text-text-secondary max-w-sm leading-relaxed mx-auto font-medium">
                  Select a portfolio from your collection or construct a new multi-asset strategy to begin your analysis.
                </p>
                <div className="mt-12">
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-10 py-4 bg-primary text-background-dark font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-[#3af578] transition-all shadow-2xl shadow-primary/10 active:scale-95"
                  >
                    Create New
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-dark flex items-center justify-between bg-background-dark/50">
              <div className="flex items-center gap-6 flex-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <PlusCircle size={20} />
                  </div>
                  <h2 className="text-xl font-bold whitespace-nowrap tracking-tight">Build Portfolio</h2>
                </div>
                <div className="h-8 w-px bg-border-dark"></div>
              </div>
              
              <div className="flex items-center gap-4 mr-6">
                <div className="flex items-center gap-3 bg-surface-light/50 px-4 py-2 rounded-xl border border-border-dark focus-within:border-primary/50 transition-all">
                  <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Name:</span>
                  <input 
                    type="text"
                    placeholder="Portfolio Title..."
                    className="bg-transparent py-0 px-0 focus:outline-none text-sm font-bold text-white placeholder:text-text-secondary/20 min-w-[200px]"
                    value={newPortfolio.name}
                    onChange={(e) => setNewPortfolio({...newPortfolio, name: e.target.value})}
                    autoFocus
                  />
                </div>
                <button 
                  onClick={() => setNewPortfolio({...newPortfolio, is_favorite: !newPortfolio.is_favorite})}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border shadow-lg",
                    newPortfolio.is_favorite 
                      ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" 
                      : "bg-surface-light border-border-dark text-text-secondary hover:text-white"
                  )}
                  title={newPortfolio.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={18} fill={newPortfolio.is_favorite ? "currentColor" : "none"} />
                </button>
              </div>

              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-surface-light rounded-full transition-all text-text-secondary hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Asset Selector */}
              <div className="w-1/4 border-r border-border-dark flex flex-col p-6 bg-background-dark/10">
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                  <input 
                    type="text"
                    placeholder="Search assets..."
                    className="w-full bg-surface-light border border-border-dark rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
                      <RefreshCcw size={24} className="animate-spin mb-4" />
                      <p className="text-xs">Loading assets...</p>
                    </div>
                  ) : assets.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredAssets.map(asset => {
                          const isSelected = newPortfolio.assets.find(a => a.asset_id === asset.id);
                          const isDisabled = !!isSelected || totalWeight >= 100;
                          return (
                              <button
                                  key={asset.id}
                                  onClick={() => handleAddAsset(asset)}
                                  disabled={isDisabled}
                                  className={cn(
                                      "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                      isSelected 
                                          ? "bg-primary/5 border-primary/20 opacity-50 cursor-not-allowed" 
                                          : totalWeight >= 100
                                            ? "bg-surface-light border-border-dark opacity-30 cursor-not-allowed grayscale"
                                            : "bg-surface-light border-border-dark hover:border-primary/50 hover:bg-surface-light/80"
                                  )}
                              >
                                  <div>
                                      <div className="font-bold text-sm">{asset.ticker}</div>
                                      <div className="text-[10px] text-text-secondary line-clamp-1">{asset.name}</div>
                                  </div>
                                  {!isSelected && <PlusCircle size={16} className={cn(totalWeight >= 100 ? "text-text-secondary" : "text-primary")} />}
                              </button>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-text-secondary">
                      <p className="text-xs italic">No assets found.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Allocation Config */}
              <div className="w-2/4 flex flex-col p-6 border-r border-border-dark overflow-y-auto custom-scrollbar">
                <label className="text-xs font-bold uppercase text-text-secondary mb-4 flex items-center gap-2">
                  <LayoutIcon size={14} className="text-primary" />
                  Target Allocations
                </label>
                <div className="space-y-3 flex-1">
                  {newPortfolio.assets.map(pa => {
                    const asset = assets.find(a => a.id === pa.asset_id);
                    return (
                      <div key={pa.asset_id} className="bg-surface-dark border border-border-active/30 rounded-xl p-4 animate-in slide-in-from-left-2 duration-300">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-baseline gap-2">
                            <span className="font-black text-primary">{asset?.ticker}</span>
                            <span className="text-[10px] text-text-secondary font-bold truncate max-w-[200px]">{asset?.name}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveAsset(pa.asset_id)}
                            className="text-text-secondary hover:text-red-400 p-1 hover:bg-red-400/10 rounded-lg transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            className="flex-1 accent-primary h-1.5 bg-surface-light rounded-lg appearance-none cursor-pointer"
                            value={pa.weight * 100}
                            onChange={(e) => handleWeightChange(pa.asset_id, Number(e.target.value))}
                          />
                          <div className="w-20 flex items-center bg-surface-light rounded-lg px-2 py-1.5 border border-border-dark focus-within:border-primary/50 transition-colors">
                            <input 
                              type="number"
                              className="bg-transparent w-full text-right text-sm focus:outline-none font-black"
                              value={Math.round(pa.weight * 100)}
                              onChange={(e) => handleWeightChange(pa.asset_id, Number(e.target.value))}
                            />
                            <span className="text-[10px] text-text-secondary ml-1 font-bold">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {newPortfolio.assets.length === 0 && (
                    <div className="text-center py-20 text-text-secondary text-sm border border-dashed border-border-dark rounded-2xl flex flex-col items-center justify-center gap-4 h-full">
                      <div className="p-4 bg-surface-dark rounded-full">
                        <Plus size={32} className="opacity-20" />
                      </div>
                      <p className="max-w-[200px] leading-relaxed">Select assets from the left panel to define your strategy.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Composition Summary */}
              <div className="w-1/4 flex flex-col p-6 bg-background-dark/30">
                <label className="text-xs font-bold uppercase text-text-secondary mb-6 flex items-center gap-2">
                  <PieChartIcon size={14} className="text-primary" />
                  Live Preview
                </label>
                
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] relative">
                  {newPortfolio.assets.length > 0 && totalWeight > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modalChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {modalChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1a1f1b', border: '1px solid #2d352f', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-text-secondary opacity-10">
                      <PieChartIcon size={64} className="mx-auto" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-10px]">
                    <span className={cn(
                      "text-2xl font-black tabular-nums transition-colors",
                      Math.abs(totalWeight - 100) < 0.01 ? "text-primary" : "text-white"
                    )}>
                      {Math.round(totalWeight)}%
                    </span>
                    <span className="text-[8px] text-text-secondary uppercase font-bold tracking-widest">Total</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border-dark">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-text-secondary">Validation</span>
                      <span className={cn(
                          "text-xs font-black uppercase tracking-wider",
                          Math.abs(totalWeight - 100) < 0.01 ? "text-primary" : "text-red-400"
                      )}>
                        {Math.abs(totalWeight - 100) < 0.01 ? "Complete" : "Required 100%"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold uppercase text-text-secondary">Assets</span>
                      <span className="text-xs font-black text-white">{newPortfolio.assets.length}</span>
                    </div>
                  </div>
                  
                  {Math.abs(totalWeight - 100) > 0.01 && newPortfolio.assets.length > 0 && (
                    <div className="flex items-center gap-2 text-red-400 text-[10px] mb-4 bg-red-400/10 p-3 rounded-xl border border-red-400/20 font-bold uppercase">
                        <AlertCircle size={14} className="shrink-0" />
                        Allocations must be 100%
                    </div>
                  )}

                  <button 
                    disabled={Math.abs(totalWeight - 100) > 0.01 || !newPortfolio.name || newPortfolio.assets.length === 0}
                    onClick={handleSavePortfolio}
                    className="w-full py-4 bg-primary text-background-dark font-black uppercase tracking-widest rounded-xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-xl shadow-primary/20"
                  >
                    <Save size={20} />
                    Save Portfolio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2a2a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}

const ChevronDown = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
