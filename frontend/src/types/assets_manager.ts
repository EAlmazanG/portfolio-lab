export interface AssetManagerListItem {
  id: number;
  ticker: string;
  name: string;
  asset_type: string;
  interval?: string | null;
  sector?: string | null;
  is_active: boolean;
  min_date?: string | null;
  max_date?: string | null;
  record_count: number;
}

export interface AssetManagerSettings {
  ingestion_years: number;
  ingestion_interval: "1d" | "1wk" | "1mo";
}

export interface AssetSearchResult {
  ticker: string;
  name: string;
  quote_type?: string | null;
  exchange?: string | null;
  currency?: string | null;
  sector?: string | null;
}

export interface AssetOhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AssetCreateRequest {
  ticker: string;
  name?: string;
  asset_type?: string;
  sector?: string;
  download_history?: boolean;
  download_years?: number;
  download_interval?: "1d" | "1wk" | "1mo";
}

export interface AssetCreateResponse {
  asset: AssetManagerListItem;
  downloaded_records: number;
}

export interface AssetDownloadRequest {
  start_date?: string;
  end_date?: string;
  period?: string;
  years?: number;
  interval?: "1d" | "1wk" | "1mo";
}

export interface AssetDownloadResponse {
  saved_records: number;
}

export interface UpdateAllAssetsResponse {
  assets_updated: number;
  records_saved: number;
}
