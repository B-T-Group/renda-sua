/** Client export-order screens: post-submit confirmation, list, and detail actions. */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import ExportOrderSubmittedScreen from '../ExportOrderSubmittedScreen';
import ClientExportOrdersScreen from '../ClientExportOrdersScreen';
import ClientExportOrderDetailScreen from '../ClientExportOrderDetailScreen';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, setOptions: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockListMine = jest.fn();
const mockGetOne = jest.fn();
const mockProformaAction = jest.fn();
jest.mock('../../../hooks/useExportOrders', () => ({
  useExportOrders: () => ({
    listMine: mockListMine,
    getOne: mockGetOne,
    proformaAction: mockProformaAction,
    selectBalanceOption: jest.fn(),
    confirmDelivery: jest.fn(),
  }),
}));

const render = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => jest.clearAllMocks());

describe('ExportOrderSubmittedScreen', () => {
  it('shows the BC number and what happens next, then opens the order', async () => {
    mockParams = { orderId: 'o1', bcNumber: 'BC-0042' };
    await render(<ExportOrderSubmittedScreen />);
    expect(screen.getByText('Request received')).toBeTruthy();
    expect(screen.getByText('Purchase order BC-0042')).toBeTruthy();
    expect(screen.getByTestId('export-step-proforma')).toBeTruthy();
    expect(screen.queryByText(/seller will contact/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('export-submitted-view-order'));
    expect(mockReplace).toHaveBeenCalledWith('ClientExportOrderDetail', { orderId: 'o1' });
  });
});

describe('ClientExportOrdersScreen', () => {
  it('lists orders with a status and opens the detail', async () => {
    mockListMine.mockResolvedValue({
      items: [{ id: 'o1', bc_number: 'BC-0042', status: 'PROFORMA_ISSUED' }],
    });
    await render(<ClientExportOrdersScreen />);
    expect(await screen.findByText('BC-0042')).toBeTruthy();
    expect(screen.getByText('Proforma ready')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('export-order-row-o1'));
    expect(mockNavigate).toHaveBeenCalledWith('ClientExportOrderDetail', { orderId: 'o1' });
  });

  it('shows an empty state', async () => {
    mockListMine.mockResolvedValue({ items: [] });
    await render(<ClientExportOrdersScreen />);
    expect(await screen.findByText('No export orders yet.')).toBeTruthy();
  });
});

describe('ClientExportOrderDetailScreen', () => {
  it('lets the client approve a proforma', async () => {
    mockParams = { orderId: 'o1' };
    mockGetOne.mockResolvedValue({
      id: 'o1',
      bc_number: 'BC-0042',
      status: 'PROFORMA_ISSUED',
      lines: [{ id: 'l1', product_name: 'Widget', quantity: 3 }],
    });
    mockProformaAction.mockResolvedValue({});
    await render(<ClientExportOrderDetailScreen />);
    expect(await screen.findByText('3 × Widget')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('export-approve'));
    await waitFor(() => expect(mockProformaAction).toHaveBeenCalledWith('o1', 'approve'));
  });

  it('shows no actions while the order is in review', async () => {
    mockParams = { orderId: 'o2' };
    mockGetOne.mockResolvedValue({ id: 'o2', bc_number: 'BC-0043', status: 'IN_REVIEW', lines: [] });
    await render(<ClientExportOrderDetailScreen />);
    expect(await screen.findByText('Under review')).toBeTruthy();
    expect(screen.queryByTestId('export-approve')).toBeNull();
  });

  it('shows next step guidance, progress and documents', async () => {
    mockParams = { orderId: 'o3' };
    mockGetOne.mockResolvedValue({
      id: 'o3',
      bc_number: 'BC-0044',
      status: 'PROFORMA_ISSUED',
      lines: [],
      documents: [{ id: 'd1', doc_type: 'PRO', document_number: 'PRO-0044' }],
    });
    await render(<ClientExportOrderDetailScreen />);
    expect(await screen.findByText('Your proforma is ready')).toBeTruthy();
    expect(screen.getByTestId('export-progress-proforma')).toBeTruthy();
    expect(screen.getByText('Proforma invoice')).toBeTruthy();
    expect(screen.getByText('PRO-0044')).toBeTruthy();
  });
});
