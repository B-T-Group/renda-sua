import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../theme/theme';
import AdminItemAppealDetailPage from './AdminItemAppealDetailPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('../../hooks/usePermissions', () => ({
  usePermission: () => true,
}));

const evidenceUrl =
  'https://signed.test/item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg?X-Amz-Expires=900';

jest.mock('../../hooks/useItemAppealsAdmin', () => ({
  useItemAppealsAdmin: () => ({
    detail: {
      appeal: {
        id: 'ap-1',
        rejectionId: 'rej-1',
        itemId: 'item-1',
        reason: 'Please reconsider this listing as it is accurate.',
        evidence: [
          {
            key: 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg',
            url: evidenceUrl,
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        ],
        status: 'pending',
        slaState: 'ok',
        slaDueAt: '2099-01-02T00:00:00.000Z',
      },
      rejection: {
        id: 'rej-1',
        category: 'photo_quality',
        reason: 'Photos are dark',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      item: { name: 'Lamp', description: 'A lamp', price: 10, currency: 'CAD' },
      business: { id: 'biz-1', name: 'Shop' },
      editedSinceRejection: false,
      selfReview: false,
      history: { audit: [], rejections: [] },
    },
    loading: false,
    error: null,
    fetchDetail: jest.fn(),
    decide: jest.fn(),
  }),
}));

describe('AdminItemAppealDetailPage', () => {
  it('renders appeal evidence from the presigned urls', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/admin/item-appeals/ap-1']}>
          <Routes>
            <Route path="/admin/item-appeals/:appealId" element={<AdminItemAppealDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );
    const image = screen.getByRole('img', { name: 'Appeal evidence' });
    expect(image).toHaveAttribute('src', evidenceUrl);
  });
});
