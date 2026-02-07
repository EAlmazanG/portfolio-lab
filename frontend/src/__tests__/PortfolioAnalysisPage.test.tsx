import React from 'react';
import { render, screen } from '@testing-library/react';
import PortfolioAnalysisPage from '../app/portfolio-analysis/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/portfolio-analysis',
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => {
  return ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
});

jest.mock('../lib/api', () => ({
  getPortfolios: jest.fn().mockResolvedValue([]),
  getPortfolio: jest.fn(),
  getAssetHistory: jest.fn().mockResolvedValue([]),
  runPortfolioSimulation: jest.fn(),
  getPortfolioSimulationHistory: jest.fn().mockResolvedValue([]),
  getPortfolioSimulationDetails: jest.fn(),
  deletePortfolioSimulation: jest.fn(),
  togglePortfolioSimulationFavorite: jest.fn(),
  deleteAllPortfolioSimulations: jest.fn(),
}));

describe('PortfolioAnalysisPage', () => {
  it('renders the portfolio analysis header', () => {
    render(<PortfolioAnalysisPage />);

    expect(screen.getByText('Portfolio Config')).toBeInTheDocument();
  });
});
