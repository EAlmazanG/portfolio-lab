"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Plus,
  RefreshCcw,
  Search,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import Header from "../../components/Header";
import {
  createManagedAsset,
  deleteManagedAsset,
  downloadManagedAssetHistory,
  getAssetInfo,
  getAssetsManagerSettings,
  getManagedAssets,
  searchAssetsManager,
  updateAllManagedAssets,
  updateAssetsManagerSettings,
} from "../../lib/api";
import {
  AssetCreateRequest,
  AssetDownloadRequest,
  AssetManagerListItem,
  AssetManagerSettings,
  AssetSearchResult,
} from "../../types/assets_manager";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INTERVAL_OPTIONS: AssetManagerSettings["ingestion_interval"][] = ["1d", "1wk", "1mo"];

export default function AssetsManagerPage() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [assets, setAssets] = useState<AssetManagerListItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AssetManagerSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState<AssetSearchResult | null>(null);
  const [assetInfo, setAssetInfo] = useState<Record<string, any> | null>(null);
  const [assetInfoLoading, setAssetInfoLoading] = useState(false);
  const [assetCreateLoading, setAssetCreateLoading] = useState(false);

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
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSelectedSearchResult(null);
    setAssetInfo(null);
    try {
      const results = await searchAssetsManager(searchQuery.trim());
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching assets:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = async (result: AssetSearchResult) => {
    setSelectedSearchResult(result);
    setAssetInfoLoading(true);
    try {
      const info = await getAssetInfo(result.ticker);
      setAssetInfo(info);
    } catch (error) {
      console.error("Error fetching asset info:", error);
      setAssetInfo(null);
    } finally {
      setAssetInfoLoading(false);
    }
  };

  const handleCreateAsset = async () => {
    if (!selectedSearchResult) return;
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
    if (!confirm("Delete this asset and all its data?")) return;
    try {
      await deleteManagedAsset(assetId);
      await loadAssets();
      if (selectedAssetId === assetId) {
        setSelectedAssetId(null);
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
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
    <div className="min-h-screen bg-background-dark text-white flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "border-r border-border-dark bg-surface-dark/60 backdrop-blur-md transition-all duration-300 flex flex-col",
            leftSidebarOpen ? "w-80" : "w-16"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border-dark">
            {leftSidebarOpen && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Assets</p>
                <h2 className="text-lg font-black">Manager</h2>
              </div>
            )}
            <button
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="text-text-secondary hover:text-white transition"
            >
              {leftSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {leftSidebarOpen && (
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.3em] text-text-secondary">Managed</span>
                <span className="text-xs font-bold text-primary">{assets.length}</span>
              </div>
            )}
            <div className="space-y-2">
              {loadingAssets && <p className="text-xs text-text-secondary">Loading assets...</p>}
              {!loadingAssets && assets.length === 0 && (
                <p className="text-xs text-text-secondary">No assets yet.</p>
              )}
              {assets.map((asset: AssetManagerListItem) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition flex flex-col gap-1",
                    selectedAssetId === asset.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border-dark bg-background-dark/40 hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{asset.ticker}</span>
                    <span className="text-[10px] uppercase text-text-secondary">{asset.asset_type}</span>
                  </div>
                  {leftSidebarOpen && (
                    <>
                      <span className="text-xs text-text-secondary truncate">{asset.name}</span>
                      <span className="text-[10px] text-text-secondary">
                        {asset.min_date || "-"} → {asset.max_date || "-"}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Assets Manager</p>
                <h1 className="text-3xl font-black">Ingestion Control Center</h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleUpdateAll}
                  disabled={updateAllLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-background-dark font-bold text-xs uppercase tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(19,236,91,0.2)] disabled:opacity-50"
                >
                  <RefreshCcw size={14} />
                  {updateAllLoading ? "Syncing..." : "Update All"}
                </button>
                <button
                  onClick={loadAssets}
                  className="px-4 py-2 rounded-xl border border-border-dark text-xs uppercase tracking-wide text-text-secondary hover:text-white"
                >
                  Refresh List
                </button>
              </div>
            </div>

            {statusMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-dark/70 border border-border-dark text-sm">
                <CheckCircle2 size={16} className="text-primary" />
                {statusMessage}
              </div>
            )}

            <section className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Search</p>
                    <h2 className="text-lg font-black">Explore Yahoo Assets</h2>
                  </div>
                  <Search size={18} className="text-primary" />
                </div>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search Apple, BTC, S&P 500..."
                    className="flex-1 px-4 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                  />
                  <button
                    onClick={handleSearch}
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
                        "w-full text-left p-3 rounded-xl border flex items-center justify-between",
                        selectedSearchResult?.ticker === result.ticker
                          ? "border-primary/60 bg-primary/10"
                          : "border-border-dark bg-background-dark/40 hover:border-primary/40"
                      )}
                    >
                      <div>
                        <p className="text-sm font-bold">{result.ticker}</p>
                        <p className="text-xs text-text-secondary">{result.name}</p>
                      </div>
                      <span className="text-[10px] uppercase text-text-secondary">
                        {result.quote_type || "N/A"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Details</p>
                    <h2 className="text-lg font-black">Selected Asset</h2>
                  </div>
                  <Info size={18} className="text-primary" />
                </div>
                {!selectedSearchResult && (
                  <p className="text-xs text-text-secondary">Select a search result to inspect.</p>
                )}
                {selectedSearchResult && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-background-dark/70 border border-border-dark">
                      <p className="text-sm font-bold">{selectedSearchResult.ticker}</p>
                      <p className="text-xs text-text-secondary">{selectedSearchResult.name}</p>
                      <p className="text-[10px] uppercase text-text-secondary mt-2">
                        {selectedSearchResult.exchange || ""} {selectedSearchResult.currency || ""}
                      </p>
                    </div>
                    <div className="text-xs text-text-secondary space-y-1">
                      {assetInfoLoading && <p>Loading info...</p>}
                      {!assetInfoLoading && assetInfo && (
                        <>
                          <p>Sector: {assetInfo.sector || "N/A"}</p>
                          <p>Type: {assetInfo.quoteType || "N/A"}</p>
                          <p>Market: {assetInfo.exchange || "N/A"}</p>
                          <p>Summary: {(assetInfo.longBusinessSummary || "").slice(0, 140)}...</p>
                        </>
                      )}
                      {!assetInfoLoading && !assetInfo && <p>No info found.</p>}
                    </div>
                    <button
                      onClick={handleCreateAsset}
                      disabled={assetCreateLoading}
                      className="w-full px-4 py-2 rounded-xl bg-primary text-background-dark font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      {assetCreateLoading ? "Adding..." : "Add Asset"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Managed Asset</p>
                    <h2 className="text-lg font-black">Data Operations</h2>
                  </div>
                  <Download size={18} className="text-primary" />
                </div>
                {!selectedAsset && (
                  <p className="text-xs text-text-secondary">Select an asset from the list to manage.</p>
                )}
                {selectedAsset && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-background-dark/70 border border-border-dark">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">{selectedAsset.ticker}</p>
                          <p className="text-xs text-text-secondary">{selectedAsset.name}</p>
                        </div>
                        <span className="text-[10px] uppercase text-text-secondary">
                          {selectedAsset.interval || "1d"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-text-secondary">
                        <p>
                          Records: <span className="text-white font-semibold">{selectedAsset.record_count}</span>
                        </p>
                        <p>
                          Range: {selectedAsset.min_date || "-"} → {selectedAsset.max_date || "-"}
                        </p>
                      </div>
                    </div>

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
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Settings</p>
                    <h2 className="text-lg font-black">Ingestion Defaults</h2>
                  </div>
                  <SettingsIcon size={18} className="text-primary" />
                </div>
                {!settingsDraft && <p className="text-xs text-text-secondary">Loading settings...</p>}
                {settingsDraft && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Years</label>
                        <input
                          type="number"
                          value={settingsDraft.ingestion_years}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            setSettingsDraft((prev: AssetManagerSettings | null) =>
                              prev ? { ...prev, ingestion_years: Number(event.target.value) } : prev
                            )
                          }
                          className="mt-2 w-full px-3 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Interval</label>
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
                          className="mt-2 w-full px-3 py-2 rounded-xl bg-background-dark border border-border-dark text-sm"
                        >
                          {INTERVAL_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveSettings}
                      disabled={settingsSaving}
                      className="w-full px-4 py-2 rounded-xl bg-primary text-background-dark font-bold text-xs uppercase tracking-wide"
                    >
                      {settingsSaving ? "Saving..." : "Save Settings"}
                    </button>
                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <AlertTriangle size={14} className="mt-0.5" />
                      Updates affect future sync actions for new assets and bulk updates.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
