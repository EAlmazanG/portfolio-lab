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
  Calendar
} from "lucide-react";
import { 
  getAssets, 
  getPortfolios, 
  createPortfolio, 
  deletePortfolio, 
  getPortfolio,
  togglePortfolioFavorite 
} from "../../lib/api";
import { Asset } from "../../types/simulation";
import { Portfolio, PortfolioListItem, PortfolioCreate } from "../../types/portfolio";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#13ec5b', '#3af578', '#6ef99c', '#9efcc0', '#cfffe4', '#0ea541', '#097a2d'];

export default function PortfolioBuilderPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  
  // New Portfolio State
  const [newPortfolio, setNewPortfolio] = useState<PortfolioCreate>({
    name: "",
    assets: [],
    is_favorite: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log("Fetching assets and portfolios...");
      const [assetsData, portfoliosData] = await Promise.all([
        getAssets().catch(e => { console.error("Assets fetch failed:", e); return []; }),
        getPortfolios().catch(e => { console.error("Portfolios fetch failed:", e); return []; })
      ]);
      
      console.log("Assets received:", assetsData?.length || 0);
      setAssets(assetsData || []);
      setPortfolios(portfoliosData || []);
    } catch (error) {
      console.error("Critical error in loadData:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioDetails = async (id: number) => {
    setLoadingDetails(true);
    try {
      const details = await getPortfolio(id);
      setSelectedPortfolio(details);
    } catch (error) {
      console.error("Failed to load portfolio details:", error);
    } finally {
      setLoadingDetails(false);
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
      alert("Failed to save portfolio. Please ensure the backend is running and the database is migrated.");
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
      // pa.asset is expected here based on Portfolio schema returning assets with detail
      return {
        name: pa.asset?.ticker || "Unknown",
        value: pa.weight * 100
      };
    });
  }, [selectedPortfolio]);

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
              </div>

              <div className="p-6 pt-0 space-y-3">
                {portfolios.map(portfolio => (
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
                        <h3 className="font-bold text-sm">{portfolio.name}</h3>
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
                      <span>Created {new Date(portfolio.created_at).toLocaleDateString()}</span>
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
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
            {selectedPortfolio ? (
              <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                <header className="flex justify-between items-start mb-12">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-4xl font-black text-white tracking-tight">{selectedPortfolio.name}</h1>
                      <button 
                        onClick={(e) => handleToggleFavorite(e, selectedPortfolio.id)}
                        className={cn(
                          "p-2 rounded-xl transition-all border",
                          selectedPortfolio.is_favorite 
                            ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" 
                            : "bg-surface-dark border-border-dark text-text-secondary hover:text-white"
                        )}
                      >
                        <Star size={20} fill={selectedPortfolio.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <p className="text-text-secondary flex items-center gap-2 font-medium">
                      <Calendar size={14} className="text-primary" />
                      Created on {new Date(selectedPortfolio.created_at).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => window.location.href = `/simulate-portfolio?id=${selectedPortfolio.id}`}
                      className="px-6 py-3 bg-primary text-background-dark font-black uppercase tracking-widest rounded-xl hover:bg-[#3af578] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                    >
                      <LineChartIcon size={18} />
                      Simulate Strategy
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Allocation Table */}
                  <div className="bg-surface-dark border border-border-active/30 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-secondary mb-6 flex items-center gap-2">
                      <LayoutIcon size={16} className="text-primary" />
                      Asset Allocation
                    </h3>
                    <div className="space-y-4">
                      {selectedPortfolio.assets.map((pa, idx) => (
                        <div key={pa.id} className="flex items-center justify-between p-4 bg-background-dark/50 rounded-xl border border-border-dark/50 group hover:border-primary/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-lg flex items-center justify-center font-black text-xs border border-border-dark" style={{ color: COLORS[idx % COLORS.length] }}>
                              {pa.asset?.ticker}
                            </div>
                            <div>
                              <p className="font-bold text-white">{pa.asset?.name}</p>
                              <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest">{pa.asset?.asset_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-primary">{(pa.weight * 100).toFixed(0)}%</p>
                            <div className="w-24 h-1 bg-surface-light rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pa.weight * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Composition Chart */}
                  <div className="bg-surface-dark border border-border-active/30 rounded-2xl p-6 flex flex-col shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-secondary mb-6 flex items-center gap-2">
                      <PieChartIcon size={16} className="text-primary" />
                      Composition
                    </h3>
                    <div className="flex-1 min-h-[350px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={selectedPortfolioChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {selectedPortfolioChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#1a1f1b', border: '1px solid #2d352f', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-10px]">
                        <span className="text-4xl font-black text-primary">{selectedPortfolio.assets.length}</span>
                        <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Assets</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-700">
                <div className="size-24 rounded-full bg-surface-dark border border-border-active flex items-center justify-center mb-8 relative group mx-auto">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping group-hover:animate-none opacity-20"></div>
                  <PieChartIcon size={48} className="text-primary relative z-10" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Portfolio Explorer</h2>
                <p className="text-text-secondary max-w-sm leading-relaxed mx-auto">
                  Select a portfolio from the list to view its composition or create a new one to start building your strategy.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Analytics */}
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
          >
            {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={cn(
            "flex flex-col h-full min-w-[320px] transition-opacity duration-300",
            rightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="p-6 border-b border-border-dark/30">
              <h2 className="text-white text-lg font-bold flex items-center gap-2">
                <BarChart2 size={18} className="text-primary" />
                Performance Metrics
              </h2>
              <p className="text-text-secondary text-[11px] mt-1">Aggregated strategy analytics.</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Activity size={48} className="text-text-secondary opacity-10 mb-4" />
              <p className="text-text-secondary text-sm px-4">Performance data for the selected portfolio will appear here after simulation.</p>
            </div>
          </div>
        </aside>
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
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Name:</span>
                  <input 
                    type="text"
                    placeholder="Enter portfolio name..."
                    className="bg-transparent border-b border-border-active py-1 px-0 focus:outline-none focus:border-primary text-sm font-bold text-white placeholder:text-text-secondary/20 min-w-[300px]"
                    value={newPortfolio.name}
                    onChange={(e) => setNewPortfolio({...newPortfolio, name: e.target.value})}
                    autoFocus
                  />
                </div>
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
