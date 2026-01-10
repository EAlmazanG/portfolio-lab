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
  Maximize2,
  Edit3
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

// Temporary until lib/api.ts can be edited
async function updatePortfolio(id: number, portfolio: Partial<PortfolioCreate>): Promise<Portfolio> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const response = await fetch(`${API_URL}/portfolios/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(portfolio),
  });
  if (!response.ok) {
    throw new Error("Failed to update portfolio");
  }
  return response.json();
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#13ec5b', '#3af578', '#6ef99c', '#9efcc0', '#cfffe4', '#0ea541', '#097a2d'];

const METRIC_INFO = {
  concentration: "The Herfindahl-Hirschman Index (HHI) measures portfolio concentration. A lower value indicates better diversification across assets.",
  maxWeight: "The percentage allocated to your largest single position. High concentration increases exposure to specific asset risks.",
  avgWeight: "The mathematical average allocation across all assets in the portfolio.",
  portfolioIndex: "A simulated index representing the portfolio's historical price performance based on current target weights.",
  assetBreakdown: "Detailed list of assets within the portfolio, showing their individual weight and current price trend.",
  distribution: "A visual representation of how your total capital is distributed across all selected assets.",
  lastUpdate: "The time when the portfolio configuration and historical prices were last synchronized with the database.",
  assetTrend: "Historical 1-year price performance for this specific asset.",
  riskAnalysis: "Calculated risk profile based on asset volatility and concentration levels.",
  strategicView: "The long-term objective and market positioning of this strategy.",
  volatilityTag: "Indicates this asset has historically higher price swings (standard deviation).",
  coreTag: "Indicates this is a fundamental building block of your long-term strategy."
};

export default function PortfolioBuilderPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
        setPortfolioIndexData(indexValues);
      }
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
      let result;
      if (isEditing && selectedPortfolio) {
        result = await updatePortfolio(selectedPortfolio.id, newPortfolio);
      } else {
        result = await createPortfolio(newPortfolio);
      }
      
      setShowCreateModal(false);
      setIsEditing(false);
      setNewPortfolio({ name: "", assets: [], is_favorite: false });
      loadData();
      loadPortfolioDetails(result.id);
    } catch (error) {
      console.error("Failed to save portfolio:", error);
      alert("Failed to save portfolio.");
    }
  };

  const handleEditClick = () => {
    if (!selectedPortfolio) return;
    setNewPortfolio({
      name: selectedPortfolio.name,
      is_favorite: selectedPortfolio.is_favorite,
      assets: selectedPortfolio.assets.map(pa => ({
        asset_id: pa.asset_id,
        weight: pa.weight
      }))
    });
    setIsEditing(true);
    setShowCreateModal(true);
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
      <Info size={12} className="text-text-secondary hover:text-white transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 bg-surface-dark border border-border-active rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] text-[10px] leading-relaxed font-bold text-white text-center pointer-events-none backdrop-blur-md">
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
          leftSidebarOpen ? "w-full max-w-[320px]" : "w-0 border-r-0"
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
            "flex flex-col h-full min-w-[320px] transition-opacity duration-300",
            leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 border-b border-border-dark/30 bg-background-dark/50">
                <button 
                  onClick={() => { setIsEditing(false); setNewPortfolio({name: "", assets: [], is_favorite: false}); setShowCreateModal(true); }}
                  className="w-full py-2.5 px-4 bg-surface-dark border border-border-active hover:border-primary hover:bg-background-dark text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all group text-sm"
                >
                  <Plus size={16} className="text-primary group-hover:scale-110 transition-transform" />
                  New Portfolio
                </button>
              </div>

              <div className="p-5 pb-2">
                <div className="flex flex-col gap-1 mb-4">
                  <h1 className="text-white tracking-tight text-xl font-bold leading-tight text-left">My Portfolios</h1>
                  <p className="text-text-secondary text-[11px] uppercase font-bold tracking-widest">Saved strategies</p>
                </div>

                <div className="flex gap-4 border-b border-border-dark/30 mb-4">
                  <button 
                    onClick={() => setActiveTab("all")}
                    className={cn(
                      "pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                      activeTab === "all" ? "text-primary" : "text-text-secondary hover:text-white"
                    )}
                  >
                    All
                    {activeTab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-300"></div>}
                  </button>
                  <button 
                    onClick={() => setActiveTab("favorites")}
                    className={cn(
                      "pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                      activeTab === "favorites" ? "text-primary" : "text-text-secondary hover:text-white"
                    )}
                  >
                    Favorites
                    {activeTab === "favorites" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in duration-300"></div>}
                  </button>
                </div>
              </div>

              <div className="p-5 pt-0 space-y-2">
                {portfolios
                  .filter(p => activeTab === "all" || p.is_favorite)
                  .map(portfolio => (
                  <div 
                    key={portfolio.id} 
                    onClick={() => loadPortfolioDetails(portfolio.id)}
                    className={cn(
                      "bg-surface-dark border border-border-dark rounded-xl p-3 hover:border-primary/50 transition-all group relative cursor-pointer",
                      selectedPortfolio?.id === portfolio.id && "border-primary/50 bg-primary/5 ring-1 ring-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          selectedPortfolio?.id === portfolio.id ? "bg-primary text-background-dark" : "bg-primary/10 text-primary"
                        )}>
                          <PieChartIcon size={14} />
                        </div>
                        <h3 className="font-bold text-xs truncate max-w-[140px]">{portfolio.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => handleToggleFavorite(e, portfolio.id)}
                          className={cn(
                            "p-1 rounded-lg transition-all",
                            portfolio.is_favorite ? "text-yellow-400 bg-yellow-400/10" : "text-text-secondary hover:text-white hover:bg-surface-light"
                          )}
                        >
                          <Star size={12} fill={portfolio.is_favorite ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={(e) => handleDeletePortfolio(e, portfolio.id)}
                          className="p-1 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-text-secondary uppercase font-bold tracking-widest">
                      <span>{portfolio.asset_count} Assets</span>
                      <span>{new Date(portfolio.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {portfolios.length === 0 && !loading && (
                  <div className="py-10 text-center bg-surface-dark/30 border border-dashed border-border-dark rounded-xl text-text-secondary">
                    <PieChartIcon size={24} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] px-4 font-bold uppercase tracking-widest">No portfolios</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content: Portfolio View */}
        <main className="flex-1 flex flex-col bg-[#0b0f0c] overflow-hidden relative">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
            {selectedPortfolio ? (
              <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 bg-surface-dark/40 p-8 rounded-3xl border border-border-active/20 backdrop-blur-sm shadow-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-5 mb-3">
                      <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight truncate max-w-[600px]">{selectedPortfolio.name}</h1>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleToggleFavorite(e, selectedPortfolio.id)}
                          className={cn(
                            "p-2 rounded-xl transition-all border shrink-0",
                            selectedPortfolio.is_favorite 
                              ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" 
                              : "bg-surface-dark border-border-dark text-text-secondary hover:text-white"
                          )}
                        >
                          <Star size={20} fill={selectedPortfolio.is_favorite ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={handleEditClick}
                          className="p-2 rounded-xl border bg-surface-dark border-border-dark text-text-secondary hover:text-white hover:border-primary/50 transition-all shrink-0"
                          title="Edit portfolio composition"
                        >
                          <Edit3 size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <p className="text-text-secondary flex items-center gap-2 font-bold">
                        <Calendar size={16} className="text-primary" />
                        {new Date(selectedPortfolio.created_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="h-4 w-px bg-border-dark hidden sm:block"></div>
                      <p className="text-text-secondary flex items-center gap-2 font-bold">
                        <Layers size={16} className="text-primary" />
                        {selectedPortfolio.assets.length} Assets
                      </p>
                      <div className="h-4 w-px bg-border-dark hidden sm:block"></div>
                      <p className={cn("flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.2em]", concentrationLabel.color)}>
                        <Zap size={16} />
                        {concentrationLabel.label}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 w-full lg:w-auto">
                    <button 
                      onClick={() => window.location.href = `/simulate-portfolio?id=${selectedPortfolio.id}`}
                      className="flex-1 lg:flex-none px-8 py-4 bg-primary text-background-dark font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] group"
                    >
                      <LineChartIcon size={20} className="group-hover:scale-110 transition-transform" />
                      Run Simulation
                    </button>
                  </div>
                </header>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group shadow-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <Activity size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">HHI Index</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.concentration)}
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{hhiIndex.toFixed(0)}</p>
                      <div className="w-full h-1 bg-surface-light rounded-full mt-4 overflow-hidden">
                         <div className={cn("h-full transition-all duration-1000", hhiIndex < 1500 ? "bg-primary" : hhiIndex < 2500 ? "bg-yellow-400" : "bg-red-400")} style={{ width: `${Math.min(100, (hhiIndex / 10000) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group shadow-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <PieChartIcon size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Max Weight</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.maxWeight)}
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">
                        {Math.max(...selectedPortfolio.assets.map(a => a.weight * 100)).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-text-secondary mt-2 font-bold tracking-widest uppercase">
                        in {selectedPortfolio.assets.find(a => a.weight === Math.max(...selectedPortfolio.assets.map(pa => pa.weight)))?.asset?.ticker}
                      </p>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group shadow-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <Layers size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Avg Stake</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.avgWeight)}
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">
                        {(100 / selectedPortfolio.assets.length).toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-text-secondary mt-2 font-bold tracking-widest uppercase">per asset</p>
                    </div>
                  </div>
                  <div className="bg-surface-dark/60 border border-border-active/10 p-6 rounded-2xl group shadow-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-text-secondary">
                        <Clock size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Last Update</span>
                      </div>
                      {renderInfoIcon(METRIC_INFO.lastUpdate)}
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">Today</p>
                      <p className="text-[10px] text-primary mt-2 font-bold tracking-widest uppercase">Database Sync</p>
                    </div>
                  </div>
                </div>

                {/* Price Index Chart - MOVED UP */}
                <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-xl mb-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-4">
                        <TrendingUp size={24} className="text-primary" />
                        Performance Trend (Simulated 1Y)
                      </h3>
                      {renderInfoIcon(METRIC_INFO.portfolioIndex)}
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    {loadingIndex ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-secondary gap-6">
                        <RefreshCcw size={32} className="animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Calculating Trends...</p>
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
                            tick={{fill: '#666', fontSize: 11}} 
                            minTickGap={80}
                            tickFormatter={(str) => new Date(str).toLocaleDateString("en-US", {month: 'short'})}
                          />
                          <YAxis 
                            hide 
                            domain={['dataMin - 5', 'dataMax + 5']}
                          />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '16px' }}
                            itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#666', fontSize: '10px', marginBottom: '8px', fontWeight: 'black', textTransform: 'uppercase' }}
                            formatter={(val: number) => [val.toFixed(2), "Value"]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#13ec5b" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorIndex)" 
                            animationDuration={2500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start mb-12">
                  {/* Assets List */}
                  <div className="lg:col-span-3 bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-4">
                          <LayoutIcon size={20} className="text-primary" />
                          Asset Breakdown
                        </h3>
                        {renderInfoIcon(METRIC_INFO.assetBreakdown)}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedPortfolio.assets.map((pa, idx) => (
                        <div key={pa.id} className="flex flex-col gap-4">
                          <div 
                            onClick={() => toggleAssetExpand(pa.asset_id)}
                            className={cn(
                              "flex items-center justify-between p-6 bg-background-dark/40 rounded-2xl border border-border-dark/30 cursor-pointer group hover:border-primary/40 transition-all duration-300 shadow-sm",
                              expandedAssetId === pa.asset_id && "border-primary/40 bg-background-dark ring-2 ring-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-16 rounded-xl flex items-center justify-center font-black text-lg border-2 border-border-dark group-hover:border-primary/30 transition-all shadow-inner relative overflow-hidden" style={{ color: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}08` }}>
                                <span className="z-10 tracking-tighter">{pa.asset?.ticker}</span>
                                <div className="absolute inset-0 opacity-[0.05] z-0 flex items-center justify-center">
                                  <Maximize2 size={32} />
                                </div>
                              </div>
                              <div className="min-w-0 flex flex-col gap-1.5">
                                <p className="font-black text-white text-xl leading-none truncate max-w-[300px] group-hover:text-primary transition-colors">{pa.asset?.name}</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-text-secondary uppercase font-black tracking-[0.15em] px-2.5 py-1 bg-surface-light/50 rounded-lg">{pa.asset?.asset_type}</span>
                                  <div className="size-1 rounded-full bg-border-dark"></div>
                                  <div className="flex items-center gap-3">
                                    {pa.asset?.ticker.includes("USD") ? (
                                      <div className="flex items-center gap-1.5 group/tag">
                                        <span className="text-[9px] text-primary font-black flex items-center gap-1.5 uppercase tracking-wider"><Zap size={12} /> Volatility Risk</span>
                                        {renderInfoIcon(METRIC_INFO.volatilityTag)}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 group/tag">
                                        <span className="text-[9px] text-yellow-400 font-black flex items-center gap-1.5 uppercase tracking-wider"><Layers size={12} /> Core Position</span>
                                        {renderInfoIcon(METRIC_INFO.coreTag)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right flex flex-col items-end gap-2">
                                <p className="text-3xl font-black text-primary tabular-nums tracking-tighter leading-none">{(pa.weight * 100).toFixed(0)}<span className="text-sm ml-0.5 opacity-30 font-black">%</span></p>
                                <div className="w-24 h-1.5 bg-surface-light rounded-full overflow-hidden shadow-inner">
                                  <div className="h-full bg-primary shadow-[0_0_10px_rgba(19,236,91,0.4)] transition-all duration-1000" style={{ width: `${pa.weight * 100}%` }}></div>
                                </div>
                              </div>
                              <div className={cn("transition-transform duration-300", expandedAssetId === pa.asset_id ? "rotate-180" : "")}>
                                <ChevronDown size={24} className="text-text-secondary opacity-40 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Chart Area */}
                          {expandedAssetId === pa.asset_id && (
                            <div className="p-8 bg-background-dark/60 rounded-[32px] border border-primary/20 animate-in slide-in-from-top-4 duration-400 shadow-xl mx-2">
                               <div className="flex items-center justify-between mb-6">
                                  <div className="flex items-center gap-4">
                                     <LineChartIcon size={16} className="text-primary" />
                                     <span className="text-xs font-black uppercase tracking-[0.2em] text-white">{pa.asset?.ticker} Price Evolution (1Y)</span>
                                     {renderInfoIcon(METRIC_INFO.assetTrend)}
                                  </div>
                                  <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-text-secondary">
                                     <span className="flex items-center gap-2 border-r border-border-dark pr-6">Min: <span className="text-white">${assetHistories[pa.asset_id] ? Math.min(...assetHistories[pa.asset_id].map(d => d.price)).toLocaleString() : "..."}</span></span>
                                     <span className="flex items-center gap-2">Max: <span className="text-white">${assetHistories[pa.asset_id] ? Math.max(...assetHistories[pa.asset_id].map(d => d.price)).toLocaleString() : "..."}</span></span>
                                  </div>
                               </div>
                               <div className="h-[250px] w-full">
                                  {loadingHistory === pa.asset_id ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-4"><RefreshCcw className="animate-spin text-primary" size={32} /></div>
                                  ) : assetHistories[pa.asset_id] ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={assetHistories[pa.asset_id]}>
                                        <defs>
                                          <linearGradient id={`colorPrice-${pa.asset_id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0}/>
                                          </linearGradient>
                                        </defs>
                                        <XAxis hide dataKey="date" />
                                        <YAxis hide domain={['auto', 'auto']} />
                                        <RechartsTooltip 
                                          contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #ffffff10', borderRadius: '12px', padding: '12px' }}
                                          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                          labelStyle={{ display: 'none' }}
                                          formatter={(val: number) => [`$${val.toLocaleString()}`, "Price"]}
                                        />
                                        <Area 
                                          type="monotone" 
                                          dataKey="price" 
                                          stroke={COLORS[idx % COLORS.length]} 
                                          strokeWidth={3}
                                          fillOpacity={1} 
                                          fill={`url(#colorPrice-${pa.asset_id})`} 
                                          animationDuration={2000}
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

                  {/* Distribution Summary - FIXED PIE CHART */}
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Pie Chart Card */}
                    <div className="bg-surface-dark/60 border border-border-active/10 rounded-[32px] p-8 flex flex-col shadow-xl min-h-[500px]">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-4">
                            <PieChartIcon size={20} className="text-primary" />
                            Distribution
                          </h3>
                          {renderInfoIcon(METRIC_INFO.distribution)}
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center justify-center relative py-6">
                        <div className="w-full h-[350px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={selectedPortfolioChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={110}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                                label={({ name, value }) => `${name} ${value.toFixed(0)}%`}
                                labelLine={{ stroke: '#333', strokeWidth: 1 }}
                                animationDuration={2000}
                              >
                                {selectedPortfolioChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '12px' }}
                                itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                          <span className="text-5xl font-black text-primary drop-shadow-[0_0_20px_rgba(19,236,91,0.3)] tabular-nums">{selectedPortfolio.assets.length}</span>
                          <span className="text-[10px] text-text-secondary uppercase font-black tracking-[0.3em] mt-1">Assets</span>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-border-dark/30 grid grid-cols-2 gap-6">
                         <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary">Risk Analysis</span>
                              {renderInfoIcon(METRIC_INFO.riskAnalysis)}
                            </div>
                            <span className="text-xs font-black text-white flex items-center gap-2">
                              <div className="size-2 rounded-full bg-yellow-400"></div>
                              Aggressive-Medium
                            </span>
                         </div>
                         <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary">Strategic View</span>
                              {renderInfoIcon(METRIC_INFO.strategicView)}
                            </div>
                            <span className="text-xs font-black text-primary flex items-center gap-2">
                              <TrendingUp size={14} />
                              Long-term Alpha
                            </span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-1000">
                <div className="size-32 rounded-[32px] bg-surface-dark border border-border-active flex items-center justify-center mb-10 relative group mx-auto transform rotate-6 hover:rotate-0 transition-transform duration-700 shadow-xl">
                  <div className="absolute inset-0 rounded-[32px] bg-primary/20 animate-pulse group-hover:animate-none opacity-20 blur-2xl"></div>
                  <PieChartIcon size={64} className="text-primary relative z-10" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Portfolio Architect</h2>
                <p className="text-text-secondary max-w-md leading-relaxed mx-auto font-medium text-sm opacity-80">
                  Select a strategy from your archive or architect a new multi-asset portfolio.
                </p>
                <div className="mt-12">
                  <button 
                    onClick={() => { setIsEditing(false); setNewPortfolio({name: "", assets: [], is_favorite: false}); setShowCreateModal(true); }}
                    className="px-10 py-4 bg-primary text-background-dark font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-[#3af578] transition-all shadow-xl shadow-primary/10 active:scale-95 text-sm"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface-dark border border-border-dark rounded-[32px] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-8 border-b border-border-dark flex items-center justify-between bg-background-dark/50">
              <div className="flex items-center gap-8 flex-1">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <PlusCircle size={24} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight uppercase">{isEditing ? "Edit Strategy" : "Build Strategy"}</h2>
                </div>
                <div className="h-10 w-px bg-border-dark"></div>
              </div>
              
              <div className="flex items-center gap-6 mr-8">
                <div className="flex items-center gap-4 bg-surface-light/50 px-6 py-2.5 rounded-2xl border border-border-dark focus-within:border-primary/50 transition-all shadow-inner">
                  <span className="text-[10px] font-black uppercase text-text-secondary tracking-[0.2em]">TITLE:</span>
                  <input 
                    type="text"
                    placeholder="Strategy Name..."
                    className="bg-transparent py-0 px-0 focus:outline-none text-base font-bold text-white placeholder:text-text-secondary/20 min-w-[300px]"
                    value={newPortfolio.name}
                    onChange={(e) => setNewPortfolio({...newPortfolio, name: e.target.value})}
                    autoFocus
                  />
                </div>
                <button 
                  onClick={() => setNewPortfolio({...newPortfolio, is_favorite: !newPortfolio.is_favorite})}
                  className={cn(
                    "p-3 rounded-2xl transition-all border shadow-lg",
                    newPortfolio.is_favorite 
                      ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" 
                      : "bg-surface-light border-border-dark text-text-secondary hover:text-white"
                  )}
                  title={newPortfolio.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={20} fill={newPortfolio.is_favorite ? "currentColor" : "none"} />
                </button>
              </div>

              <button 
                onClick={() => { setShowCreateModal(false); setIsEditing(false); }}
                className="p-3 hover:bg-surface-light rounded-full transition-all text-text-secondary hover:text-white bg-surface-dark/50 border border-border-dark"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Asset Selector */}
              <div className="w-1/4 border-r border-border-dark flex flex-col p-8 bg-background-dark/10">
                <div className="relative mb-8">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                  <input 
                    type="text"
                    placeholder="Search Markets..."
                    className="w-full bg-surface-light border border-border-dark rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-4">
                      <RefreshCcw size={24} className="animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Loading Markets...</p>
                    </div>
                  ) : assets.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {filteredAssets.map(asset => {
                          const isSelected = newPortfolio.assets.find(a => a.asset_id === asset.id);
                          const isDisabled = !!isSelected || totalWeight >= 100;
                          return (
                              <button
                                  key={asset.id}
                                  onClick={() => handleAddAsset(asset)}
                                  disabled={isDisabled}
                                  className={cn(
                                      "flex items-center justify-between p-4 rounded-xl border transition-all text-left group shadow-sm",
                                      isSelected 
                                          ? "bg-primary/5 border-primary/20 opacity-50 cursor-not-allowed" 
                                          : totalWeight >= 100
                                            ? "bg-surface-light border-border-dark opacity-30 cursor-not-allowed grayscale"
                                            : "bg-surface-light border-border-dark hover:border-primary/50 hover:bg-background-dark"
                                  )}
                              >
                                  <div className="min-w-0">
                                      <div className="font-black text-xs tracking-tight text-white group-hover:text-primary transition-colors">{asset.ticker}</div>
                                      <div className="text-[9px] text-text-secondary font-bold line-clamp-1 uppercase tracking-widest">{asset.name}</div>
                                  </div>
                                  {!isSelected && <PlusCircle size={16} className={cn("shrink-0 transition-transform group-hover:scale-110", totalWeight >= 100 ? "text-text-secondary" : "text-primary")} />}
                              </button>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-text-secondary">
                      <p className="text-xs font-black uppercase tracking-widest opacity-40">No markets found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Allocation Config */}
              <div className="w-2/4 flex flex-col p-8 border-r border-border-dark overflow-y-auto custom-scrollbar bg-background-dark/5">
                <label className="text-[10px] font-black uppercase text-text-secondary mb-8 flex items-center gap-4 tracking-[0.3em]">
                  <LayoutIcon size={18} className="text-primary" />
                  Blueprint Strategy
                </label>
                <div className="space-y-4 flex-1">
                  {newPortfolio.assets.map(pa => {
                    const asset = assets.find(a => a.id === pa.asset_id);
                    return (
                      <div key={pa.asset_id} className="bg-surface-dark/80 border border-border-active/30 rounded-2xl p-6 animate-in slide-in-from-left-4 duration-400 shadow-xl group">
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-4">
                            <span className="font-black text-xl text-primary tracking-tighter">{asset?.ticker}</span>
                            <div className="size-1 rounded-full bg-border-dark"></div>
                            <span className="text-[10px] text-text-secondary font-black uppercase tracking-[0.15em] truncate max-w-[250px]">{asset?.name}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveAsset(pa.asset_id)}
                            className="text-text-secondary hover:text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/20"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="flex-1 relative h-6 flex items-center">
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              className="w-full accent-primary h-1.5 bg-surface-light rounded-full appearance-none cursor-pointer shadow-inner"
                              value={pa.weight * 100}
                              onChange={(e) => handleWeightChange(pa.asset_id, Number(e.target.value))}
                            />
                          </div>
                          <div className="w-28 flex items-center bg-background-dark/80 rounded-xl px-4 py-2 border border-border-dark focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-inner">
                            <input 
                              type="number"
                              className="bg-transparent w-full text-right text-lg focus:outline-none font-black tabular-nums text-white"
                              value={Math.round(pa.weight * 100)}
                              onChange={(e) => handleWeightChange(pa.asset_id, Number(e.target.value))}
                            />
                            <span className="text-xs text-text-secondary ml-1 font-black opacity-40">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {newPortfolio.assets.length === 0 && (
                    <div className="text-center py-20 text-text-secondary text-sm border-2 border-dashed border-border-dark rounded-[32px] flex flex-col items-center justify-center gap-6 h-full bg-surface-dark/10">
                      <div className="p-6 bg-surface-dark rounded-[24px] shadow-xl">
                        <Plus size={48} className="opacity-10" />
                      </div>
                      <p className="font-black text-white/40 uppercase tracking-[0.3em] text-[10px]">Select assets to start</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Composition Summary */}
              <div className="w-1/4 flex flex-col p-8 bg-background-dark/30 overflow-y-auto custom-scrollbar">
                <label className="text-[10px] font-black uppercase text-text-secondary mb-10 flex items-center gap-4 tracking-[0.3em]">
                  <PieChartIcon size={18} className="text-primary" />
                  Blueprint
                </label>
                
                <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] relative mb-10">
                  {newPortfolio.assets.length > 0 && totalWeight > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modalChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                          animationDuration={1500}
                        >
                          {modalChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0b0f0c', border: '1px solid #13ec5b20', borderRadius: '16px', padding: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-text-secondary opacity-5">
                      <PieChartIcon size={80} className="mx-auto" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-2">
                    <span className={cn(
                      "text-4xl font-black tabular-nums transition-all duration-500 tracking-tighter drop-shadow-[0_0_15px_rgba(19,236,91,0.2)]",
                      Math.abs(totalWeight - 100) < 0.01 ? "text-primary scale-110" : "text-white"
                    )}>
                      {Math.round(totalWeight)}%
                    </span>
                    <span className="text-[9px] text-text-secondary uppercase font-black tracking-[0.3em] mt-1">Allocation</span>
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-border-dark/50 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-text-secondary tracking-[0.2em]">Check</span>
                      <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                          Math.abs(totalWeight - 100) < 0.01 ? "text-primary" : "text-red-400"
                      )}>
                        <div className={cn("size-2 rounded-full", Math.abs(totalWeight - 100) < 0.01 ? "bg-primary animate-pulse" : "bg-red-400")}></div>
                        {Math.abs(totalWeight - 100) < 0.01 ? "Ready" : "Mismatch"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-black uppercase text-text-secondary tracking-[0.2em]">Stake</span>
                      <span className="text-xs font-black text-white tabular-nums">{newPortfolio.assets.length} ASSETS</span>
                    </div>
                  </div>
                  
                  <button 
                    disabled={Math.abs(totalWeight - 100) > 0.01 || !newPortfolio.name || newPortfolio.assets.length === 0}
                    onClick={handleSavePortfolio}
                    className="w-full py-5 bg-primary text-background-dark font-black uppercase tracking-[0.4em] rounded-2xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed shadow-[0_0_30px_rgba(19,236,91,0.2)] active:scale-[0.98] group text-sm"
                  >
                    <Save size={20} className="group-hover:scale-110 transition-transform" />
                    {isEditing ? "Save Changes" : "Deploy Strategy"}
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
          background: #1a1a1a;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #252525;
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
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
