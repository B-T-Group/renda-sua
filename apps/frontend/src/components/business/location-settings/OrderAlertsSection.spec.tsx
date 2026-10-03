import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import OrderAlertsSection from './OrderAlertsSection';
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

function location(orderAlertPhone?: string): BusinessLocation {
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
    order_alert_phone: orderAlertPhone,
  };
}

function renderSection(
  updateLocation: LocationSectionActions['updateLocation'],
  orderAlertPhone?: string
) {
  const loc = location(orderAlertPhone);
  const actions: LocationSectionActions = {
    location: loc,
    locations: [loc],
    isStripeRail: false,
    railLoading: false,
    isOwnBusiness: true,
    updateLocation,
    deleteLocation: jest.fn(),
    onManageItems: jest.fn(),
  };
  return render(<OrderAlertsSection {...actions} />);
}

describe('OrderAlertsSection', () => {
  it('requires a country code and does not save a local number', () => {
    const updateLocation = jest.fn();
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('+237 …'), {
      target: { value: '677000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save alerts' }));
    expect(
      screen.getByText('Enter the number with its country code.')
    ).toBeInTheDocument();
    expect(updateLocation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save alerts' })).toBeInTheDocument();
  });

  it('clears the alert phone when the field is emptied', async () => {
    const updateLocation = jest.fn().mockResolvedValue({});
    renderSection(updateLocation, '+237611111111');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('+237 …'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save alerts' }));
    await waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith('loc-1', {
        order_alert_phone: null,
      })
    );
  });

  it('keeps the editor open when saving the alert phone fails', async () => {
    const updateLocation = jest.fn().mockRejectedValue(new Error('nope'));
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('+237 …'), {
      target: { value: '+237677000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save alerts' }));
    expect(
      await screen.findByText("Couldn't save the alert phone. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save alerts' })).toBeInTheDocument();
  });
});
