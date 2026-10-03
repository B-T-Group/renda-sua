import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import MoreOptionsSection from './MoreOptionsSection';
import { LocationSectionActions } from './sectionTypes';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('../TransferLocationDialog', () => () => null);

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
  };
}

function renderSection(deleteLocation: LocationSectionActions['deleteLocation']) {
  const actions: LocationSectionActions = {
    location: location(),
    locations: [location()],
    isStripeRail: false,
    railLoading: false,
    isOwnBusiness: true,
    updateLocation: jest.fn(),
    deleteLocation,
    onManageItems: jest.fn(),
  };
  return render(<MoreOptionsSection {...actions} />);
}

describe('MoreOptionsSection', () => {
  it('shows the inventory message when delete is rejected for items', async () => {
    const error = new Error('raw api') as Error & { code?: string };
    error.code = 'LOCATION_HAS_INVENTORY';
    renderSection(jest.fn().mockRejectedValue(error));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(
        'Cannot delete a location that still has items. Remove items from this location first.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it.each([
    [
      'LOCATION_HAS_BALANCE',
      'Cannot delete a location that still has account balance. Withdraw or transfer funds first.',
    ],
    ['ADDRESS_PRIMARY_DELETE_FORBIDDEN', 'Cannot delete primary location'],
    [
      'ADDRESS_MINIMUM_REQUIRED',
      'Cannot delete the only location. Each business must have at least one location.',
    ],
  ])('shows the known message for %s', async (code, message) => {
    const error = new Error('raw api') as Error & { code?: string };
    error.code = code;
    renderSection(jest.fn().mockRejectedValue(error));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows the server message when the delete error has no known code', async () => {
    renderSection(jest.fn().mockRejectedValue(new Error('Account is frozen')));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Account is frozen')).toBeInTheDocument();
  });

  it('uses the generic delete message when the failure is not an Error', async () => {
    renderSection(jest.fn().mockRejectedValue({ code: 500 }));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Failed to delete location')).toBeInTheDocument();
  });
});
