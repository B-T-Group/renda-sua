import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import LocationModal from './LocationModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('../../hooks/useIsStripeRail', () => ({
  useIsStripeRail: () => ({ isStripeRail: false, loading: false }),
}));

jest.mock('../../hooks/useMobilePaymentPhones', () => ({
  useMobilePaymentPhones: () => ({ phones: [], fetchPhones: jest.fn() }),
}));

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: { addresses: [] } }),
}));

jest.mock('../dialogs/AddressDialog', () => () => null);
jest.mock('../dialogs/MobilePaymentPhoneVerifyModal', () => ({
  MobilePaymentPhoneVerifyModal: () => null,
}));

describe('LocationModal', () => {
  it('offers pickup point, not showroom, and requires a name', async () => {
    const onSave = jest.fn();
    render(
      <LocationModal open onClose={jest.fn()} onSave={onSave} />
    );
    fireEvent.mouseDown(screen.getByLabelText('Kind of place'));
    expect(screen.queryByRole('option', { name: 'Showroom' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pickup point' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
