import { 
  Asset, 
  SimulationConfig, 
  SimulationResponse, 
  SimulationHistoryItem 
} from "../types/simulation";
import {
  Portfolio,
  PortfolioCreate,
  PortfolioListItem,
  PortfolioUpdate
} from "../types/portfolio";
import {
  PortfolioSimulationConfig,
  PortfolioSimulationResponse,
  PortfolioSimulationHistoryItem
} from "../types/portfolio_simulation";
import {
  AssetManagerListItem,
  AssetManagerSettings,
  AssetSearchResult,
  AssetOhlcPoint,
  AssetCreateRequest,
  AssetCreateResponse,
  AssetDownloadRequest,
  AssetDownloadResponse,
  UpdateAllAssetsResponse,
} from "../types/assets_manager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// --- Simulations ---

export async function getAssets(): Promise<Asset[]> {
  const response = await fetch(`${API_URL}/simulations/assets`);
  if (!response.ok) {
    throw new Error("Failed to fetch assets");
  }
  return response.json();
}

export async function runSimulation(config: SimulationConfig): Promise<SimulationResponse> {
  const response = await fetch(`${API_URL}/simulations/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to run simulation");
  }
  return response.json();
}

export async function getAssetHistory(assetId: number, startDate: string, endDate: string): Promise<{date: string, price: number}[]> {
  const response = await fetch(`${API_URL}/simulations/assets/${assetId}/history?start_date=${startDate}&end_date=${endDate}`);
  if (!response.ok) {
    throw new Error("Failed to fetch asset history");
  }
  return response.json();
}

export async function getSimulationHistory(): Promise<SimulationHistoryItem[]> {
  const response = await fetch(`${API_URL}/simulations/history`);
  if (!response.ok) {
    throw new Error("Failed to fetch history");
  }
  return response.json();
}

export async function getSimulationDetails(id: number): Promise<SimulationResponse> {
  const response = await fetch(`${API_URL}/simulations/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch simulation details");
  }
  return response.json();
}

export async function deleteSimulation(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/simulations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete simulation");
  }
}

export async function deleteAllSimulations(favoritesOnly: boolean = false, nonFavoritesOnly: boolean = false): Promise<void> {
  const params = new URLSearchParams();
  if (favoritesOnly) params.append("favorites_only", "true");
  if (nonFavoritesOnly) params.append("non_favorites_only", "true");
  
  const response = await fetch(`${API_URL}/simulations/all/delete?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete all simulations");
  }
}

export async function toggleFavorite(id: number): Promise<boolean> {
  const response = await fetch(`${API_URL}/simulations/${id}/favorite`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Failed to toggle favorite");
  }
  const data = await response.json();
  return data.is_favorite;
}

// --- Portfolio Simulations ---

export async function runPortfolioSimulation(config: PortfolioSimulationConfig): Promise<PortfolioSimulationResponse> {
  const response = await fetch(`${API_URL}/portfolio-simulations/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to run portfolio simulation");
  }
  return response.json();
}

export async function getPortfolioSimulationHistory(): Promise<PortfolioSimulationHistoryItem[]> {
  const response = await fetch(`${API_URL}/portfolio-simulations/history`);
  if (!response.ok) {
    throw new Error("Failed to fetch portfolio simulation history");
  }
  return response.json();
}

export async function getPortfolioSimulationDetails(id: number): Promise<PortfolioSimulationResponse> {
  const response = await fetch(`${API_URL}/portfolio-simulations/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch portfolio simulation details");
  }
  return response.json();
}

export async function deletePortfolioSimulation(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/portfolio-simulations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete portfolio simulation");
  }
}

export async function deleteAllPortfolioSimulations(favoritesOnly: boolean = false, nonFavoritesOnly: boolean = false): Promise<void> {
  const params = new URLSearchParams();
  if (favoritesOnly) params.append("favorites_only", "true");
  if (nonFavoritesOnly) params.append("non_favorites_only", "true");
  
  const response = await fetch(`${API_URL}/portfolio-simulations/all/delete?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete all portfolio simulations");
  }
}

export async function togglePortfolioSimulationFavorite(id: number): Promise<boolean> {
  const response = await fetch(`${API_URL}/portfolio-simulations/${id}/favorite`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Failed to toggle portfolio simulation favorite");
  }
  const data = await response.json();
  return data.is_favorite;
}

// --- Portfolios ---

export async function getPortfolios(): Promise<PortfolioListItem[]> {
  const response = await fetch(`${API_URL}/portfolios/`);
  if (!response.ok) {
    throw new Error("Failed to fetch portfolios");
  }
  return response.json();
}

export async function getPortfolio(id: number): Promise<Portfolio> {
  const response = await fetch(`${API_URL}/portfolios/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch portfolio");
  }
  return response.json();
}

export async function createPortfolio(portfolio: PortfolioCreate): Promise<Portfolio> {
  const response = await fetch(`${API_URL}/portfolios/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(portfolio),
  });
  if (!response.ok) {
    throw new Error("Failed to create portfolio");
  }
  return response.json();
}

export async function updatePortfolio(id: number, portfolio: PortfolioUpdate): Promise<Portfolio> {
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

export async function deletePortfolio(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/portfolios/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete portfolio");
  }
}

export async function togglePortfolioFavorite(id: number): Promise<boolean> {
  const response = await fetch(`${API_URL}/portfolios/${id}/favorite`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Failed to toggle favorite");
  }
  const data = await response.json();
  return data.is_favorite;
}

// --- Assets Manager ---

export async function getManagedAssets(): Promise<AssetManagerListItem[]> {
  const response = await fetch(`${API_URL}/assets-manager/assets`);
  if (!response.ok) {
    throw new Error("Failed to fetch managed assets");
  }
  return response.json();
}

export async function getAssetsManagerSettings(): Promise<AssetManagerSettings> {
  const response = await fetch(`${API_URL}/assets-manager/settings`);
  if (!response.ok) {
    throw new Error("Failed to fetch settings");
  }
  return response.json();
}

export async function getAssetOhlcPreview(ticker: string): Promise<AssetOhlcPoint[]> {
  const response = await fetch(`${API_URL}/assets-manager/assets/${ticker}/ohlc`);
  if (!response.ok) {
    throw new Error("Failed to fetch OHLC preview");
  }
  return response.json();
}

export async function updateAssetsManagerSettings(
  payload: AssetManagerSettings
): Promise<AssetManagerSettings> {
  const response = await fetch(`${API_URL}/assets-manager/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to update asset settings");
  }
  return response.json();
}

export async function searchAssetsManager(query: string): Promise<AssetSearchResult[]> {
  const response = await fetch(`${API_URL}/assets-manager/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("Failed to search assets");
  }
  return response.json();
}

export async function getAssetInfo(ticker: string): Promise<Record<string, any>> {
  const response = await fetch(`${API_URL}/assets-manager/assets/${ticker}/info`);
  if (!response.ok) {
    throw new Error("Failed to fetch asset info");
  }
  return response.json();
}

export async function createManagedAsset(
  payload: AssetCreateRequest
): Promise<AssetCreateResponse> {
  const response = await fetch(`${API_URL}/assets-manager/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create asset");
  }
  return response.json();
}

export async function downloadManagedAssetHistory(
  assetId: number,
  payload: AssetDownloadRequest
): Promise<AssetDownloadResponse> {
  const response = await fetch(`${API_URL}/assets-manager/assets/${assetId}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to download asset history");
  }
  return response.json();
}

export async function updateAllManagedAssets(): Promise<UpdateAllAssetsResponse> {
  const response = await fetch(`${API_URL}/assets-manager/assets/update-all`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to update all assets");
  }
  return response.json();
}

export async function deleteManagedAsset(assetId: number): Promise<void> {
  const response = await fetch(`${API_URL}/assets-manager/assets/${assetId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete asset");
  }
}
