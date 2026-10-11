import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { RestockAlertBellButton } from './RestockAlertBellButton';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';

const theme = createTheme();

const mockSetItemAlert = jest.fn();
const mockTrackSiteEvent = jest.fn();

jest.mock('../../hooks/useRestockAlerts', () => ({
  useRestockAlerts: () => ({
    setItemAlert: mockSetItemAlert,
  }),
}));

jest.mock('../../hooks/useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => mockTrackSiteEvent,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM: 'inventory_item',
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <I18nextProvider i18n={i18n}>
          <SnackbarProvider>{children}</SnackbarProvider>
        </I18nextProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

describe('RestockAlertBellButton', () => {
  beforeEach(() => {
    mockSetItemAlert.mockClear();
    mockTrackSiteEvent.mockClear();
  });

  it('renders bell with "on" state', () => {
    const alertState: ItemAlertState = {
      state: 'on',
      enabled: true,
      expires_at: '2026-12-31T00:00:00.000Z',
    };

    render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="test-item-id"
          itemName="Test Item"
          alertState={alertState}
        />
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders bell with "off" state', () => {
    const alertState: ItemAlertState = {
      state: 'off',
      enabled: false,
      expires_at: null,
    };

    render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="test-item-id"
          itemName="Test Item"
          alertState={alertState}
        />
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders bell with "expired" state', () => {
    const alertState: ItemAlertState = {
      state: 'expired',
      enabled: false,
      expires_at: '2025-01-01T00:00:00.000Z',
    };

    render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="test-item-id"
          itemName="Test Item"
          alertState={alertState}
        />
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('includes accessible aria-label', () => {
    const alertState: ItemAlertState = {
      state: 'on',
      enabled: true,
      expires_at: '2026-12-31T00:00:00.000Z',
    };

    render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="test-item-id"
          itemName="Test Item"
          alertState={alertState}
        />
      </TestWrapper>
    );

    const button = screen.getByRole('button');
    const ariaLabel = button.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Test Item');
  });
});
