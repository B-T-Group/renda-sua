/** Early return (AC5/AC6): business confirm sheet reads and corrects the return time on the listing clock. */
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import i18n from '../../../i18n';
import { BusinessReturnConfirmSheet } from '../BusinessEarlyReturn';
import type { EarlyReturnBooking } from '../../../utils/rentals/earlyReturn';

const NOW = Date.parse('2026-11-26T20:45:00.000Z'); // 3:45 PM in Toronto
const booking: EarlyReturnBooking = {
  status: 'active',
  start_at: '2026-11-26T14:00:00Z',
  end_at: '2026-11-26T18:00:00Z',
  actual_start_at: '2026-11-26T19:05:00.000Z',
  renter_reported_returned_at: '2026-11-26T20:40:00.000Z',
};

function renderSheet(onConfirm: (iso: string) => void, overrides: Partial<React.ComponentProps<typeof BusinessReturnConfirmSheet>> = {}) {
  return renderWithProviders(
    <ThemeProvider>
      <BusinessReturnConfirmSheet
        open
        booking={booking}
        timeZone="America/Toronto"
        zoneLabel="Toronto time"
        price="$60.00"
        deposit="$160.00"
        now={NOW}
        onClose={() => undefined}
        onConfirm={onConfirm}
        {...overrides}
      />
    </ThemeProvider>
  );
}

describe('BusinessReturnConfirmSheet', () => {
  afterEach(() => void i18n.changeLanguage('en'));

  it('defaults to the renter report and confirms that instant', async () => {
    const onConfirm = jest.fn();
    await renderSheet(onConfirm);
    expect(screen.getAllByText('3:40\u00a0PM').length).toBeGreaterThanOrEqual(1);
    await fireEvent.press(screen.getByTestId('business-return-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('2026-11-26T20:40:00.000Z');
  });

  it('corrects the time on the listing clock', async () => {
    const onConfirm = jest.fn();
    await renderSheet(onConfirm, { initialEditing: true });
    await fireEvent.changeText(screen.getByDisplayValue('3:40 PM'), '3:20 PM');
    await fireEvent.press(screen.getByTestId('business-return-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('2026-11-26T20:20:00.000Z');
  });

  it('blocks a time before pickup', async () => {
    const onConfirm = jest.fn();
    await renderSheet(onConfirm, { initialEditing: true });
    await fireEvent.changeText(screen.getByDisplayValue('3:40 PM'), '1:00 PM');
    expect(screen.getByText('The return can’t be before pickup.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('business-return-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
