/** Reservation success screen: what's next copy and the two exits. */
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import RentalReservedScreen from '../RentalReservedScreen';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, setOptions: jest.fn() }),
  useRoute: () => ({ params: { bookingId: 'b1' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../hooks/useRentalBookingDetail', () => ({
  useRentalBookingDetail: () => ({
    loading: false,
    booking: {
      id: 'b1',
      status: 'reserved',
      start_at: '2026-11-28T14:00:00Z',
      end_at: '2026-11-28T18:00:00Z',
      currency: 'CAD',
      total_amount: 60,
      security_deposit_amount: 180,
      inspection_policy_version: 1,
      rental_location_listing: {
        rental_item: { name: 'JBL PartyBox 310' },
        business_location: { name: 'Sono Akwa', address: { country: 'CA' } },
      },
    },
  }),
}));

const render = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => jest.clearAllMocks());

describe('RentalReservedScreen', () => {
  it('says what happens next at rental time', async () => {
    await render(<RentalReservedScreen />);
    expect(screen.getByText('You’re reserved')).toBeTruthy();
    expect(screen.getByText('JBL PartyBox 310')).toBeTruthy();
    expect(screen.getByText('At Sat 28 Nov · 2:00–6:00 PM, go to Sono Akwa to collect it.')).toBeTruthy();
    expect(
      screen.getByText(
        'At pickup, inspect the item. If everything looks good, pay $60.00 in the app and take it. A $180.00 deposit is also held on your card.'
      )
    ).toBeTruthy();
  });

  it('opens the rental or the My rentals hub', async () => {
    await render(<RentalReservedScreen />);
    await fireEvent.press(screen.getByTestId('reserved-view-rental'));
    expect(mockReplace).toHaveBeenCalledWith('RentalBookingDetail', { bookingId: 'b1' });
    await fireEvent.press(screen.getByTestId('reserved-go-dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('ClientMyRentals', { segment: 'upcoming' });
  });
});
