jest.mock('../../hooks/useCreateRentalRequest', () => ({
  useCreateRentalRequest: () => ({ submit: jest.fn(), loading: false, error: null }),
}));

import { NavigationContainer } from '@react-navigation/native';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { allDaySelectionsForRange } from '@/utils/rentals/rentalSearchPreset';
import { RentalSlotPicker } from './RentalSlotPicker';

const selections = allDaySelectionsForRange(
  { startDate: '2026-12-15', endDate: '2026-12-17', dayCount: 2 },
  [],
  380
);
const saved = selections.map((row) => ({ ...row, id: `${row.id}-saved`, startMs: row.startMs + 1000 }));

function priceError() {
  const error = new Error('The quoted total went up.') as Error & {
    code?: string;
    data?: unknown;
  };
  error.code = 'PRICE_CONFIRM_REQUIRED';
  error.data = { quote: { total: 1200, currency: 'XAF', previousTotal: 760 } };
  return error;
}

function renderModify(onModifySave: jest.Mock) {
  return renderWithProviders(
    <NavigationContainer>
      <ThemeProvider>
        <RentalSlotPicker
          layout="screen"
          submitMode="modify"
          listingId="listing-1"
          isAuthenticated
          bookedWindows={[]}
          basePricePerDay={380}
          basePricePerHour={40}
          currency="XAF"
          initialSelections={selections}
          savedSelections={saved}
          previousTotal={760}
          datesFilled
          dateLine="15–17 Dec · 2 days"
          itemName="Echafaudage roulant 4 m"
          onModifySave={onModifySave}
        />
      </ThemeProvider>
    </NavigationContainer>
  );
}

describe('modify price confirm from the server', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('opens the confirm sheet on 409 and retries with the server total', async () => {
    const onModifySave = jest.fn()
      .mockRejectedValueOnce(priceError())
      .mockResolvedValueOnce(undefined);
    const view = await renderModify(onModifySave);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-send'));
    });
    expect(onModifySave).toHaveBeenCalledTimes(1);
    expect(onModifySave.mock.calls[0][0].confirmedTotal).toBeUndefined();
    expect(view.getByText('Update your request?')).toBeTruthy();
    expect(view.getByText('1 200 FCFA')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-modify-confirm-save'));
    });
    expect(onModifySave).toHaveBeenCalledTimes(2);
    expect(onModifySave.mock.calls[1][0].confirmedTotal).toEqual({ amount: 1200, currency: 'XAF' });
  });

  it('leaves the request unchanged when the renter cancels the server quote', async () => {
    const onModifySave = jest.fn().mockRejectedValue(priceError());
    const view = await renderModify(onModifySave);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-request-send'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-modify-confirm-keep'));
    });
    expect(onModifySave).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('rental-modify-confirm-save')).toBeNull();
  });
});
