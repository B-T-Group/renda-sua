jest.mock('../../hooks/useCreateRentalRequest', () => ({
  useCreateRentalRequest: () => ({ submit: jest.fn(), loading: false, error: null }),
}));

import { NavigationContainer } from '@react-navigation/native';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { formatRangeDates, type RentalDateRange } from '@/utils/rentals/rentalSearchDates';
import { RentalRequestSheet } from './RentalRequestSheet';

const range: RentalDateRange = { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 };

function dateLine(): string {
  return i18n.t('rentals.searchFirst.sheetDateLine', {
    range: formatRangeDates(range, i18n.language),
    days: i18n.t('rentals.searchFirst.dayCount', { count: range.dayCount }),
  });
}

function renderSheet(over: Record<string, unknown> = {}) {
  return renderWithProviders(
    <NavigationContainer>
      <ThemeProvider>
        <RentalRequestSheet
          visible
          onDismiss={() => undefined}
          listingId="listing-1"
          listingName="Echafaudage roulant 4 m (DEV demo)"
          isAuthenticated={false}
          bookedWindows={[]}
          {...over}
        />
      </ThemeProvider>
    </NavigationContainer>
  );
}

describe('rental request sheet dates', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('shows the filled dates and Edit, and hides the empty-date prompt', async () => {
    const onEditDates = jest.fn();
    const view = await renderSheet({
      dateLine: dateLine(),
      onEditDates,
      datesFilled: true,
      quoteLabel: 'Total · FCFA 800',
    });
    expect(view.getByTestId('rental-request-dates').props.children).toBe('14–16 Nov · 2 days');
    expect(view.getByText('Total · FCFA 800')).toBeTruthy();
    expect(view.queryByTestId('rental-request-choose-dates')).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-edit-dates'));
    });
    expect(onEditDates).toHaveBeenCalledTimes(1);
  });

  it('writes the same line in formal French', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSheet({
      dateLine: dateLine(),
      onEditDates: () => undefined,
      datesFilled: true,
    });
    expect(view.getByTestId('rental-request-dates').props.children).toBe('14–16 nov. · 2 jours');
    expect(view.getByText('Modifier')).toBeTruthy();
  });

  it('keeps the empty-date prompt when no dates are filled', async () => {
    const view = await renderSheet();
    expect(view.getByTestId('rental-request-choose-dates')).toBeTruthy();
    expect(view.queryByTestId('rental-request-dates')).toBeNull();
  });

  it('shows Available from and disables the request when the dates are booked', async () => {
    const onSeeDates = jest.fn();
    const view = await renderSheet({
      dateLine: dateLine(),
      onEditDates: () => undefined,
      unavailableLabel: 'Available from Nov 16',
      quoteLabel: 'Total · FCFA 800',
      requestBlocked: true,
      onSeeDates,
    });
    expect(view.getByTestId('rental-request-unavailable').props.children).toBe('Available from Nov 16');
    expect(view.queryByText('Total · FCFA 800')).toBeNull();
    expect(view.queryByText('Sign in to request a rental')).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-see-dates'));
    });
    expect(onSeeDates).toHaveBeenCalledTimes(1);
  });
});
