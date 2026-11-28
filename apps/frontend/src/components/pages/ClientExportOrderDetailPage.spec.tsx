import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../theme/theme';
import ClientExportOrderDetailPage from './ClientExportOrderDetailPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

let mockStatus = 'PROFORMA_ISSUED';
const mockApi = {
  getOne: async () => ({
    id: 'o1',
    bc_number: 'BC-1',
    status: mockStatus,
    lines: [{ id: 'l1', quantity: 2, product_name: 'Maple syrup' }],
    documents: [{ id: 'd1', doc_type: 'PRO', document_number: 'PRO-1' }],
  }),
  proformaAction: jest.fn(),
  selectBalanceOption: jest.fn(),
  confirmDelivery: jest.fn(),
};
jest.mock('../../hooks/useExportOrders', () => ({
  useExportOrders: () => mockApi,
}));

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/export-orders/o1']}>
        <Routes>
          <Route path="/export-orders/:id" element={<ClientExportOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

describe('ClientExportOrderDetailPage', () => {
  it('explains the next step, shows progress and offers the proforma actions', async () => {
    mockStatus = 'PROFORMA_ISSUED';
    renderPage();
    expect(await screen.findByText('Your proforma is ready')).toBeTruthy();
    expect(screen.getByText('Approve proforma')).toBeTruthy();
    expect(screen.getByTestId('export-progress-proforma')).toBeTruthy();
    expect(screen.getByText('Proforma invoice · PRO-1')).toBeTruthy();
  });

  it('hides progress for a stopped order and explains why', async () => {
    mockStatus = 'CANCELLED';
    renderPage();
    expect(await screen.findByText('This order was cancelled')).toBeTruthy();
    expect(screen.queryByTestId('export-progress')).toBeNull();
  });
});
