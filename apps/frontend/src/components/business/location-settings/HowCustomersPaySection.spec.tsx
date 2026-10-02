import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import HowCustomersPaySection from './HowCustomersPaySection';
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

function location(overrides: Partial<BusinessLocation> = {}): BusinessLocation {
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
    pay_at_confirm: false,
    ...overrides,
  };
}

function props(
  overrides: Partial<LocationSectionActions> = {}
): LocationSectionActions {
  return {
    location: location(),
    locations: [location()],
    isStripeRail: false,
    railLoading: false,
    isOwnBusiness: true,
    updateLocation: jest.fn().mockResolvedValue({}),
    deleteLocation: jest.fn(),
    onManageItems: jest.fn(),
    ...overrides,
  };
}

describe('HowCustomersPaySection', () => {
  it('is hidden on the Stripe rail, while loading, and stays visible for a MoMo owner', () => {
    const { rerender } = render(
      <HowCustomersPaySection {...props({ isStripeRail: true })} />
    );
    expect(screen.queryByText('How customers pay')).not.toBeInTheDocument();

    rerender(<HowCustomersPaySection {...props({ railLoading: true })} />);
    expect(screen.queryByText('How customers pay')).not.toBeInTheDocument();

    rerender(<HowCustomersPaySection {...props()} />);
    expect(screen.getByText('How customers pay')).toBeInTheDocument();
  });

  it('confirms before sending pay_at_confirm', async () => {
    const updateLocation = jest.fn().mockResolvedValue({});
    render(<HowCustomersPaySection {...props({ updateLocation })} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ask customers to pay after you confirm' }));
    expect(updateLocation).not.toHaveBeenCalled();
    expect(screen.getAllByText(/45 minutes/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith('loc-1', { pay_at_confirm: true })
    );
  });

  it('shows the owner-only sentence on a 403', async () => {
    const updateLocation = jest.fn().mockRejectedValue({ response: { status: 403 } });
    render(
      <HowCustomersPaySection
        {...props({ updateLocation, location: location({ pay_at_confirm: true }) })}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ask customers to pay after you confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByText('Only the business owner can change this.')).toBeInTheDocument();
    expect(updateLocation).toHaveBeenCalledWith('loc-1', { pay_at_confirm: false });
  });
});
