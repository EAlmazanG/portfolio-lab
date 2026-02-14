import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../components/Header';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('next/link', () => {
  return ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
});

jest.mock('lucide-react', () => ({
  LineChart: () => <span data-testid="logo-icon" />,
}));

describe('Header', () => {
  it('renders all navigation tabs', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Header />);

    expect(screen.getByText('Asset Management')).toBeInTheDocument();
    expect(screen.getByText('Asset Simulation')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Management')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Simulation')).toBeInTheDocument();
  });

  it.each([
    ['/', 'Asset Simulation'],
    ['/assets-manager', 'Asset Management'],
    ['/portfolios', 'Portfolio Management'],
    ['/portfolio-analysis', 'Portfolio Simulation'],
  ])('marks %s as active', (path, label) => {
    mockUsePathname.mockReturnValue(path);
    render(<Header />);

    expect(screen.getByText(label)).toHaveClass('bg-primary');
  });
});
