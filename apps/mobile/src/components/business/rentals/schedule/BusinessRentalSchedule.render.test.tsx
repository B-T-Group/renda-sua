import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { rentalsApi } from '@/services/rentalsApi';
import type { BusinessRentalScheduleRow } from '@/types/rentals';
import { BusinessRentalScheduleCard } from './BusinessRentalScheduleCard';
import { BusinessRentalScheduleTab } from './BusinessRentalScheduleTab';

jest.mock('@/components/common/AppButton', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    AppButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/services/rentalsApi', () => ({
  rentalsApi: { getBusinessSchedule: jest.fn() },
}));

const getSchedule = rentalsApi.getBusinessSchedule as jest.Mock;

function at(dayOffset: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function booking(id: string, itemName: string, dayOffset: number): BusinessRentalScheduleRow {
  return {
    id,
    status: 'active',
    start_at: at(dayOffset, 8),
    end_at: at(dayOffset, 10),
    total_amount: 40,
    currency: 'CAD',
    rental_location_listing: { id: 'l', rental_item: { id: itemName, name: itemName } },
    rental_request: {
      id: 'r',
      created_at: at(0, 0),
      client: { id: 'c', user: { first_name: 'MM', last_name: 'Test' } },
    },
  };
}

const ITEMS = [
  { id: 'jbl', name: 'JBL PartyBox 310' },
  { id: 'tent', name: 'Party Tent' },
];

function renderTab(items = ITEMS, onOpenBooking = jest.fn()) {
  return renderWithProviders(
    <ThemeProvider>
      <BusinessRentalScheduleTab items={items} contentBottomPadding={24} onOpenBooking={onOpenBooking} />
    </ThemeProvider>
  );
}

describe('BusinessRentalScheduleCard', () => {
  afterEach(cleanup);

  it('shows renter, item, date lines, duration and price, and opens the booking', async () => {
    const onPress = jest.fn();
    const screen = await renderWithProviders(
      <ThemeProvider>
        <BusinessRentalScheduleCard row={booking('b1', 'JBL PartyBox 310', 0)} showItemName onPress={onPress} />
      </ThemeProvider>
    );
    expect(screen.getByText('MM Test')).toBeTruthy();
    expect(screen.getByText('JBL PartyBox 310')).toBeTruthy();
    expect(screen.getByText(/· 2 h$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith('b1');
  });

  it('hides the item name when a single item is shown', async () => {
    const screen = await renderWithProviders(
      <ThemeProvider>
        <BusinessRentalScheduleCard row={booking('b1', 'JBL PartyBox 310', 0)} onPress={jest.fn()} />
      </ThemeProvider>
    );
    expect(screen.queryByText('JBL PartyBox 310')).toBeNull();
  });
});

describe('BusinessRentalScheduleTab', () => {
  beforeEach(() => getSchedule.mockReset());
  afterEach(cleanup);

  it('groups bookings under Today and Upcoming across all items', async () => {
    getSchedule.mockImplementation(async (id: string) =>
      id === 'jbl' ? [booking('b1', 'JBL PartyBox 310', 0)] : [booking('b2', 'Party Tent', 3)]
    );
    const screen = await renderTab();
    await waitFor(() => expect(screen.getByText('Today')).toBeTruthy());
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(getSchedule).toHaveBeenCalledTimes(2);
  });

  it('filters to one item and offers Show all from the empty state', async () => {
    getSchedule.mockImplementation(async (id: string) => (id === 'jbl' ? [booking('b1', 'JBL PartyBox 310', 0)] : []));
    const screen = await renderTab();
    await waitFor(() => expect(screen.getByText('Today')).toBeTruthy());
    await fireEvent.press(screen.getByText('Party Tent'));
    await waitFor(() => expect(screen.getByText('Nothing scheduled')).toBeTruthy());
    expect(screen.getByLabelText('Empty calendar')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show all items'));
    await waitFor(() => expect(screen.getByText('Today')).toBeTruthy());
  });

  it('shows the catalog hint when there are no rental items', async () => {
    const screen = await renderTab([]);
    await waitFor(() => expect(screen.getByText('No rental items yet')).toBeTruthy());
    expect(getSchedule).not.toHaveBeenCalled();
  });

  it('shows a retry action when loading fails', async () => {
    getSchedule.mockRejectedValue(new Error('boom'));
    const screen = await renderTab();
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
