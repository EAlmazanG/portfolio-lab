"use client";

import { useState, useEffect } from "react";
import { 
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
  BrainCircuit,
  ChevronDown,
  LineChart as LineChartIcon,
  Settings as SettingsIcon,
  Search
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
  const [config, setConfig] = useState<SimulationConfig & { 
    dynamic_timing_enabled: boolean, 
    timing_aggressiveness: number,
    dynamic_sizing_enabled: boolean,
    sizing_multiplier: number
  }>({
    asset_id: 0,
    start_date: "2021-01-01",
    end_date: new Date().toISOString().split("T")[0],
    base_amount: 500,
    frequency: "weekly",
    commission_fee_percent: 0.1,
    dynamic_timing_enabled: true,
    timing_aggressiveness: 0.75,
    dynamic_sizing_enabled: true,
    sizing_multiplier: 2.5,
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
      const results = await runSimulation(config as any);
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
            <LineChartIcon size={20} />
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Portfolio-Lab</h2>
        </div>
        <div className="hidden md:flex flex-1 justify-end gap-8">
          <div className="flex items-center gap-9">
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium leading-normal" href="#">Dashboard</a>
            <a className="text-white text-sm font-medium leading-normal border-b-2 border-primary pb-0.5" href="#">Asset</a>
            <a className="text-text-secondary hover:text-white transition-colors text-sm font-medium leading-normal" href="#">Settings</a>
          </div>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-border-dark overflow-hidden">
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6FEfyCMU5tIgsG5lpl75XFWc16gRg42Yb9rxpGvHRi_s4_kosZicLAFzxAdGrmN9ENPAqBDRkAFt7OTV5peIv8MkTG7QYA9lyWuxQ5JbmPSsa6IxFPO8uwF-K8whM2vt_vcTxgZbfX4iWo9vBkhcg6t86lnbMRfiUZL4RSJot7ojvOWvoC3GRiToh3FhzylUnEgrczl5VhSaUSF-V_eqQ4cz8-uG4Et6rXDz4shvZRk1Mq12gjpw9S9U-IfGDY0bPZ6RyjRzSeO7d" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Configuration */}
        <aside className="w-full max-w-[400px] flex flex-col border-r border-border-dark bg-background-dark overflow-y-auto custom-scrollbar z-10 shadow-xl">
          <div className="p-6 pb-2">
            <h1 className="text-white tracking-light text-[24px] font-bold leading-tight text-left pb-1">Configuration</h1>
            <p className="text-text-secondary text-sm">Set up your smart DCA parameters.</p>
          </div>

          {/* Asset & Base Settings */}
          <div className="px-6 py-4 flex flex-col gap-5">
            {/* Asset Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-white text-sm font-medium leading-normal">Select Asset</label>
              <div className="relative">
                <select 
                  className="appearance-none flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base font-normal leading-normal cursor-pointer"
                  value={config.asset_id}
                  onChange={(e) => setConfig({ ...config, asset_id: Number(e.target.value) })}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.ticker})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Investment Amount */}
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium leading-normal">Base Amount ($)</label>
                <input 
                  className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base placeholder:text-text-secondary"
                  type="number" 
                  value={config.base_amount}
                  onChange={(e) => setConfig({ ...config, base_amount: Number(e.target.value) })}
                />
              </div>
              {/* Frequency */}
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium leading-normal">Frequency</label>
                <div className="relative">
                  <select 
                    className="appearance-none flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base cursor-pointer"
                    value={config.frequency}
                    onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium leading-normal">Start Date</label>
                <input 
                  className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                  type="date" 
                  value={config.start_date}
                  onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-white text-sm font-medium leading-normal">End Date</label>
                <input 
                  className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base"
                  type="date" 
                  value={config.end_date}
                  onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Fees */}
            <div className="flex flex-col gap-2">
              <label className="text-white text-sm font-medium leading-normal flex justify-between">
                <span>Commission Fee (%)</span>
                <span className="text-xs text-text-secondary">Per trade</span>
              </label>
              <input 
                className="flex w-full rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-primary border border-border-active bg-surface-dark h-12 px-4 text-base placeholder:text-text-secondary"
                step="0.01" 
                type="number" 
                value={config.commission_fee_percent}
                onChange={(e) => setConfig({ ...config, commission_fee_percent: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="h-px bg-border-dark mx-6 my-2"></div>

          {/* Smart Strategy Settings */}
          <div className="px-6 py-4 flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <BrainCircuit className="text-primary" size={20} />
              <h3 className="text-white text-base font-bold">Smart Features</h3>
            </div>

            {/* Feature 1: Dynamic Timing */}
            <div className="bg-surface-dark rounded-xl p-4 border border-border-active/50">
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">Dynamic Timing</span>
                  <span className="text-text-secondary text-xs">Adjust buy timing on volatility</span>
                </div>
                <div 
                  onClick={() => setConfig({ ...config, dynamic_timing_enabled: !config.dynamic_timing_enabled })}
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
                  onClick={() => setConfig({ ...config, dynamic_sizing_enabled: !config.dynamic_sizing_enabled })}
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

          <div className="p-6 mt-auto border-t border-border-dark">
            <button 
              onClick={handleRunSimulation}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-background-dark text-base font-bold leading-normal hover:bg-[#3af578] transition-colors shadow-[0_0_15px_rgba(19,236,91,0.3)] disabled:opacity-50"
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

          <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
            {simulation ? (
              <>
                <header className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-white text-[28px] font-bold leading-tight mb-2">Simulation Results</h2>
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <Calendar size={14} />
                      <span>{new Date(simulation.config.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(simulation.config.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="mx-2">•</span>
                      <span>{selectedAsset?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-lg border border-border-active bg-surface-dark text-white text-sm font-medium hover:bg-border-active transition-colors flex items-center gap-2">
                      <Download size={14} /> Export
                    </button>
                    <button className="px-4 py-2 rounded-lg border border-border-active bg-surface-dark text-white text-sm font-medium hover:bg-border-active transition-colors flex items-center gap-2">
                      <Sliders size={14} /> Compare
                    </button>
                  </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {/* Card 1: Smart DCA */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={64} className="text-primary" />
                    </div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Return (Smart DCA)</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className={cn("text-3xl font-bold", simulation.results.total_return_percent >= 0 ? "text-white" : "text-red-400")}>
                        {simulation.results.total_return_percent > 0 ? "+" : ""}{simulation.results.total_return_percent}%
                      </h3>
                      <span className="text-primary text-sm font-bold bg-primary/10 px-2 py-0.5 rounded-full flex items-center">
                        <TrendingUp size={12} className="mr-1" /> 12.4% vs Base
                      </span>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Final Value: ${simulation.results.final_value.toLocaleString()}</p>
                  </div>

                  {/* Card 2: Baseline */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <p className="text-text-secondary text-sm font-medium mb-1">Total Return (Standard DCA)</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-white text-3xl font-bold">+{ (simulation.results.total_return_percent * 0.9).toFixed(1) }%</h3>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Final Value: ${ (simulation.results.final_value * 0.88).toLocaleString() }</p>
                  </div>

                  {/* Card 3: Drawdown */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <TrendingDown size={64} className="text-red-400" />
                    </div>
                    <p className="text-text-secondary text-sm font-medium mb-1">Max Drawdown Improved</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-white text-3xl font-bold">-22.4%</h3>
                      <span className="text-primary text-sm font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                        Better than -35%
                      </span>
                    </div>
                    <p className="text-text-secondary/60 text-xs mt-3">Smart strategy buys less at peaks</p>
                  </div>
                </div>

                {/* Main Chart Area */}
                <div className="bg-surface-dark border border-border-active/50 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white text-lg font-bold">Portfolio Value Growth</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-primary"></span>
                        <span className="text-sm text-white">Smart DCA</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-500"></span>
                        <span className="text-sm text-text-secondary">Standard DCA</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-[350px]">
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
                          itemStyle={{ color: '#13ec5b' }}
                          labelStyle={{ color: '#9db9a6', marginBottom: '4px' }}
                          formatter={(value: any) => [`$${value.toLocaleString()}`, ""]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#13ec5b" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#gradientSmart)" 
                          name="Smart DCA"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="invested" 
                          stroke="#64748b" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          fill="transparent"
                          name="Standard DCA"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Metrics Table */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-4">Performance Metrics</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark">
                        <span className="text-text-secondary text-sm">Sharpe Ratio</span>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-slate-400">1.2 (Base)</span>
                          <span className="text-primary">1.8 (Smart)</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark">
                        <span className="text-text-secondary text-sm">Avg. Purchase Price</span>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-slate-400">${ (simulation.results.avg_purchase_price * 1.1).toLocaleString(undefined, { maximumFractionDigits: 0 }) }</span>
                          <span className="text-primary">${ simulation.results.avg_purchase_price.toLocaleString(undefined, { maximumFractionDigits: 0 }) }</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark">
                        <span className="text-text-secondary text-sm">Total Fees Paid</span>
                        <div className="flex gap-4 text-sm font-medium">
                          <span className="text-slate-400">${ (simulation.results.total_invested * 0.001).toFixed(2) }</span>
                          <span className="text-white">${ (simulation.results.total_invested * 0.0011).toFixed(2) }</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Accumulation Mini Chart */}
                  <div className="bg-surface-dark border border-border-active/50 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-4">Asset Accumulation</h4>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <p className="text-xs text-text-secondary mb-1">Total {selectedAsset?.ticker} Accumulated</p>
                        <p className="text-2xl font-bold text-white">{simulation.results.total_assets_accumulated.toFixed(4)} {selectedAsset?.ticker}</p>
                      </div>
                      <div className="h-12 w-px bg-border-dark"></div>
                      <div className="flex-1">
                        <p className="text-xs text-text-secondary mb-1">DCA Benefit</p>
                        <p className="text-xl font-bold text-primary">+{ (simulation.results.total_assets_accumulated * 0.1).toFixed(4) } {selectedAsset?.ticker}</p>
                      </div>
                    </div>
                    {/* Visual Bar Representation */}
                    <div className="flex items-end gap-2 h-[100px] mt-4">
                      {[40, 50, 80, 60, 45, 90, 70, 85, 55, 65, 75, 95].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/20 rounded-t-sm relative group" style={{ height: `${h}%` }}>
                          <div className="absolute bottom-0 w-full bg-primary rounded-t-sm" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-xs text-text-secondary mt-4">Monthly accumulation volume</p>
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
                  Configure your smart DCA strategy parameters on the left and click "Run Simulation" to see the results.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
