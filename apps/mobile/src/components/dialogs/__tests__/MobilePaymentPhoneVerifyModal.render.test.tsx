/**
 * Togo (+228) Mobile Money in the checkout verify modal: the country list
 * comes from the backend's supported-countries response (DEV shape), and a
 * +228 number is saved with calling code 228 (it used to fall back to 237).
 */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { MobilePaymentPhoneVerifyModal } from '../MobilePaymentPhoneVerifyModal';
import { mobilePaymentPhonesApi } from '../../../services/mobilePaymentPhonesApi';

jest.mock('../../../services/supportedCountriesApi', () => ({
  getSupportedCountries: jest.fn(() =>
    Promise.resolve([
      { code: 'CA', name: 'Canada', currencyCode: 'CAD', serviceStatus: 'active', deliveryEnabled: true, supportedPaymentMethods: ['stripe'] },
      { code: 'CM', name: 'Cameroon', currencyCode: 'XAF', serviceStatus: 'active', deliveryEnabled: true, supportedPaymentMethods: ['freemopay', 'orange'] },
      { code: 'GA', name: 'Gabon', currencyCode: 'XAF', serviceStatus: 'active', deliveryEnabled: true, supportedPaymentMethods: ['airtel', 'moov'] },
      { code: 'TG', name: 'Togo', currencyCode: 'XOF', serviceStatus: 'active', deliveryEnabled: true, supportedPaymentMethods: [] },
    ])
  ),
}));

jest.mock('../../../hooks/useMobilePaymentPhones', () => ({
  useMobilePaymentPhones: () => ({
    pollUntilVerified: jest.fn(),
    fetchPhones: jest.fn(() => Promise.resolve()),
    verificationMethod: 'question',
    loading: false,
    error: null,
  }),
}));

jest.mock('../../../services/mobilePaymentPhonesApi', () => {
  const actual = jest.requireActual('../../../services/mobilePaymentPhonesApi');
  return {
    parseE164Parts: actual.parseE164Parts,
    mobilePaymentPhonesApi: {
      create: jest.fn(),
      update: jest.fn(),
      setDefault: jest.fn(),
      verify: jest.fn(),
      attachAgent: jest.fn(),
    },
  };
});

jest.mock('../../../services/apiClient', () => ({ apiRequest: jest.fn() }));

const api = jest.mocked(mobilePaymentPhonesApi);

const tgPhone = {
  id: 'p1',
  phone_e164: '+22890112233',
  is_default: false,
  verification_status: 'unverified',
} as any;

function renderModal(props: Partial<React.ComponentProps<typeof MobilePaymentPhoneVerifyModal>>) {
  return renderWithProviders(
    <ThemeProvider>
      <MobilePaymentPhoneVerifyModal visible mode="add" onDismiss={jest.fn()} allowSkipVerification {...props} />
    </ThemeProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

it('offers Togo in the country picker, driven by the backend list', async () => {
  await renderModal({});
  await fireEvent.press(await screen.findByLabelText('Choose country calling code'));
  expect(await screen.findByText('Togo')).toBeTruthy();
  expect(screen.getByText('Cameroon')).toBeTruthy();
  expect(screen.getByText('Gabon')).toBeTruthy();
  expect(screen.queryByText('Canada')).toBeNull();
});

it('saves an edited +228 number with calling code 228', async () => {
  api.update.mockResolvedValue({ data: { phone: tgPhone } } as any);
  await renderModal({ mode: 'edit', initialPhone: tgPhone });
  await fireEvent.press(await screen.findByText('Continue'));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('p1', '228', '90112233'));
});

it('creates a new number in Togo after picking TG', async () => {
  api.create.mockResolvedValue({ data: { phone: tgPhone } } as any);
  await renderModal({});
  await fireEvent.press(await screen.findByLabelText('Choose country calling code'));
  await fireEvent.press(await screen.findByText('Togo'));
  await fireEvent.changeText(screen.getByLabelText('Phone'), '90112233');
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith('228', '90112233', { setAsDefault: false })
  );
});
