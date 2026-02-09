"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  Plus,
  RefreshCcw,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Header from "../../components/Header";
import {
  createManagedAsset,
  deleteManagedAsset,
  downloadManagedAssetHistory,
  getAssetOhlcPreview,
  getAssetInfo,
  getAssetHistory,
  getAssetsManagerSettings,
  getPortfolio,
  getPortfolioSimulationHistory,
  getPortfolios,
  getManagedAssets,
  getSimulationHistory,
  searchAssetsManager,
  updateAllManagedAssets,
  updateAssetsManagerSettings,
} from "../../lib/api";
import {
  AssetCreateRequest,
  AssetDownloadRequest,
  AssetManagerListItem,
  AssetManagerSettings,
  AssetOhlcPoint,
  AssetSearchResult,
} from "../../types/assets_manager";
import { Portfolio } from "../../types/portfolio";
import { PortfolioSimulationHistoryItem } from "../../types/portfolio_simulation";
import { SimulationHistoryItem } from "../../types/simulation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getAssetTypeClasses = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("crypto") || normalized.includes("bitcoin")) {
    return "border-amber-400/40 bg-amber-500/15 text-amber-300";
  }
  if (normalized.includes("etf")) {
    return "border-sky-400/40 bg-sky-500/15 text-sky-300";
  }
  if (normalized.includes("forex") || normalized.includes("fx")) {
    return "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-300";
  }
  if (normalized.includes("index")) {
    return "border-violet-400/40 bg-violet-500/15 text-violet-300";
  }
  return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300";
};

const getCompanyTagClasses = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("tech")) {
    return "border-cyan-400/40 bg-cyan-500/15 text-cyan-300";
  }
  if (normalized.includes("finance") || normalized.includes("bank")) {
    return "border-indigo-400/40 bg-indigo-500/15 text-indigo-300";
  }
  if (normalized.includes("energy")) {
    return "border-amber-400/40 bg-amber-500/15 text-amber-300";
  }
  return "border-border-dark bg-background-dark/40 text-text-secondary";
};

const INTERVAL_OPTIONS: AssetManagerSettings["ingestion_interval"][] = ["1d", "1wk", "1mo"];

export default function AssetsManagerPage() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "add" | "manage" | "general">("overview");
  const [assets, setAssets] = useState<AssetManagerListItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [managedFilter, setManagedFilter] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<AssetManagerSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [assetPreviewData, setAssetPreviewData] = useState<{ date: string; price: number }[]>([]);
  const [assetPreviewLoading, setAssetPreviewLoading] = useState(false);
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryItem[]>([]);
  const [portfolioSimulationHistory, setPortfolioSimulationHistory] = useState<PortfolioSimulationHistoryItem[]>([]);
  const [portfolioDetails, setPortfolioDetails] = useState<Portfolio[]>([]);
  const [loadingSimulationHistory, setLoadingSimulationHistory] = useState(false);
  const [loadingPortfolioHistory, setLoadingPortfolioHistory] = useState(false);
  const [loadingPortfolioDetails, setLoadingPortfolioDetails] = useState(false);
  const [expandedPortfolioIds, setExpandedPortfolioIds] = useState<Record<number, boolean>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState<AssetSearchResult | null>(null);
  const [assetInfo, setAssetInfo] = useState<Record<string, any> | null>(null);
  const [assetInfoLoading, setAssetInfoLoading] = useState(false);
  const [assetCreateLoading, setAssetCreateLoading] = useState(false);
  const [assetOhlcData, setAssetOhlcData] = useState<AssetOhlcPoint[]>([]);
  const [assetOhlcLoading, setAssetOhlcLoading] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [deleteConfirmAssetId, setDeleteConfirmAssetId] = useState<number | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [hoveredCandle, setHoveredCandle] = useState<{ point: AssetOhlcPoint; x: number; y: number } | null>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState(900);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [downloadForm, setDownloadForm] = useState<AssetDownloadRequest>({
    years: 5,
    interval: "1d",
  });
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [updateAllLoading, setUpdateAllLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((asset: AssetManagerListItem) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  const isAssetManaged = useMemo(() => {
    if (!selectedSearchResult) return false;
    return assets.some(
      (asset: AssetManagerListItem) =>
        asset.ticker.toLowerCase() === selectedSearchResult.ticker.toLowerCase()
    );
  }, [assets, selectedSearchResult]);

  const filteredAssets = useMemo(() => {
    const query = managedFilter.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset: AssetManagerListItem) => {
      const haystack = `${asset.ticker} ${asset.name} ${asset.asset_type}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [assets, managedFilter]);

  const totalRecords = useMemo(
    () => assets.reduce((sum: number, asset: AssetManagerListItem) => sum + (asset.record_count || 0), 0),
    [assets]
  );

  const assetSimulations = useMemo(() => {
    if (!selectedAsset) return [];
    return simulationHistory.filter(
      (item: SimulationHistoryItem) => item.asset_ticker === selectedAsset.ticker
    );
  }, [selectedAsset, simulationHistory]);

  const assetToDelete = useMemo(
    () => assets.find((asset: AssetManagerListItem) => asset.id === deleteConfirmAssetId) || null,
    [assets, deleteConfirmAssetId]
  );

  const assetHasSimulations = useMemo(() => {
    if (!assetToDelete) return false;
    return simulationHistory.some(
      (item: SimulationHistoryItem) => item.asset_ticker === assetToDelete.ticker
    );
  }, [assetToDelete, simulationHistory]);

  const portfoliosWithAsset = useMemo(() => {
    if (!selectedAsset) return [];
    return portfolioDetails.filter((portfolio: Portfolio) =>
      portfolio.assets.some((asset) => asset.asset_id === selectedAsset.id)
    );
  }, [portfolioDetails, selectedAsset]);

  const portfoliosWithAssetForDelete = useMemo(() => {
    if (!assetToDelete) return [];
    return portfolioDetails.filter((portfolio: Portfolio) =>
      portfolio.assets.some((asset) => asset.asset_id === assetToDelete.id)
    );
  }, [assetToDelete, portfolioDetails]);

  const assetInPortfolios = useMemo(
    () => portfoliosWithAssetForDelete.length > 0,
    [portfoliosWithAssetForDelete.length]
  );

  const portfolioSimulationGroups = useMemo(() => {
    return portfoliosWithAsset.map((portfolio: Portfolio) => ({
      portfolio,
      simulations: portfolioSimulationHistory.filter(
        (item: PortfolioSimulationHistoryItem) => item.portfolio_name === portfolio.name
      ),
    }));
  }, [portfolioSimulationHistory, portfoliosWithAsset]);

  const assetReturns = useMemo(() => {
    if (assetPreviewData.length < 2) return [];
    const now = new Date();
    const latestPrice = assetPreviewData[assetPreviewData.length - 1]?.price;
    if (!latestPrice) return [];

    const periods: { label: string; years: number; isYTD?: boolean }[] = [
      { label: "YTD", years: 0, isYTD: true },
      { label: "1Y", years: 1 },
      { label: "3Y", years: 3 },
      { label: "5Y", years: 5 },
      { label: "10Y", years: 10 },
      { label: "15Y", years: 15 },
    ];

    return periods.map(({ label, years, isYTD }) => {
      let targetDate: Date;
      if (isYTD) {
        targetDate = new Date(now.getFullYear(), 0, 1);
      } else {
        targetDate = new Date(now);
        targetDate.setFullYear(now.getFullYear() - years);
      }
      const targetStr = targetDate.toISOString().split("T")[0];
      const firstDataDate = assetPreviewData[0]?.date;
      if (firstDataDate > targetStr) return { label, total: null, annualized: null };

      let closest = assetPreviewData[0];
      for (const point of assetPreviewData) {
        if (point.date <= targetStr) closest = point;
        else break;
      }
      const startPrice = closest.price;
      if (!startPrice) return { label, total: null, annualized: null };

      const totalReturn = ((latestPrice - startPrice) / startPrice) * 100;
      const actualYears = isYTD
        ? (now.getTime() - targetDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        : years;
      const annualized = actualYears > 0
        ? (Math.pow(latestPrice / startPrice, 1 / actualYears) - 1) * 100
        : totalReturn;

      return { label, total: totalReturn, annualized };
    });
  }, [assetPreviewData]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const width = container.offsetWidth;
      if (width > 0) {
        setChartContainerWidth(width);
      }
    });

    resizeObserver.observe(container);
    setChartContainerWidth(container.offsetWidth || 900);

    return () => resizeObserver.disconnect();
  }, []);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const data = await getManagedAssets();
      setAssets(data);
      if (data.length > 0 && selectedAssetId === null) {
        setSelectedAssetId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading assets:", error);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await getAssetsManagerSettings();
      setSettingsDraft(data);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  useEffect(() => {
    loadAssets();
    loadSettings();
    loadSimulationHistory();
    loadPortfolioSimulationHistory();
    loadPortfolioDetails();
  }, []);

  useEffect(() => {
    if (activeSection !== "manage") {
      setLeftSidebarOpen(false);
      return;
    }
    setLeftSidebarOpen(true);
  }, [activeSection]);

  useEffect(() => {
    if (!selectedAsset || activeSection !== "manage") return;
    loadAssetPreview(selectedAsset.id);
  }, [selectedAsset, activeSection]);

  const loadSimulationHistory = async () => {
    setLoadingSimulationHistory(true);
    try {
      const data = await getSimulationHistory();
      setSimulationHistory(data);
    } catch (error) {
      console.error("Error loading simulation history:", error);
    } finally {
      setLoadingSimulationHistory(false);
    }
  };

  const loadPortfolioSimulationHistory = async () => {
    setLoadingPortfolioHistory(true);
    try {
      const data = await getPortfolioSimulationHistory();
      setPortfolioSimulationHistory(data);
    } catch (error) {
      console.error("Error loading portfolio simulation history:", error);
    } finally {
      setLoadingPortfolioHistory(false);
    }
  };

  const loadPortfolioDetails = async () => {
    setLoadingPortfolioDetails(true);
    try {
      const list = await getPortfolios();
      const details = await Promise.all(list.map((portfolio) => getPortfolio(portfolio.id)));
      setPortfolioDetails(details);
    } catch (error) {
      console.error("Error loading portfolio details:", error);
    } finally {
      setLoadingPortfolioDetails(false);
    }
  };

  const loadAssetPreview = async (assetId: number) => {
    setAssetPreviewLoading(true);
    try {
      const asset = assets.find((a: AssetManagerListItem) => a.id === assetId);
      const end = new Date().toISOString().split("T")[0];
      const start = asset?.min_date || "2000-01-01";
      const history = await getAssetHistory(assetId, start, end);
      setAssetPreviewData(history);
    } catch (error) {
      console.error("Error loading asset preview:", error);
      setAssetPreviewData([]);
    } finally {
      setAssetPreviewLoading(false);
    }
  };

  const handleSearch = async (query?: string) => {
    const cleanedQuery = (query ?? searchQuery).trim();
    if (!cleanedQuery) return;
    setSearchLoading(true);
    setSelectedSearchResult(null);
    setAssetInfo(null);
    try {
      const results = await searchAssetsManager(cleanedQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching assets:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      handleSearch(cleanedQuery);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectSearchResult = async (result: AssetSearchResult) => {
    setSelectedSearchResult(result);
    setAssetInfoLoading(true);
    setAssetOhlcLoading(true);
    try {
      const [info, ohlc] = await Promise.all([
        getAssetInfo(result.ticker),
        getAssetOhlcPreview(result.ticker),
      ]);
      setAssetInfo(info);
      setAssetOhlcData(ohlc || []);
      setShowFullDescription(false);
    } catch (error) {
      console.error("Error fetching asset info:", error);
      setAssetInfo(null);
      setAssetOhlcData([]);
    } finally {
      setAssetInfoLoading(false);
      setAssetOhlcLoading(false);
    }
  };

  const renderCandlestickPreview = () => {
    if (assetOhlcLoading) {
      return <p className="text-xs text-text-secondary">Loading candles...</p>;
    }
    if (assetOhlcData.length === 0) {
      return <p className="text-xs text-text-secondary">No candle data for the last year.</p>;
    }

    const totalHeight = 240;
    const marginTop = 8;
    const marginBottom = 28;
    const marginLeft = 52;
    const marginRight = 8;
    const chartHeight = totalHeight - marginTop - marginBottom;
    const chartWidth = Math.max(300, chartContainerWidth - 16);
    const plotWidth = chartWidth - marginLeft - marginRight;
    const candleWidth = Math.max(1.2, plotWidth / Math.max(assetOhlcData.length, 1));

    const lows = assetOhlcData.map((p: AssetOhlcPoint) => p.low);
    const highs = assetOhlcData.map((p: AssetOhlcPoint) => p.high);
    const minVal = Math.min(...lows);
    const maxVal = Math.max(...highs);
    const pricePad = (maxVal - minVal) * 0.05 || 1;
    const yMin = minVal - pricePad;
    const yMax = maxVal + pricePad;
    const yRange = yMax - yMin;

    const scaleY = (v: number) => marginTop + chartHeight - ((v - yMin) / yRange) * chartHeight;

    const yTicks: number[] = [];
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      yTicks.push(yMin + (yRange * i) / tickCount);
    }

    const dateLabels: { x: number; label: string }[] = [];
    const labelInterval = Math.max(1, Math.floor(assetOhlcData.length / 5));
    for (let i = 0; i < assetOhlcData.length; i += labelInterval) {
      const d = new Date(assetOhlcData[i].date);
      dateLabels.push({
        x: marginLeft + i * candleWidth + candleWidth / 2,
        label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
      });
    }

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
      const idx = Math.floor((mouseX - marginLeft) / candleWidth);
      if (idx >= 0 && idx < assetOhlcData.length) {
        const pt = assetOhlcData[idx];
        const pxX = (e.clientX - rect.left);
        const pxY = (e.clientY - rect.top);
        setHoveredCandle({ point: pt, x: pxX, y: pxY });
      } else {
        setHoveredCandle(null);
      }
    };

    return (
      <div className="w-full overflow-hidden relative" onMouseLeave={() => setHoveredCandle(null)}>
        <svg
          width="100%"
          height={totalHeight}
          viewBox={`0 0 ${chartWidth} ${totalHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          style={{ cursor: "crosshair" }}
        >
          {yTicks.map((tick: number, i: number) => {
            const y = scaleY(tick);
            return (
              <g key={`ytick-${i}`}>
                <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} stroke="#28392e" strokeWidth={0.5} />
                <text x={marginLeft - 4} y={y + 3} fontSize="9" fill="#9db9a6" textAnchor="end">
                  {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(2)}
                </text>
              </g>
            );
          })}
          {dateLabels.map((dl: { x: number; label: string }, i: number) => (
            <text key={`xlabel-${i}`} x={dl.x} y={totalHeight - 6} fontSize="9" fill="#9db9a6" textAnchor="middle">
              {dl.label}
            </text>
          ))}
          {assetOhlcData.map((point: AssetOhlcPoint, index: number) => {
            const x = marginLeft + index * candleWidth;
            const yHigh = scaleY(point.high);
            const yLow = scaleY(point.low);
            const yOpen = scaleY(point.open);
            const yClose = scaleY(point.close);
            const candleTop = Math.min(yOpen, yClose);
            const candleH = Math.max(1, Math.abs(yOpen - yClose));
            const isUp = point.close >= point.open;
            const color = isUp ? "#13ec5b" : "#ef4444";
            const isHovered = hoveredCandle?.point.date === point.date;

            return (
              <g key={`${point.date}-${index}`} opacity={hoveredCandle && !isHovered ? 0.5 : 1}>
                <line x1={x + candleWidth / 2} x2={x + candleWidth / 2} y1={yHigh} y2={yLow} stroke={color} strokeWidth={0.8} />
                <rect
                  x={x + 0.1}
                  y={candleTop}
                  width={Math.max(1, candleWidth - 0.2)}
                  height={candleH}
                  fill={color}
                  rx={0.3}
                />
              </g>
            );
          })}
          {hoveredCandle && (
            <line
              x1={marginLeft + assetOhlcData.findIndex((p: AssetOhlcPoint) => p.date === hoveredCandle.point.date) * candleWidth + candleWidth / 2}
              x2={marginLeft + assetOhlcData.findIndex((p: AssetOhlcPoint) => p.date === hoveredCandle.point.date) * candleWidth + candleWidth / 2}
              y1={marginTop}
              y2={marginTop + chartHeight}
              stroke="#9db9a6"
              strokeWidth={0.5}
              strokeDasharray="3 2"
            />
          )}
        </svg>
        {hoveredCandle && (
          <div
            className="absolute z-10 pointer-events-none bg-surface-dark border border-border-dark rounded-lg px-3 py-2 shadow-xl text-[10px]"
            style={{
              left: Math.min(hoveredCandle.x + 12, (typeof window !== "undefined" ? window.innerWidth * 0.5 : 600)),
              top: Math.max(hoveredCandle.y - 60, 0),
            }}
          >
            <p className="text-text-secondary mb-1 font-semibold">{hoveredCandle.point.date}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-text-secondary">Open</span>
              <span className="text-white font-mono">{hoveredCandle.point.open.toFixed(2)}</span>
              <span className="text-text-secondary">High</span>
              <span className="text-white font-mono">{hoveredCandle.point.high.toFixed(2)}</span>
              <span className="text-text-secondary">Low</span>
              <span className="text-white font-mono">{hoveredCandle.point.low.toFixed(2)}</span>
              <span className="text-text-secondary">Close</span>
              <span className={`font-mono ${hoveredCandle.point.close >= hoveredCandle.point.open ? "text-[#13ec5b]" : "text-red-400"}`}>
                {hoveredCandle.point.close.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCreateAsset = async () => {
    if (!selectedSearchResult) return;
    if (isAssetManaged) {
      setStatusMessage("Asset already in your library.");
      return;
    }
    setAssetCreateLoading(true);
    setStatusMessage(null);
    const payload: AssetCreateRequest = {
      ticker: selectedSearchResult.ticker,
      name: selectedSearchResult.name,
      asset_type: selectedSearchResult.quote_type?.toLowerCase(),
      sector: selectedSearchResult.sector || undefined,
      download_history: true,
      download_years: settingsDraft?.ingestion_years,
      download_interval: settingsDraft?.ingestion_interval,
    };
    try {
      await createManagedAsset(payload);
      setStatusMessage("Asset added and history synced.");
      await loadAssets();
    } catch (error) {
      console.error("Error creating asset:", error);
      setStatusMessage("Failed to add asset.");
    } finally {
      setAssetCreateLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    setDeleteConfirmAssetId(assetId);
    setDeleteConfirmStep(0);
  };

  const confirmDeleteAsset = async () => {
    if (deleteConfirmAssetId === null) return;
    if (assetInPortfolios) return;
    if (assetHasSimulations && deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      return;
    }
    try {
      await deleteManagedAsset(deleteConfirmAssetId);
      await loadAssets();
      if (selectedAssetId === deleteConfirmAssetId) {
        setSelectedAssetId(null);
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
    } finally {
      setDeleteConfirmAssetId(null);
      setDeleteConfirmStep(0);
    }
  };

  const handleDownloadHistory = async () => {
    if (!selectedAsset) return;
    setDownloadLoading(true);
    setStatusMessage(null);
    try {
      await downloadManagedAssetHistory(selectedAsset.id, downloadForm);
      setStatusMessage("History download triggered.");
      await loadAssets();
    } catch (error) {
      console.error("Error downloading history:", error);
      setStatusMessage("Failed to download history.");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleUpdateAll = async () => {
    setUpdateAllLoading(true);
    setStatusMessage(null);
    try {
      const result = await updateAllManagedAssets();
      setStatusMessage(`Updated ${result.assets_updated} assets with ${result.records_saved} new records.`);
      await loadAssets();
    } catch (error) {
      console.error("Error updating all assets:", error);
      setStatusMessage("Failed to update assets.");
    } finally {
      setUpdateAllLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    setSettingsSaving(true);
    try {
      const updated = await updateAssetsManagerSettings(settingsDraft);
      setSettingsDraft(updated);
      setStatusMessage("Settings updated.");
    } catch (error) {
      console.error("Error updating settings:", error);
      setStatusMessage("Failed to update settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-white font-display">
      <Header />
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col bg-[#0b0f0c] relative min-h-0 overflow-hidden">
          <div
            className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#9db9a6 1px, transparent 1px), linear-gradient(90deg, #9db9a6 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          ></div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 z-10 custom-scrollbar flex flex-col">
            <div className="max-w-[1760px] mx-auto w-full flex-1 flex flex-col space-y-6 min-h-0">
              <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-dark/40 p-6 lg:p-7 rounded-[32px] border border-border-active/20 backdrop-blur-sm shadow-2xl">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Asset Management</p>
                  <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                    Ingestion Control Center
                  </h1>
                  <p className="text-xs text-text-secondary mt-3">
                    Add, sync, and maintain the asset library without leaving this view.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                  <button
                    onClick={loadAssets}
                    className="px-6 py-3 rounded-2xl border border-border-dark text-xs uppercase tracking-wide text-text-secondary hover:text-white"
                  >
                    Refresh List
                  </button>
                </div>
              </header>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    key: "add",
                    title: "Add Asset",
                    description: "Search, review, and ingest new tickers.",
                    icon: <Plus size={18} />,
                  },
                  {
                    key: "manage",
                    title: "Manage Assets",
                    description: "Open the asset library and manage data.",
                    icon: <Layers size={18} />,
                  },
                  {
                    key: "general",
                    title: "General Settings",
                    description: "Defaults, bulk sync, and global rules.",
                    icon: <SlidersHorizontal size={18} />,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key as "add" | "manage" | "general")}
                    className={cn(
                      "text-left p-6 rounded-[28px] border bg-surface-dark/60 transition-all shadow-xl",
                      activeSection === item.key
                        ? "border-primary/50 bg-primary/10"
                        : "border-border-active/10 hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Action</p>
                      <span className="text-primary">{item.icon}</span>
                    </div>
                    <h3 className="text-lg font-black mt-2">{item.title}</h3>
                    <p className="text-xs text-text-secondary mt-2">{item.description}</p>
                  </button>
                ))}
              </section>

              <div className="w-full rounded-[32px] border border-border-active/10 bg-surface-dark/40 p-6 flex flex-col flex-1 min-h-0">
                {activeSection === "overview" && (
                  <section className="space-y-6 flex-1">
                    <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60">
                      <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Overview</p>
                      <h2 className="mt-2 text-lg font-black">Pick a workflow</h2>
                      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                        Select an action above to add new assets, manage your library, or adjust global defaults.
                      </p>
                    </div>
                  </section>
                )}
                {activeSection === "add" && (
                  <section className="space-y-6">
                    <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Add</p>
                          <h2 className="text-lg font-black">Search & Add Asset</h2>
                        </div>
                        <Plus size={18} className="text-primary" />
                      </div>
                      <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,2.8fr)] gap-4">
                        <div className="p-4 rounded-xl border border-border-dark bg-background-dark/40 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Search</p>
                              <h3 className="text-sm font-bold">Find it on Yahoo</h3>
                            </div>
                            <Search size={16} className="text-primary" />
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            Start typing to see suggested tickers and companies based on your query.
                          </p>
                          <div className="flex gap-2">
                            <input
                              value={searchQuery}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                setSearchQuery(event.target.value)
                              }
                              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleSearch(searchQuery);
                                }
                              }}
                              placeholder="Search Apple, BTC, S&P 500..."
                              className="flex-1 px-4 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                            />
                            <button
                              onClick={() => handleSearch()}
                              disabled={searchLoading}
                              className="px-4 py-2 rounded-xl bg-primary text-background-dark font-bold text-xs uppercase tracking-wide"
                            >
                              {searchLoading ? "Searching" : "Search"}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {searchResults.length === 0 && !searchLoading && (
                              <p className="text-xs text-text-secondary">No results yet. Try a search above.</p>
                            )}
                            {searchResults.map((result: AssetSearchResult) => (
                              <button
                                key={result.ticker}
                                onClick={() => handleSelectSearchResult(result)}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl border flex items-start justify-between gap-3",
                                  selectedSearchResult?.ticker === result.ticker
                                    ? "border-primary/60 bg-primary/10"
                                    : "border-border-dark bg-background-dark/40 hover:border-primary/40"
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-bold">{result.ticker}</p>
                                  <p className="text-xs text-text-secondary truncate">{result.name}</p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
                                    {result.quote_type && (
                                      <span
                                        className={cn(
                                          "px-2 py-0.5 rounded-full border",
                                          getAssetTypeClasses(result.quote_type)
                                        )}
                                      >
                                        {result.quote_type}
                                      </span>
                                    )}
                                    {result.exchange && (
                                      <span className="px-2 py-0.5 rounded-full border border-border-dark">
                                        {result.exchange}
                                      </span>
                                    )}
                                    {result.sector && (
                                      <span
                                        className={cn(
                                          "px-2 py-0.5 rounded-full border",
                                          getCompanyTagClasses(result.sector)
                                        )}
                                      >
                                        {result.sector}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {result.currency && (
                                  <span className="text-[10px] uppercase text-text-secondary">
                                    {result.currency}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-border-dark bg-background-dark/40 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Confirm</p>
                              <h3 className="text-sm font-bold">Review & Add</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <Info size={16} className="text-primary" />
                              <button
                                onClick={handleCreateAsset}
                                disabled={assetCreateLoading || isAssetManaged || !selectedSearchResult}
                                className="px-3 py-2 rounded-xl bg-primary text-background-dark font-bold text-[10px] uppercase tracking-wide disabled:opacity-50"
                              >
                                {isAssetManaged ? "Already Added" : assetCreateLoading ? "Adding..." : "Add Asset"}
                              </button>
                            </div>
                          </div>
                          {!selectedSearchResult && (
                            <p className="text-xs text-text-secondary">Select a search result to inspect.</p>
                          )}
                          {selectedSearchResult && (
                            <div className="space-y-3">
                              <div className="p-4 rounded-xl bg-background-dark/70 border border-border-dark space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold">{selectedSearchResult.ticker}</p>
                                    <p className="text-xs text-text-secondary">{selectedSearchResult.name}</p>
                                  </div>
                                  <div className="text-[10px] uppercase text-text-secondary">
                                    {selectedSearchResult.exchange || ""} {selectedSearchResult.currency || ""}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(assetInfo?.quoteType || selectedSearchResult.quote_type) && (
                                    <span
                                      className={cn(
                                        "px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-full border",
                                        getAssetTypeClasses(assetInfo?.quoteType || selectedSearchResult.quote_type)
                                      )}
                                    >
                                      {assetInfo?.quoteType || selectedSearchResult.quote_type}
                                    </span>
                                  )}
                                  {selectedSearchResult.exchange && (
                                    <span className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-full border border-border-dark text-text-secondary">
                                      {selectedSearchResult.exchange}
                                    </span>
                                  )}
                                  {(assetInfo?.sector || selectedSearchResult.sector) && (
                                    <span
                                      className={cn(
                                        "px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-full border",
                                        getCompanyTagClasses(assetInfo?.sector || selectedSearchResult.sector)
                                      )}
                                    >
                                      {assetInfo?.sector || selectedSearchResult.sector}
                                    </span>
                                  )}
                                  {assetInfo?.industry && (
                                    <span
                                      className={cn(
                                        "px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-full border",
                                        getCompanyTagClasses(assetInfo.industry)
                                      )}
                                    >
                                      {assetInfo.industry}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-text-secondary space-y-2">
                                {assetInfoLoading && <p>Loading info...</p>}
                                {!assetInfoLoading && assetInfo && (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Sector</p>
                                        <p className="text-xs text-white">{assetInfo.sector || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Type</p>
                                        <p className="text-xs text-white">{assetInfo.quoteType || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Market</p>
                                        <p className="text-xs text-white">{assetInfo.exchange || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Currency</p>
                                        <p className="text-xs text-white">{assetInfo.currency || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Market Cap</p>
                                        <p className="text-xs text-white">
                                          {assetInfo.marketCap ? `$${Number(assetInfo.marketCap).toLocaleString()}` : "N/A"}
                                        </p>
                                      </div>
                                    </div>
                                    {assetInfo.longBusinessSummary && (
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Description</p>
                                        <div className="text-xs text-text-secondary leading-relaxed bg-background-dark/40 border border-border-dark rounded-lg p-3 space-y-2">
                                          <p>
                                            {showFullDescription
                                              ? assetInfo.longBusinessSummary
                                              : `${assetInfo.longBusinessSummary.slice(0, 220)}...`}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => setShowFullDescription((prev: boolean) => !prev)}
                                            className="text-[10px] uppercase tracking-[0.2em] text-primary"
                                          >
                                            {showFullDescription ? "Show less" : "Show more"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {assetInfo.website && (
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Website</p>
                                        <a
                                          href={assetInfo.website}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-primary hover:text-white transition"
                                        >
                                          {assetInfo.website}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!assetInfoLoading && !assetInfo && <p>No info found.</p>}
                              </div>
                              <div ref={chartContainerRef} className="rounded-xl border border-border-dark bg-background-dark/40 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs uppercase tracking-[0.25em] text-text-secondary">Daily candles (1y)</p>
                                  <span className="text-[10px] uppercase text-text-secondary">Preview</span>
                                </div>
                                {renderCandlestickPreview()}
                              </div>
                              {isAssetManaged && (
                                <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">
                                  Already in your library
                                </div>
                              )}
                              {statusMessage && (
                                <p className="text-xs text-text-secondary">{statusMessage}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeSection === "manage" && (
                  <section className="space-y-6 relative flex-1 flex flex-col min-h-0">
                    <div className="relative flex-1 min-h-0">
                      <aside
                        className={cn(
                          "absolute left-0 top-0 h-full flex flex-col border-r border-border-dark bg-background-dark transition-all duration-300 ease-in-out z-20 overflow-visible",
                          leftSidebarOpen ? "w-[360px]" : "w-0 border-r-0"
                        )}
                      >
                        <button
                          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                          className={cn(
                            "absolute -right-3 top-8 size-6 flex items-center justify-center bg-surface-dark border border-border-active/50 rounded-full text-text-secondary hover:text-white transition-all shadow-xl z-30 active:scale-95",
                            !leftSidebarOpen && "translate-x-3"
                          )}
                        >
                          {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                        </button>

                        <div
                          className={cn(
                            "flex flex-col h-full w-[360px] transition-opacity duration-300",
                            leftSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                          )}
                        >
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-5 border-b border-border-dark/30 bg-background-dark/50">
                              <div className="flex flex-col gap-1">
                                <h1 className="text-white tracking-tight text-2xl font-bold leading-tight text-left">
                                  Managed Assets
                                </h1>
                                <p className="text-text-secondary text-[11px] uppercase font-bold tracking-widest opacity-60">
                                  Asset library
                                </p>
                              </div>
                              <div className="mt-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-text-secondary">
                                <span>{assets.length} assets</span>
                                <button onClick={loadAssets} className="text-primary hover:text-white transition">
                                  Refresh
                                </button>
                              </div>
                              <div className="mt-4">
                                <input
                                  value={managedFilter}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                    setManagedFilter(event.target.value)
                                  }
                                  placeholder="Filter ticker or name"
                                  className="w-full px-4 py-2 rounded-xl bg-surface-dark border border-border-dark text-xs"
                                />
                              </div>
                            </div>

                            <div className="p-5 pt-4 space-y-2.5">
                              {loadingAssets && <p className="text-xs text-text-secondary">Loading assets...</p>}
                              {!loadingAssets && assets.length === 0 && (
                                <p className="text-xs text-text-secondary">No assets yet.</p>
                              )}
                              {!loadingAssets && assets.length > 0 && filteredAssets.length === 0 && (
                                <p className="text-xs text-text-secondary">No matches. Try a different filter.</p>
                              )}
                              {filteredAssets.map((asset: AssetManagerListItem) => (
                                <button
                                  key={asset.id}
                                  onClick={() => setSelectedAssetId(asset.id)}
                                  className={cn(
                                    "w-full text-left bg-surface-dark border border-border-dark rounded-xl p-3.5 hover:border-primary/50 transition-all group",
                                    selectedAssetId === asset.id
                                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/10"
                                      : "border-border-dark bg-background-dark/40 hover:border-primary/40"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className={cn(
                                          "p-1.5 rounded-lg transition-colors",
                                          selectedAssetId === asset.id
                                            ? "bg-primary text-background-dark"
                                            : "bg-primary/10 text-primary"
                                        )}
                                      >
                                        <Download size={12} />
                                      </div>
                                      <h3 className="font-bold text-sm truncate max-w-[220px]">{asset.ticker}</h3>
                                    </div>
                                    <span className="text-[10px] uppercase text-text-secondary">{asset.asset_type}</span>
                                  </div>
                                  <div className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">
                                    <span className="bg-surface-light px-1.5 py-0.5 rounded">
                                      {asset.record_count} Records
                                    </span>
                                    <span className="ml-2">
                                      {asset.min_date || "-"} → {asset.max_date || "-"}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </aside>

                      <div
                        className={cn(
                          "space-y-6 transition-all duration-300",
                          leftSidebarOpen ? "pl-[380px]" : "pl-0"
                        )}
                      >
                        <div className="grid lg:grid-cols-[minmax(0,1.9fr)_minmax(0,0.6fr)] gap-6">
                          <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Overview</p>
                                <h2 className="text-lg font-black">Asset Snapshot</h2>
                              </div>
                              <Layers size={18} className="text-primary" />
                            </div>
                            {!selectedAsset && (
                              <p className="text-xs text-text-secondary">Choose an asset from the sidebar to inspect.</p>
                            )}
                            {selectedAsset && (
                              <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-bold">{selectedAsset.ticker}</p>
                                    <p className="text-xs text-text-secondary">{selectedAsset.name}</p>
                                  </div>
                                  <div className="text-xs text-text-secondary">
                                    {selectedAsset.record_count} records · {selectedAsset.min_date || "-"} → {selectedAsset.max_date || "-"}
                                  </div>
                                </div>
                                <div className="aspect-[2.5/1] rounded-xl border border-border-dark bg-background-dark/40 p-4">
                                  {assetPreviewLoading && (
                                    <p className="text-xs text-text-secondary">Loading chart...</p>
                                  )}
                                  {!assetPreviewLoading && assetPreviewData.length === 0 && (
                                    <p className="text-xs text-text-secondary">No price history available.</p>
                                  )}
                                  {!assetPreviewLoading && assetPreviewData.length > 0 && (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart
                                        data={assetPreviewData.filter(
                                          (_: { date: string; price: number }, index: number) =>
                                            index % 7 === 0 || index === assetPreviewData.length - 1
                                        )}
                                      >
                                        <defs>
                                          <linearGradient id="assetPreviewGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#13ec5b" stopOpacity={0.1} />
                                            <stop offset="100%" stopColor="#13ec5b" stopOpacity={0} />
                                          </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#28392e" vertical={false} />
                                        <XAxis
                                          dataKey="date"
                                          stroke="#9db9a6"
                                          fontSize={10}
                                          tickLine={false}
                                          axisLine={false}
                                          tickFormatter={(value: string) => new Date(value).getFullYear().toString()}
                                          minTickGap={60}
                                        />
                                        <YAxis
                                          stroke="#9db9a6"
                                          fontSize={10}
                                          tickLine={false}
                                          axisLine={false}
                                          tickFormatter={(value: number) => `$${Number(value).toLocaleString()}`}
                                        />
                                        <Tooltip
                                          contentStyle={{
                                            backgroundColor: "#1c271f",
                                            border: "1px solid #3b5443",
                                            borderRadius: "12px",
                                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                                          }}
                                          itemStyle={{ fontSize: "14px", color: "#13ec5b", fontWeight: "bold" }}
                                          labelStyle={{ color: "#9db9a6", marginBottom: "8px" }}
                                          labelFormatter={(label: string) => new Date(label).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                          formatter={(value: number) => [`$${Number(value).toLocaleString()}`, "Price"]}
                                        />
                                        <Area
                                          type="monotone"
                                          dataKey="price"
                                          stroke="#13ec5b"
                                          strokeWidth={3}
                                          fillOpacity={1}
                                          fill="url(#assetPreviewGradient)"
                                        />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  )}
                                </div>
                                {!assetPreviewLoading && assetReturns.length > 0 && (
                                  <div className="rounded-xl border border-border-dark bg-background-dark/40 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border-dark">
                                          <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold">Period</th>
                                          <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold">Total</th>
                                          <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.2em] text-text-secondary font-bold">Annualized</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {assetReturns.map((r) => (
                                          <tr key={r.label} className="border-b border-border-dark/30 last:border-b-0">
                                            <td className="px-3 py-2 font-bold text-white">{r.label}</td>
                                            <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.total === null ? "text-text-secondary" : r.total >= 0 ? "text-primary" : "text-red-400")}>
                                              {r.total === null ? "—" : `${r.total >= 0 ? "+" : ""}${r.total.toFixed(2)}%`}
                                            </td>
                                            <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.annualized === null ? "text-text-secondary" : r.annualized >= 0 ? "text-primary" : "text-red-400")}>
                                              {r.annualized === null ? "—" : `${r.annualized >= 0 ? "+" : ""}${r.annualized.toFixed(2)}%`}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Actions</p>
                                <h2 className="text-lg font-black">Update & Delete</h2>
                              </div>
                              <Download size={18} className="text-primary" />
                            </div>
                            {!selectedAsset && (
                              <p className="text-xs text-text-secondary">Select an asset to unlock actions.</p>
                            )}
                            {selectedAsset && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <input
                                    type="number"
                                    value={downloadForm.years || ""}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                      setDownloadForm((prev: AssetDownloadRequest) => ({
                                        ...prev,
                                        years: Number(event.target.value),
                                        period: undefined,
                                      }))
                                    }
                                    placeholder="Years"
                                    className="px-3 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                                  />
                                  <select
                                    value={downloadForm.interval || "1d"}
                                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                                      setDownloadForm((prev: AssetDownloadRequest) => ({
                                        ...prev,
                                        interval: event.target.value as AssetManagerSettings["ingestion_interval"],
                                      }))
                                    }
                                    className="px-3 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                                  >
                                    {INTERVAL_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  onClick={handleDownloadHistory}
                                  disabled={downloadLoading}
                                  className="w-full px-4 py-2 rounded-xl bg-primary text-background-dark font-bold text-xs uppercase tracking-wide"
                                >
                                  {downloadLoading ? "Downloading..." : "Download History"}
                                </button>
                                <button
                                  onClick={() => handleDeleteAsset(selectedAsset.id)}
                                  className="w-full px-4 py-2 rounded-xl border border-border-dark text-xs uppercase tracking-wide text-red-400 hover:text-red-300 flex items-center justify-center gap-2"
                                >
                                  <Trash2 size={14} /> Delete Asset
                                </button>
                                {statusMessage && (
                                  <p className="text-xs text-text-secondary">{statusMessage}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                          <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Memories</p>
                                <h3 className="text-lg font-black">Asset Simulations</h3>
                              </div>
                              <CheckCircle2 size={18} className="text-primary" />
                            </div>
                            {loadingSimulationHistory && (
                              <p className="text-xs text-text-secondary">Loading simulations...</p>
                            )}
                            {!loadingSimulationHistory && assetSimulations.length === 0 && (
                              <div className="flex items-center justify-center text-xs text-text-secondary text-center py-8">
                                No simulations for this asset yet.
                              </div>
                            )}
                            {!loadingSimulationHistory && assetSimulations.length > 0 && (
                              <div className="space-y-2">
                                {assetSimulations.map((item: SimulationHistoryItem) => (
                                  <div
                                    key={item.id}
                                    className="p-3 rounded-xl border border-border-dark bg-background-dark/40 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-white">{item.asset_ticker}</span>
                                      <span className="text-text-secondary">
                                        {new Date(item.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-text-secondary mt-1">
                                      Return: {item.total_return_percent.toFixed(2)}%
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Memories</p>
                                <h3 className="text-lg font-black">Portfolio Simulations</h3>
                              </div>
                              <SettingsIcon size={18} className="text-primary" />
                            </div>
                            {loadingPortfolioDetails && (
                              <p className="text-xs text-text-secondary">Loading portfolios...</p>
                            )}
                            {!loadingPortfolioDetails && portfoliosWithAsset.length === 0 && (
                              <p className="text-xs text-text-secondary">This asset is not in any portfolio.</p>
                            )}
                            {!loadingPortfolioDetails && portfoliosWithAsset.length > 0 && (
                              <div className="space-y-3">
                                {portfolioSimulationGroups.map(
                                  (group: { portfolio: Portfolio; simulations: PortfolioSimulationHistoryItem[] }) => {
                                    const isExpanded = expandedPortfolioIds[group.portfolio.id];
                                    return (
                                      <div
                                        key={group.portfolio.id}
                                        className="p-3 rounded-xl border border-border-dark bg-background-dark/40"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedPortfolioIds((prev: Record<number, boolean>) => ({
                                              ...prev,
                                              [group.portfolio.id]: !prev[group.portfolio.id],
                                            }))
                                          }
                                          className="w-full flex items-center justify-between text-xs"
                                        >
                                          <span className="font-semibold text-white">{group.portfolio.name}</span>
                                          <span className="flex items-center gap-2 text-text-secondary">
                                            {group.simulations.length} simulations
                                            <ChevronRight
                                              size={12}
                                              className={cn("transition-transform", isExpanded && "rotate-90")}
                                            />
                                          </span>
                                        </button>
                                        {isExpanded && (
                                          <div className="mt-2">
                                            {loadingPortfolioHistory && (
                                              <p className="text-[10px] text-text-secondary">Loading simulations...</p>
                                            )}
                                            {!loadingPortfolioHistory && group.simulations.length === 0 && (
                                              <p className="text-[10px] text-text-secondary">No simulations yet.</p>
                                            )}
                                            {!loadingPortfolioHistory && group.simulations.length > 0 && (
                                              <ul className="space-y-1 text-[10px] text-text-secondary">
                                                {group.simulations.slice(0, 3).map((sim: PortfolioSimulationHistoryItem) => (
                                                  <li key={sim.id}>
                                                    {new Date(sim.created_at).toLocaleDateString()} · {sim.total_return_percent.toFixed(1)}%
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeSection === "general" && (
                  <section className="space-y-6">
                    <div className="mx-auto w-full max-w-3xl">
                      <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Global</p>
                            <h2 className="text-lg font-black leading-tight">Defaults & Bulk Sync</h2>
                            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                              Control the default history depth for new assets and trigger a bulk sync when you need fresh data.
                            </p>
                          </div>
                          <SettingsIcon size={18} className="text-primary sm:mt-1" />
                        </div>
                        {!settingsDraft && <p className="text-xs text-text-secondary">Loading settings...</p>}
                        {settingsDraft && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
                              <div>
                                <div className="min-h-[72px] flex flex-col justify-end gap-1">
                                  <label className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">
                                    Years of history
                                  </label>
                                  <p className="text-xs leading-relaxed text-text-secondary">
                                    How many years to backfill when a new asset is added.
                                  </p>
                                </div>
                                <input
                                  type="number"
                                  value={settingsDraft.ingestion_years}
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                    setSettingsDraft((prev: AssetManagerSettings | null) =>
                                      prev ? { ...prev, ingestion_years: Number(event.target.value) } : prev
                                    )
                                  }
                                  className="mt-3 h-10 w-full px-3 rounded-lg bg-background-dark border border-border-dark text-sm"
                                />
                              </div>
                              <div>
                                <div className="min-h-[72px] flex flex-col justify-end gap-1">
                                  <label className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">
                                    Default interval
                                  </label>
                                  <p className="text-xs leading-relaxed text-text-secondary">
                                    Sampling frequency used for new downloads and bulk refreshes.
                                  </p>
                                </div>
                                <select
                                  value={settingsDraft.ingestion_interval}
                                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                                    setSettingsDraft((prev: AssetManagerSettings | null) =>
                                      prev
                                        ? {
                                            ...prev,
                                            ingestion_interval: event.target.value as AssetManagerSettings["ingestion_interval"],
                                          }
                                        : prev
                                    )
                                  }
                                  className="mt-3 h-10 w-full px-3 rounded-lg bg-background-dark border border-border-dark text-sm"
                                >
                                  {INTERVAL_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-xs leading-relaxed text-text-secondary">
                                Save these defaults first — they define how bulk updates run.
                              </div>
                              <button
                                onClick={handleSaveSettings}
                                disabled={settingsSaving}
                                className="w-full sm:w-auto h-10 px-5 rounded-lg bg-primary text-background-dark font-semibold text-xs uppercase tracking-wide"
                              >
                                {settingsSaving ? "Saving..." : "Save Settings"}
                              </button>
                            </div>
                            {statusMessage && <p className="text-xs leading-relaxed text-text-secondary">{statusMessage}</p>}
                            <div className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
                              <AlertTriangle size={14} className="mt-0.5" />
                              Updates affect future sync actions for new assets and bulk updates.
                            </div>
                          </div>
                        )}
                        <div className="rounded-xl border border-border-dark/70 bg-background-dark/30 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold">Bulk update all managed assets</p>
                              <p className="text-xs leading-relaxed text-text-secondary">
                                Uses the saved defaults above to refresh every managed asset.
                              </p>
                            </div>
                            <button
                              onClick={handleUpdateAll}
                              disabled={updateAllLoading}
                              className="w-full sm:w-auto h-10 px-4 rounded-lg bg-primary text-background-dark font-semibold text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,91,0.2)] disabled:opacity-50"
                            >
                              <RefreshCcw size={14} />
                              {updateAllLoading ? "Syncing..." : "Update All Assets"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
          </div>
        </div>
        </main>

      {/* Delete Asset Confirmation Modal */}
      {deleteConfirmAssetId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-dark border border-border-active/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-red-400/10 flex items-center justify-center text-red-400 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              {assetInPortfolios ? "Asset linked to portfolios" : "Delete Asset?"}
            </h3>
            <p className="text-text-secondary text-sm text-center mb-8">
              {assetInPortfolios
                ? "This asset is currently used in one or more portfolios. Remove it from those portfolios before deleting it here."
                : assetHasSimulations && deleteConfirmStep > 0
                ? "Are you sure? This will permanently delete this asset and its simulation history."
                : assetHasSimulations
                ? "This asset has simulations. Please confirm twice to delete all its data and simulation history."
                : "This will permanently delete this asset and all its historical data. This action cannot be undone."}
            </p>
            {assetInPortfolios && (
              <div className="mb-6 space-y-3">
                <div className="flex flex-wrap justify-center gap-2">
                  {portfoliosWithAsset.map((portfolio: Portfolio) => (
                    <span
                      key={portfolio.id}
                      className="px-3 py-1 rounded-full border border-border-dark bg-background-dark/40 text-[10px] uppercase tracking-[0.2em] text-text-secondary"
                    >
                      {portfolio.name}
                    </span>
                  ))}
                </div>
                <div className="flex justify-center">
                  <Link
                    href="/portfolios"
                    className="px-5 py-2 rounded-xl border border-border-active bg-surface-dark text-white text-xs uppercase tracking-wide hover:bg-border-active transition-colors"
                  >
                    Go to Portfolio Management
                  </Link>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmAssetId(null);
                  setDeleteConfirmStep(0);
                }}
                className="flex-1 px-6 py-3 rounded-xl border border-border-active bg-surface-dark text-white font-bold hover:bg-border-active transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAsset}
                disabled={assetInPortfolios}
                className={cn(
                  "flex-1 px-6 py-3 rounded-xl text-white font-bold transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]",
                  assetInPortfolios
                    ? "bg-red-500/40 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600"
                )}
              >
                {assetHasSimulations && deleteConfirmStep === 0 ? "Confirm Delete" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
