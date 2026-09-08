import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CommunityStatsSection from './CommunityStatsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) =>
      typeof fallback === 'string' ? fallback : _key,
  }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
  useMotionValue: (value: number) => ({ set: jest.fn(), get: () => value }),
  useSpring: () => ({ on: () => () => undefined }),
}));

jest.mock('../../hooks/useMarketplacePublicStats', () => ({
  useMarketplacePublicStats: () => ({
    stats: {
      clients: 1280,
      agents: 42,
      merchants: 18,
      products: 540,
    },
    loading: false,
    error: null,
  }),
}));

const theme = createTheme();

describe('CommunityStatsSection', () => {
  it('renders live community counts', () => {
    render(
      <ThemeProvider theme={theme}>
        <CommunityStatsSection />
      </ThemeProvider>
    );

    expect(screen.getByText('Join thousands already on Rendasua')).toBeTruthy();
    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agents').length).toBeGreaterThan(0);
    expect(screen.getByText('Businesses')).toBeTruthy();
    expect(screen.getAllByText('Products').length).toBeGreaterThan(0);
    expect(screen.getByText('Updates every few minutes')).toBeTruthy();
  });
});
