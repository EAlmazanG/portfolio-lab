import '@testing-library/jest-dom';
import React from 'react';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

jest.mock('lucide-react', () => {
  return new Proxy(
    {},
    {
      get: (_, prop: string) => () => React.createElement('span', { 'data-testid': `icon-${prop}` }),
    }
  );
});

jest.mock('recharts', () => {
  return new Proxy(
    {},
    {
      get: (_, prop: string) => {
        if (prop === 'ResponsiveContainer') {
          return ({ children }: { children: React.ReactNode }) =>
            React.createElement('div', { 'data-testid': 'recharts-responsive' }, children);
        }
        return ({ children }: { children?: React.ReactNode }) =>
          React.createElement('div', { 'data-testid': `recharts-${prop}` }, children);
      },
    }
  );
});
