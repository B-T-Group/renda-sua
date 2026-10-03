import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import OpenClosedSection from './OpenClosedSection';
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

const hours = {
  monday: { open: '08:00', close: '20:00' },
  tuesday: { open: '08:00', close: '20:00' },
  wednesday: { open: '08:00', close: '20:00' },
  thursday: { open: '08:00', close: '20:00' },
  friday: { open: '08:00', close: '20:00' },
  saturday: { closed: true as const },
  sunday: { closed: true as const },
};

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
    is_primary: true,
    location_type: 'store',
    created_at: '',
    updated_at: '',
    operating_hours: hours,
  };
}

function renderSection(
  updateLocation: LocationSectionActions['updateLocation'] = jest.fn()
) {
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
  return render(<OpenClosedSection {...actions} />);
}

describe('OpenClosedSection', () => {
  it('asks before hiding the location', () => {
    const updateLocation = jest.fn();
    renderSection(updateLocation);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Show this location to customers' })
    );
    expect(updateLocation).not.toHaveBeenCalled();
    expect(screen.getByText('Hide this location?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide it' }));
    expect(updateLocation).toHaveBeenCalledWith('loc-1', { is_active: false });
  });

  it('keeps Save hours disabled until the hours change', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      (screen.getByRole('button', { name: 'Save hours' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('turns the switch on when the location becomes visible elsewhere', () => {
    const hidden = { ...location(), is_active: false };
    const actions: LocationSectionActions = {
      location: hidden,
      locations: [hidden],
      isStripeRail: false,
      railLoading: false,
      isOwnBusiness: true,
      updateLocation: jest.fn(),
      deleteLocation: jest.fn(),
      onManageItems: jest.fn(),
    };
    const { rerender } = render(<OpenClosedSection {...actions} />);
    const toggle = screen.getByRole('checkbox', {
      name: 'Show this location to customers',
    });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    rerender(
      <OpenClosedSection {...actions} location={{ ...hidden, is_active: true }} />
    );
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Show this location to customers',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it('keeps the hours section open when saving fails', async () => {
    const updateLocation = jest.fn().mockRejectedValue(new Error('nope'));
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const monday = screen.getAllByDisplayValue('08:00')[0];
    fireEvent.change(monday, { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(
      await screen.findByText("Couldn't save your opening hours. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save hours' })).toBeInTheDocument();
  });

  it('keeps the editor open when closing time is not after opening time', () => {
    const updateLocation = jest.fn();
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getAllByDisplayValue('20:00')[0], {
      target: { value: '07:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(
      screen.getByText('Closing time must be after opening time.')
    ).toBeInTheDocument();
    expect(updateLocation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save hours' })).toBeInTheDocument();
  });
});
