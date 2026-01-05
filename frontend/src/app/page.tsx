"use client";

import { useState, useEffect } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download, 
  Sliders, 
  Play, 
  BarChart2, 
  Settings as SettingsIcon,
  LayoutDashboard,
  Coins
} from "lucide-react";
import { getAssets, runSimulation } from "../lib/api";
import { Asset, SimulationConfig, SimulationResponse } from "../types/simulation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AssetSimulationPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);

  // Form state
  const [config, setConfig] = useState<SimulationConfig>({
    asset_id: 0,
    start_date: "2021-01-01",
    end_date: new Date().toISOString().split("T")[0],
    base_amount: 500,
    frequency: "weekly",
    commission_fee_percent: 0.1,
  });

  useEffect(() => {
    getAssets().then((data) => {
      setAssets(data);
      if (data.length > 0) {
        setConfig((prev) => ({ ...prev, asset_id: data[0].id }));
      }
    });
  }, []);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const results = await runSimulation(config);
      setSimulation(results);
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Error running simulation. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const selectedAsset = assets.find(a => a.id === config.asset_id);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      {/* Top Navigation */}
      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 flex-shrink-0 z-20 bg-background-dark">
        <div className="flex items-center gap-4 text-white">
          <div className="size-8 text-primary flex items-center justify-center rounded-lg bg-primary/10">
            <BarChart2 size={20} />
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-tight">Portfolio-Lab</h2>
        </div>
        <div className="hidden md:flex flex-1 justify-end gap-8">
          <div className="flex items-center gap-9">
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium" href="#">Dashboard</a>
            <a className="text-white text-sm font-medium border-b-2 border-primary pb-0.5" href="#">Asset</a>
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium" href="#">Portfolio</a>
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium" href="#">Optimizer</a>
          </div>
          <div className="size-9 rounded-full border border-border-dark bg-surface-dark flex items-center justify-center">
             <SettingsIcon size={16} className="text-text-secondary" />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Configuration */}
        <aside className="w-full max-w-[400px] flex flex-col border-r border-border-dark bg-background-dark overflow-y-auto z-10 shadow-xl">
          <div className="p-6 pb-2">
            <h1 className="text-white tracking-light text-[24px] font-bold leading-tight">Configuration</h1>
            <p className="text-text-secondary text-sm">Set up your baseline DCA parameters.</p>
          </div>

          <div className="px-6 py-4 flex flex-col gap-5">
            {/* Asset Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-white text-sm font-medium">Select Asset</label>
              <select 
                className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base cursor-pointer appearance-none"
                value={config.asset_id}
                onChange={(e) => setConfig({ ...config, asset_id: Number(e.target.value) })}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.ticker})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium">Base Amount ($)</label>
                <input 
                  className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                  type="number" 
                  value={config.base_amount}
                  onChange={(e) => setConfig({ ...config, base_amount: Number(e.target.value) })}
                />
              </div>
              {/* Frequency */}
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium">Frequency</label>
                <select 
                  className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base cursor-pointer appearance-none"
                  value={config.frequency}
                  onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium">Start Date</label>
                <input 
                  className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                  type="date" 
                  value={config.start_date}
                  onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium">End Date</label>
                <input 
                  className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                  type="date" 
                  value={config.end_date}
                  onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Fees */}
            <div className="flex flex-col gap-2">
              <label className="text-white text-sm font-medium flex justify-between">
                <span>Commission Fee (%)</span>
                <span className="text-xs text-text-secondary">Per trade</span>
              </label>
              <input 
                className="w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                step="0.01" 
                type="number" 
                value={config.commission_fee_percent}
                onChange={(e) => setConfig({ ...config, commission_fee_percent: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="p-6 mt-auto border-t border-border-dark">
            <button 
              onClick={handleRunSimulation}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-background-dark text-base font-bold hover:bg-[#3af578] transition-colors shadow-[0_0_15px_rgba(19,236,91,0.3)] disabled:opacity-50"
            >
              {loading ? "Calculating..." : (
                <>
                  <Play size={20} fill="currentColor" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content: Results */}
        <main className="flex-1 flex flex-col bg-[#0b0f0c] overflow-hidden relative">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10">
            {simulation ? (
              <>
                <header className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-white text-[28px] font-bold leading-tight mb-2">Simulation Results</h2>
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <Calendar size={14} />
                      <span>{simulation.config.start_date} — {simulation.config.end_date}</span>
                      <span className="mx-2">•</span>
                      <span>{selectedAsset?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-lg border border-border-active bg-surface-dark text-white text-sm font-medium hover:bg-border-active transition-colors flex items-center gap-2">
                      <Download size={14} /> Export
                    </button>
                  </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={48} className="text-primary" />
                    </div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Return</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className={cn("text-3xl font-bold", simulation.results.total_return_percent >= 0 ? "text-white" : "text-red-400")}>
                        {simulation.results.total_return_percent > 0 ? "+" : ""}{simulation.results.total_return_percent}%
                      </h3>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Final Value: ${simulation.results.final_value.toLocaleString()}</p>
                  </div>

                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Invested</p>
                    <h3 className="text-white text-3xl font-bold">${simulation.results.total_invested.toLocaleString()}</h3>
                    <p className="text-text-secondary/60 text-xs mt-3">Periodic: ${simulation.config.base_amount}</p>
                  </div>

                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <p className="text-text-secondary text-sm font-medium mb-1">Accumulated Assets</p>
                    <h3 className="text-white text-3xl font-bold">{simulation.results.total_assets_accumulated.toFixed(4)} {selectedAsset?.ticker}</h3>
                    <p className="text-text-secondary/60 text-xs mt-3">Avg. Price: ${simulation.results.avg_purchase_price.toLocaleString()}</p>
                  </div>
                </div>

                {/* Chart Area */}
                <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 mb-6">
                  <h3 className="text-white text-lg font-bold mb-6">Portfolio Value Growth</h3>
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulation.results.portfolio_history}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#13ec5b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#13ec5b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9db9a6" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(str) => {
                            const date = new Date(str);
                            return date.toLocaleDateString(undefined, { month: 'short', year: '2y' });
                          }}
                        />
                        <YAxis 
                          stroke="#9db9a6" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1c271f', border: '1px solid #3b5443', borderRadius: '8px' }}
                          itemStyle={{ color: '#13ec5b' }}
                          labelStyle={{ color: '#9db9a6', marginBottom: '4px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#13ec5b" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="invested" 
                          stroke="#64748b" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="size-20 rounded-full bg-surface-dark border border-border-active flex items-center justify-center mb-6">
                  <Sliders size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Simulate?</h2>
                <p className="text-text-secondary max-w-md">
                  Configure your DCA strategy parameters on the left and click "Run Simulation" to see the results.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
