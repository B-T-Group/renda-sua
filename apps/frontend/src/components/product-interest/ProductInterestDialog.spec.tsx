import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { theme } from '../../theme/theme';
import { ProductInterestDialog } from './ProductInterestDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, options?: Record<string, string>) =>
      typeof defaultValue === 'string'
        ? defaultValue.replace(/\{\{(\w+)\}\}/g, (_m, k) => options?.[k] ?? '')
        : key,
  }),
}));

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }),
}));

jest.mock('../../hooks/useMarket', () => ({
  useMarket: () => ({ selectedMarket: { id: 'cm', countryCode: 'CM' } }),
}));

const mockGetEnabled = jest.fn();
jest.mock('../../hooks/useExportOrders', () => ({
  useExportOrders: () => ({ getEnabled: mockGetEnabled }),
}));

const mockSubmitInterest = jest.fn();
jest.mock('../../hooks/useProductInterest', () => ({
  useProductInterest: () => ({ submitInterest: mockSubmitInterest }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderDialog(
  onClose = jest.fn(),
  extra: Partial<React.ComponentProps<typeof ProductInterestDialog>> = {}
) {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ProductInterestDialog
          open
          businessInventoryId="inv-1"
          itemName="Widget"
          onClose={onClose}
          {...extra}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
  return onClose;
}

describe('ProductInterestDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the lead flow when export orders are off', async () => {
    mockGetEnabled.mockResolvedValue(false);
    mockSubmitInterest.mockResolvedValue({ id: 'lead-1' });
    const onClose = renderDialog();

    expect(await screen.findByText(/contact you outside the app/)).toBeTruthy();
    fireEvent.click(screen.getByText('Send interest'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSubmitInterest).toHaveBeenCalledWith('inv-1', '', 'CM', 'in_app');
    expect(mockEnqueue).toHaveBeenCalledWith(
      'Interest sent. The seller will contact you.',
      { variant: 'success' }
    );
    expect(screen.queryByTestId('export-order-submitted')).toBeNull();
  });

  it('shows order copy before submit when export orders are on', async () => {
    mockGetEnabled.mockResolvedValue(true);
    renderDialog();

    expect(await screen.findByText('Send request')).toBeTruthy();
    expect(screen.queryByText(/contact you outside the app/)).toBeNull();
  });

  it('shows the order confirmation and links to the order', async () => {
    mockGetEnabled.mockResolvedValue(true);
    mockSubmitInterest.mockResolvedValue({
      id: 'order-9',
      export_order: true,
      status: 'SUBMITTED',
      bc_number: 'BC-0042',
    });
    const onClose = renderDialog();

    fireEvent.click(await screen.findByText('Send request'));

    expect((await screen.findByTestId('export-order-bc')).textContent).toBe(
      'Purchase order BC-0042'
    );
    expect(screen.getByTestId('export-step-proforma')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith('Export request BC-0042 received.', {
      variant: 'success',
    });
    expect(
      mockEnqueue.mock.calls.some(([msg]) => /seller will contact/.test(msg))
    ).toBe(false);

    fireEvent.click(screen.getByTestId('export-order-view'));
    expect(mockNavigate).toHaveBeenCalledWith('/export-orders/order-9');
  });

  it('sends a public-page partner inquiry as a lead, never an export order', async () => {
    mockGetEnabled.mockResolvedValue(true);
    mockSubmitInterest.mockResolvedValue({ id: 'lead-2', source: 'public_export_catalog' });
    const onClose = renderDialog(jest.fn(), { source: 'public_export_catalog' });

    expect(
      screen.getByText(
        'You’re sending a partner inquiry about Widget to the business. They’ll contact you outside the app.'
      )
    ).toBeTruthy();
    expect(mockGetEnabled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Send interest'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSubmitInterest).toHaveBeenCalledWith('inv-1', '', 'CM', 'public_export_catalog');
  });
});
