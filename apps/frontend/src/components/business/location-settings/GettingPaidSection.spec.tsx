import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import GettingPaidSection from './GettingPaidSection';
import { LocationSectionActions } from './sectionTypes';

const mockEnqueueSnackbar = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('../../../hooks/useBusinessAccountType', () => ({
  useBusinessAccountType: () => ({ plan: { commissionPercent: 5 } }),
}));

jest.mock('../../dialogs/MobilePaymentPhoneVerifyModal', () => ({
  MobilePaymentPhoneVerifyModal: () => null,
}));

const mockDeletePhone = jest.fn();

jest.mock('../../../hooks/useMobilePaymentPhones', () => ({
  useMobilePaymentPhones: () => ({
    phones: [
      { id: 'phone-1', phone_e164: '+237611111111', is_verified: true },
      { id: 'phone-2', phone_e164: '+237600000000', is_verified: true },
    ],
    deletePhone: mockDeletePhone,
    fetchPhones: jest.fn(),
  }),
}));

function location(): BusinessLocation {
  return {
    id: 'loc-1',
    name: 'Akwa',
    address: {
      id: 'a',
      address_line_1: 'Rue Joss',
      city: 'Douala',
      state: 'LT',
      postal_code: '',
      country: 'CM',
    },
    is_active: true,
    is_primary: false,
    location_type: 'store',
    created_at: '',
    updated_at: '',
    mobile_payment_phone_id: 'phone-1',
    mobile_payment_phone: {
      id: 'phone-1',
      phone_e164: '+237611111111',
      is_verified: true,
    },
  };
}

function renderSection(updateLocation: LocationSectionActions['updateLocation']) {
  const actions: LocationSectionActions = {
    location: location(),
    locations: [location()],
    isStripeRail: false,
    railLoading: false,
    isOwnBusiness: true,
    updateLocation,
    deleteLocation: jest.fn(),
    onManageItems: jest.fn(),
  };
  return render(
    <MemoryRouter>
      <GettingPaidSection {...actions} />
    </MemoryRouter>
  );
}

describe('GettingPaidSection', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
    mockDeletePhone.mockClear();
  });

  it('unlinks this location only and does not delete the shared registry number', async () => {
    const updateLocation = jest.fn().mockResolvedValue({});
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith('loc-1', {
        mobile_payment_phone_id: null,
      })
    );
    expect(mockDeletePhone).not.toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'Mobile payment number unlinked from this location',
      { variant: 'success' }
    );
  });

  it('does not delete the registry number when unlinking this location fails', async () => {
    renderSection(jest.fn().mockRejectedValue(new Error('nope')));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        "Couldn't remove this Mobile Money number. Please try again.",
        { variant: 'error' }
      )
    );
    expect(mockDeletePhone).not.toHaveBeenCalled();
  });

  it('tells the merchant when linking a Mobile Money number fails', async () => {
    renderSection(jest.fn().mockRejectedValue(new Error('nope')));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /\+237600000000/ }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        "Couldn't update the Mobile Money number. Please try again.",
        { variant: 'error' }
      )
    );
  });

  it('hides the Mobile Money payout controls on the Stripe rail', () => {
    const actions: LocationSectionActions = {
      location: location(),
      locations: [location()],
      isStripeRail: true,
      railLoading: false,
      isOwnBusiness: true,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      onManageItems: jest.fn(),
    };
    render(
      <MemoryRouter>
        <GettingPaidSection {...actions} />
      </MemoryRouter>
    );
    expect(screen.getByText('Getting paid')).toBeInTheDocument();
    expect(screen.queryByText('Mobile Money number')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Send my money to this number automatically')
    ).not.toBeInTheDocument();
  });
});
