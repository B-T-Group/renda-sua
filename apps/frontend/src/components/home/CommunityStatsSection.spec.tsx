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
  it('renders live community counts in the network illustration', () => {
    render(
      <ThemeProvider theme={theme}>
        <CommunityStatsSection />
      </ThemeProvider>
    );

    expect(screen.getByText('Join thousands already on Rendasua')).toBeTruthy();
    expect(screen.getByText('Clients')).toBeTruthy();
    expect(screen.getByText('Agents')).toBeTruthy();
    expect(screen.getByText('Businesses')).toBeTruthy();
    expect(screen.getByText('Products')).toBeTruthy();
    expect(screen.getByText((1280).toLocaleString())).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('540')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Rendasua marketplace connecting clients, agents, businesses, and products'
      )
    ).toBeTruthy();
    expect(screen.getByText('Updates every few minutes')).toBeTruthy();
    expect(
      screen.getByText(
        'Four sides of the same marketplace — growing together in your city.'
      )
    ).toBeTruthy();
  });
});
