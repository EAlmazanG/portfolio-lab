import React from 'react';
import { render, screen } from '@testing-library/react';
import AssetSimulationPage from '../app/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('next/link', () => {
  return ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
});

jest.mock('../lib/api', () => ({
  getAssets: jest.fn().mockResolvedValue([]),
  runSimulation: jest.fn(),
  getSimulationHistory: jest.fn().mockResolvedValue([]),
  getSimulationDetails: jest.fn(),
  deleteSimulation: jest.fn(),
  deleteAllSimulations: jest.fn(),
  toggleFavorite: jest.fn(),
  getAssetHistory: jest.fn().mockResolvedValue([]),
}));

describe('AssetSimulationPage', () => {
  it('renders configuration section', () => {
    render(<AssetSimulationPage />);

    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });
});
