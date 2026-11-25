import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { RentalDayHoursDialog } from './RentalDayHoursDialog';
import type { DayHoursListing } from '../../../utils/rentalDayHoursPicker';

const weekly = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: weekday !== 0,
  start_time: '08:00:00',
  end_time: '18:00:00',
}));

const listing: DayHoursListing = {
  weekly,
  booked: [{ startAt: '2026-11-28T13:00:00Z', endAt: '2026-11-28T16:00:00Z', unitsBooked: 1 }],
  units: 1,
  offersDaily: true,
  offersHourly: true,
  minHours: 2,
  maxHours: null,
  dayRate: 27000,
  hourRate: 3000,
};

// Wed 25 Nov 2026, 10:20 in Libreville (UTC+1).
const NOW = Date.UTC(2026, 10, 25, 9, 20);

function renderDialog(onContinue = jest.fn(), serverError?: string) {
  render(
    <ThemeProvider theme={createTheme()}>
      <RentalDayHoursDialog
        open
        listing={listing}
        currency="XAF"
        language="en"
        timeZone="Africa/Libreville"
        city="Libreville"
        nowMs={NOW}
        onClose={jest.fn()}
        onContinue={onContinue}
        serverError={serverError}
      />
    </ThemeProvider>
  );
  return onContinue;
}

describe('RentalDayHoursDialog', () => {
  it('adds a full day by default and totals it', () => {
    const onContinue = renderDialog();
    expect(screen.getByTestId('day-hours-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('day-hours-day-2026-11-27'));
    expect(screen.getByTestId('day-hours-total').textContent).toBe('27\u00A0000\u00A0FCFA');
    fireEvent.click(screen.getByTestId('day-hours-continue'));
    const [rows] = onContinue.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].billing).toBe('all_day');
  });

  it('switches a partly booked day to hours and blocks non-adjacent days', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('day-hours-day-2026-11-28'));
    expect(screen.getByTestId('day-hours-row-2026-11-28-bar')).toBeTruthy();
    expect(screen.getByTestId('day-hours-row-2026-11-28-lock')).toBeTruthy();
    expect(screen.getByTestId('day-hours-total').textContent).toBe('6\u00A0000\u00A0FCFA');
    fireEvent.click(screen.getByTestId('day-hours-day-2026-11-28'));
    fireEvent.click(screen.getByTestId('day-hours-day-2026-11-27'));
    fireEvent.click(screen.getByTestId('day-hours-day-2026-11-30'));
    expect(screen.getByTestId('day-hours-banner').textContent).toContain('Pick days in a row');
  });

  it('shows a server refusal inside the dialog', () => {
    renderDialog(jest.fn(), 'That start is now less than 2\u00A0h away. Pick a later time.');
    expect(screen.getByTestId('day-hours-server-error').textContent).toBe('That start is now less than 2\u00A0h away. Pick a later time.');
  });
});
