const mockSubmit = jest.fn();
jest.mock('../../hooks/useCreateRentalRequest', () => ({
  useCreateRentalRequest: () => ({ submit: mockSubmit, loading: false, error: null }),
}));

jest.mock('../../services/analytics/AppEventsService', () => ({
  trackSiteEvent: jest.fn(),
}));

import { NavigationContainer } from '@react-navigation/native';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { allDaySelectionsForRange } from '@/utils/rentals/rentalSearchPreset';
import { defaultWeeklyAvailability } from '@/utils/rentals/defaultWeeklyAvailability';
import { RentalSlotPicker } from './RentalSlotPicker';
import { RentalDayHoursSheet } from './dayHours/RentalDayHoursSheet';

const LEAD_EN = 'That start is now less than 2\u00A0h away. Pick a later time.';
const selections = allDaySelectionsForRange(
  { startDate: '2027-03-10', endDate: '2027-03-12', dayCount: 2 },
  [],
  380
);

function renderRequest(over: Record<string, unknown> = {}) {
  return renderWithProviders(
    <NavigationContainer>
      <ThemeProvider>
        <RentalSlotPicker
          layout="screen"
          listingId="listing-1"
          isAuthenticated
          bookedWindows={[]}
          basePricePerDay={380}
          basePricePerHour={40}
          currency="XAF"
          weeklyAvailability={defaultWeeklyAvailability()}
          initialSelections={selections}
          datesFilled
          dayHoursPicker
          dateLine="Wed 10 Mar – Thu 11 Mar · 2 days · Full days"
          itemName="Echafaudage roulant 4 m"
          itemMeta="DEV demo · 380 FCFA / day"
          onEditDates={() => undefined}
          {...over}
        />
      </ThemeProvider>
    </NavigationContainer>
  );
}

describe('day-and-hours submit refused by the server', () => {
  beforeEach(async () => {
    mockSubmit.mockReset();
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('hands the rule text to the picker instead of showing it behind', async () => {
    mockSubmit.mockRejectedValue({ response: { status: 400, data: { code: 'RENTAL_LEAD_TIME', message: 'lead' } } });
    const onServerRuleError = jest.fn();
    const onEditDates = jest.fn();
    const view = await renderRequest({ onServerRuleError, onEditDates });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-send'));
    });
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(onServerRuleError).toHaveBeenCalledWith(LEAD_EN);
    expect(onEditDates).not.toHaveBeenCalled();
    expect(view.queryByText(LEAD_EN)).toBeNull();
  });

  it('shows the reason in French inside the reopened sheet', async () => {
    const view = await renderWithProviders(
      <ThemeProvider>
        <RentalDayHoursSheet
          visible
          presentation="inline"
          listing={{ weekly: defaultWeeklyAvailability(), booked: [], units: 1, offersDaily: true, offersHourly: true, minHours: 2, maxHours: null, dayRate: 27000, hourRate: 3000 }}
          currency="XAF"
          language="fr"
          timeZone="Africa/Libreville"
          city="Libreville"
          nowMs={Date.UTC(2026, 10, 25, 9, 20)}
          serverError={'Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.'}
          onClose={() => undefined}
          onContinue={() => undefined}
        />
      </ThemeProvider>
    );
    expect(view.getByTestId('day-hours-server-error')).toBeTruthy();
    expect(view.getByText('Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.')).toBeTruthy();
  });
});
