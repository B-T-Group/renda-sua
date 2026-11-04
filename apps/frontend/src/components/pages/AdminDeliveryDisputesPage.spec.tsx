import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { theme } from '../../theme/theme';
import AdminDeliveryDisputesPage from './AdminDeliveryDisputesPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, d?: any, o?: any) => {
      const s = typeof d === 'string' ? d : key;
      const vars = typeof d === 'object' ? d : o;
      return vars ? s.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(vars[k])) : s;
    },
  }),
}));
jest.mock('../seo/SEOHead', () => () => null);

const mockClient = { get: jest.fn(), post: jest.fn() };
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => mockClient,
}));
const get = mockClient.get;

describe('AdminDeliveryDisputesPage', () => {
  it('shows reports and flags repeat unsupported reporters', async () => {
    get.mockResolvedValue({
      data: {
        disputes: [
          {
            order: {
              id: 'o1',
              order_number: 'RS-1',
              current_status: 'disputed',
              dispute_type: 'delivery_failed',
              dispute_reason: 'courier_didnt_come',
            },
            reports: [
              { id: 'r1', report_type: 'delivery_failed', reason: 'courier_didnt_come', phase: 'pre_completion', outcome: 'pending', created_at: 'x' },
            ],
            clientUnsupportedReports: 3,
            clientFlagged: true,
          },
        ],
      },
    });
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <AdminDeliveryDisputesPage />
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(await screen.findByText('#RS-1')).toBeTruthy();
    expect(screen.getByTestId('client-flag').textContent).toContain('3');
    expect(screen.getByText('Resolve')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/admin/delivery-disputes?scope=open');
  });
});
