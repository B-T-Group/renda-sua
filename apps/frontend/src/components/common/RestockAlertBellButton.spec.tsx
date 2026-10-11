import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  ...jest.requireActual('../../hooks/useRestockAlerts'),
  useRestockAlertsApi: () => ({ setItemAlert: mockSetItemAlert }),
}));

// Same shape as the real hook: an object with `trackSiteEvent`.
jest.mock('../../hooks/useTrackSiteEvent', () => ({
  ...jest.requireActual('../../hooks/useTrackSiteEvent'),
  useTrackSiteEvent: () => ({ trackSiteEvent: mockTrackSiteEvent }),
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
    mockSetItemAlert.mockReset();
    mockTrackSiteEvent.mockReset();
  });

  const renderBell = (
    alertState: ItemAlertState,
    onAlertChange = jest.fn()
  ) => {
    render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="catalog-item-id"
          itemName="Test Item"
          alertState={alertState}
          onAlertChange={onAlertChange}
        />
      </TestWrapper>
    );
    return onAlertChange;
  };

  it('labels the bell on / off for screen readers', () => {
    const { unmount } = render(
      <TestWrapper>
        <RestockAlertBellButton
          itemId="x"
          itemName="Test Item"
          alertState={{ state: 'on', enabled: true, expires_at: null }}
        />
      </TestWrapper>
    );
    expect(
      screen.getByRole('button', { name: 'Restock alert for Test Item: on' })
    ).toBeTruthy();
    unmount();
    renderBell({ state: 'off', enabled: false, expires_at: null });
    expect(
      screen.getByRole('button', { name: 'Restock alert for Test Item: off' })
    ).toBeTruthy();
  });

  it('an expired bell reads as off and turns ON when tapped', async () => {
    mockSetItemAlert.mockResolvedValue({
      item_id: 'catalog-item-id',
      enabled: true,
      state: 'armed',
      expires_at: '2027-01-01T00:00:00.000Z',
    });
    const onChange = renderBell({
      state: 'expired',
      enabled: true,
      expires_at: '2025-01-01T00:00:00.000Z',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Restock alert for Test Item: off' })
    );
    await waitFor(() =>
      expect(mockSetItemAlert).toHaveBeenCalledWith('catalog-item-id', true)
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'on', enabled: true })
      )
    );
    expect(await screen.findByText('Alert on')).toBeTruthy();
    expect(mockTrackSiteEvent).not.toHaveBeenCalled();
  });

  it('turning off calls the catalog item id, shows the undo toast and tracks restock.opt_out', async () => {
    mockSetItemAlert.mockResolvedValue({
      item_id: 'catalog-item-id',
      enabled: false,
      state: 'disarmed',
      expires_at: null,
    });
    const onChange = renderBell({
      state: 'on',
      enabled: true,
      expires_at: null,
    });
    fireEvent.click(screen.getByRole('button', { name: /Restock alert/ }));
    await waitFor(() =>
      expect(mockSetItemAlert).toHaveBeenCalledWith('catalog-item-id', false)
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'off', enabled: false })
    );
    expect(await screen.findByText('Undo')).toBeTruthy();
    expect(mockTrackSiteEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'restock.opt_out',
        metadata: { surface: 'bell' },
      })
    );
  });

  it('does not report a failure when the API call succeeds', async () => {
    mockSetItemAlert.mockResolvedValue({
      item_id: 'x',
      enabled: false,
      state: 'disarmed',
      expires_at: null,
    });
    renderBell({ state: 'on', enabled: true, expires_at: null });
    fireEvent.click(screen.getByRole('button', { name: /Restock alert/ }));
    await screen.findByText('Undo');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
