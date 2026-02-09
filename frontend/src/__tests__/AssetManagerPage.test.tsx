import React from 'react';
import { render, screen } from '@testing-library/react';
import AssetsManagerPage from '../app/assets-manager/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/assets-manager',
}));

jest.mock('next/link', () => {
  return ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
});

jest.mock('../lib/api', () => ({
  getManagedAssets: jest.fn().mockResolvedValue([]),
  getAssetsManagerSettings: jest.fn().mockResolvedValue({ ingestion_years: 5, ingestion_interval: '1d' }),
  getSimulationHistory: jest.fn().mockResolvedValue([]),
  getPortfolioSimulationHistory: jest.fn().mockResolvedValue([]),
  getPortfolios: jest.fn().mockResolvedValue([]),
  getPortfolio: jest.fn(),
  getAssetHistory: jest.fn().mockResolvedValue([]),
  getAssetInfo: jest.fn().mockResolvedValue({}),
  createManagedAsset: jest.fn(),
  deleteManagedAsset: jest.fn(),
  downloadManagedAssetHistory: jest.fn(),
  searchAssetsManager: jest.fn().mockResolvedValue([]),
  updateAllManagedAssets: jest.fn().mockResolvedValue({ assets_updated: 0, records_saved: 0 }),
  updateAssetsManagerSettings: jest.fn(),
}));

describe('AssetsManagerPage', () => {
  it('renders the action buttons', () => {
    render(<AssetsManagerPage />);

    expect(screen.getByText('Add Asset')).toBeInTheDocument();
    expect(screen.getByText('Manage Assets')).toBeInTheDocument();
    expect(screen.getByText('General Settings')).toBeInTheDocument();
  });
});
