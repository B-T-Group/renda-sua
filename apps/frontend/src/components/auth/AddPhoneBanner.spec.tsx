import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AddPhoneBanner } from './AddPhoneBanner';

const mockPost = jest.fn();
const mockRefetch = jest.fn();
let mockMarketCountry: string | undefined = 'CM';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({ post: mockPost }),
}));
jest.mock('../../contexts/UserProfileContext', () => ({
  useOptionalUserProfileContext: () => ({
    profile: { id: 'u1', email: null, phone_number: null },
    refetch: mockRefetch,
  }),
}));
jest.mock('../../contexts/MarketContext', () => ({
  useMarket: () => ({
    selectedMarket: mockMarketCountry ? { countryCode: mockMarketCountry } : null,
  }),
}));

function openDialog() {
  render(<AddPhoneBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Phone' }));
}

function typeNational(digits: string) {
  fireEvent.change(screen.getByLabelText('Phone Number'), {
    target: { value: digits },
  });
}

const saveButton = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('AddPhoneBanner', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockRefetch.mockReset();
    mockMarketCountry = 'CM';
  });

  it('renders as an info Alert with the add-phone CTA', () => {
    render(<AddPhoneBanner />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('MuiAlert-standardInfo');
    expect(screen.getByRole('button', { name: 'Add Phone' })).toBeTruthy();
  });

  it('keeps Save disabled for a too-short number in the market country (+237123)', () => {
    openDialog();
    typeNational('123');
    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByText('Please enter a valid phone number for the selected country.')
    ).toBeTruthy();
  });

  it('enables Save for a valid Cameroon number and posts E.164 with the market dial code', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    openDialog();
    typeNational('691234567');
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/users/me/phone', {
        phoneNumber: '+237691234567',
      })
    );
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('defaults to the Gabon dial code when the market is GA', async () => {
    mockMarketCountry = 'GA';
    mockPost.mockResolvedValue({ data: { success: true } });
    openDialog();
    typeNational('62123456');
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/users/me/phone', {
        phoneNumber: '+24162123456',
      })
    );
  });

  it.each([
    [400, 'Please enter a valid phone number for the selected country.'],
    [409, 'This phone number is already in use'],
  ])('maps a %s response to its translated message', async (status, message) => {
    mockPost.mockRejectedValue({ response: { status } });
    openDialog();
    typeNational('691234567');
    fireEvent.click(saveButton());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
