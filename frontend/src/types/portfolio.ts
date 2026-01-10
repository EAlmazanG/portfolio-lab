import { Asset } from "./simulation";

export interface PortfolioAsset {
  id?: number;
  asset_id: number;
  weight: number;
  asset?: Asset;
}

export interface Portfolio {
  id: number;
  name: string;
  description?: string;
  is_favorite: boolean;
  assets: PortfolioAsset[];
  created_at: string;
  updated_at: string;
}

export interface PortfolioListItem {
  id: number;
  name: string;
  description?: string;
  is_favorite: boolean;
  asset_count: number;
  created_at: string;
}

export interface PortfolioCreate {
  name: string;
  description?: string;
  is_favorite?: boolean;
  assets: {
    asset_id: number;
    weight: number;
  }[];
}
