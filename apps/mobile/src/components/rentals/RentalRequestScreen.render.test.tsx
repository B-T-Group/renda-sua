jest.mock('../../hooks/useCreateRentalRequest', () => ({
  useCreateRentalRequest: () => ({ submit: jest.fn(), loading: false, error: null }),
}));

import { NavigationContainer } from '@react-navigation/native';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { allDaySelectionsForRange } from '@/utils/rentals/rentalSearchPreset';
import { defaultWeeklyAvailability } from '@/utils/rentals/defaultWeeklyAvailability';
import { RentalSlotPicker } from './RentalSlotPicker';

const selections = allDaySelectionsForRange(
  { startDate: '2026-11-11', endDate: '2026-11-13', dayCount: 2 },
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
          dateLine="11–13 Nov · 2 days"
          itemName="Echafaudage roulant 4 m"
          itemMeta="DEV demo · 380 FCFA / day"
          onEditDates={() => undefined}
          {...over}
        />
      </ThemeProvider>
    </NavigationContainer>
  );
}

describe('rental request screen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('lands with human days, a day price, and the builder collapsed', async () => {
    const onEditDates = jest.fn();
    const view = await renderRequest({ onEditDates });
    expect(view.getByTestId('rental-request-dates').props.children).toBe('11–13 Nov · 2 days');
    expect(view.getByText('Wed 11 Nov · All day')).toBeTruthy();
    expect(view.getByText('Thu 12 Nov · All day')).toBeTruthy();
    expect(view.getByText('2 days × 380\u00A0FCFA / day')).toBeTruthy();
    expect(view.getAllByText('760\u00A0FCFA').length).toBeGreaterThan(0);
    expect(view.queryByText('FCFA 760')).toBeNull();
    expect(view.queryByText(/billable hours/i)).toBeNull();
    expect(view.queryByText(/2026-11-11/)).toBeNull();
    expect(view.queryByTestId('rental-request-builder')).toBeNull();
    expect(view.getByTestId('rental-request-sticky')).toBeTruthy();
    expect(view.getByText('Nothing is charged until the business accepts.')).toBeTruthy();
    expect(view.getByText('1 of 1 available for your dates')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-edit-dates'));
    });
    expect(onEditDates).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('rental-request-builder')).toBeNull();
  });

  it('highlights the chosen dates when the builder opens, not an unchosen today', async () => {
    const view = await renderRequest();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-add-times'));
    });
    expect(view.getByTestId('rental-request-builder')).toBeTruthy();
    expect(view.getByTestId('rental-request-chip-2026-11-11').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('rental-request-chip-2026-11-12').props.accessibilityState.selected).toBe(true);
    const today = view.queryByTestId('rental-request-chip-2026-11-10');
    if (today) expect(today.props.accessibilityState.selected).toBe(false);
    expect(view.getByTestId('rental-request-sticky')).toBeTruthy();
    expect(view.getByText('Add full day (daily rate)')).toBeTruthy();
  });

  it('uses vous copy and day wording in French', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderRequest({
      dateLine: '11–13 nov. · 2 jours',
      itemMeta: 'DEV demo · 380 FCFA / jour',
    });
    expect(view.getByText('Mer. 11 nov. · Toute la journée')).toBeTruthy();
    expect(view.getByText('Jeu. 12 nov. · Toute la journée')).toBeTruthy();
    expect(view.getByText('Modifier')).toBeTruthy();
    expect(view.getByText('Ajouter ou modifier des horaires')).toBeTruthy();
    expect(view.getByText('2 jours × 380\u00A0FCFA / jour')).toBeTruthy();
    expect(view.getByText('1 sur 1 disponible pour vos dates')).toBeTruthy();
    expect(view.getByPlaceholderText('Notes facultatives pour l’entreprise')).toBeTruthy();
    expect(view.getByText('Envoyer la demande')).toBeTruthy();
    expect(view.getByText('Rien n’est débité tant que l’entreprise n’a pas accepté.')).toBeTruthy();
    expect(view.queryByText(/2026-11-11/)).toBeNull();
    expect(view.queryByText(/heures facturables/i)).toBeNull();
  });

  it('keeps hourly wording for an hourly selection', async () => {
    const start = new Date(2026, 10, 11, 9, 0, 0, 0).getTime();
    const view = await renderRequest({
      initialSelections: [{ id: 'hour', startMs: start, endMs: start + 3 * 3600000, billing: 'hourly' }],
      basePricePerHour: 100,
      basePricePerDay: 0,
    });
    expect(view.getByText('3 h × 100\u00A0FCFA / hour')).toBeTruthy();
    expect(view.getByTestId('rental-request-hours').props.children).toBe('3 billable hours total');
    expect(view.queryByText(/× .* \/ day/)).toBeNull();
  });

  it('keeps the empty-date prompt when no dates are filled', async () => {
    const view = await renderRequest({
      initialSelections: [],
      datesFilled: false,
      dateLine: undefined,
      onEditDates: undefined,
    });
    expect(view.getByTestId('rental-request-choose-dates')).toBeTruthy();
    expect(view.queryByTestId('rental-request-dates')).toBeNull();
    expect(view.queryByTestId('rental-request-builder')).toBeNull();
  });

  it('shows Available from and disables send when the dates are booked', async () => {
    const onSeeDates = jest.fn();
    const view = await renderRequest({
      isAuthenticated: false,
      unavailableLabel: 'Available from Nov 16',
      requestBlocked: true,
      onSeeDates,
    });
    expect(view.getByTestId('rental-request-unavailable').props.children).toBe('Available from Nov 16');
    expect(view.queryByText('760 FCFA')).toBeNull();
    expect(view.queryByText('Sign in to request a rental')).toBeNull();
    expect(view.getByTestId('rental-request-send').props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-see-dates'));
    });
    expect(onSeeDates).toHaveBeenCalledTimes(1);
  });
});
