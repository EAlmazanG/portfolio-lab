import React from 'react';
import { render, screen } from '@testing-library/react';
import PortfoliosPage from '../app/portfolios/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/portfolios',
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
  getPortfolios: jest.fn().mockResolvedValue([]),
  getPortfolio: jest.fn(),
  getAssetHistory: jest.fn().mockResolvedValue([]),
  createPortfolio: jest.fn(),
  updatePortfolio: jest.fn(),
  deletePortfolio: jest.fn(),
  togglePortfolioFavorite: jest.fn(),
}));

describe('PortfoliosPage', () => {
  it('renders the portfolios header', () => {
    render(<PortfoliosPage />);

    expect(screen.getByText('My Portfolios')).toBeInTheDocument();
  });
});
