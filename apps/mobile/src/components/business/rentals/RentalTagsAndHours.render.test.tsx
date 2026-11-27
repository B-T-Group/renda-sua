import { useState } from 'react';
import { cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { RentalWeeklyAvailabilityRow } from '@/types/rentals';
import { RentalTagsInput } from './RentalTagsInput';
import { RentalWeeklyHoursEditor } from './RentalWeeklyHoursEditor';

function TagsHarness({ initial }: { initial: string[] }) {
  const [tags, setTags] = useState(initial);
  return <RentalTagsInput value={tags} onChange={setTags} />;
}

const openDay = (weekday: number, start: string, end: string): RentalWeeklyAvailabilityRow => ({
  weekday,
  is_available: true,
  start_time: start,
  end_time: end,
});

function HoursHarness({ onRows }: { onRows: (rows: RentalWeeklyAvailabilityRow[]) => void }) {
  const [rows, setRows] = useState<RentalWeeklyAvailabilityRow[]>([
    { weekday: 0, is_available: false, start_time: null, end_time: null },
    openDay(1, '09:00:00', '17:00:00'),
    openDay(2, '08:00:00', '20:00:00'),
  ]);
  return (
    <RentalWeeklyHoursEditor
      value={rows}
      onChange={(next) => {
        setRows(next);
        onRows(next);
      }}
    />
  );
}

describe('RentalTagsInput', () => {
  afterEach(cleanup);

  it('shows existing tags as chips and removes one', async () => {
    const screen = await renderWithProviders(
      <ThemeProvider>
        <TagsHarness initial={['jbl', 'partybox']} />
      </ThemeProvider>
    );
    expect(screen.getByText('jbl')).toBeTruthy();
    expect(screen.getByText('partybox')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText(/Remove/)[0]);
    expect(screen.queryByText('jbl')).toBeNull();
    expect(screen.getByText('partybox')).toBeTruthy();
  });

  it('turns typed text into a chip on enter and on comma', async () => {
    const screen = await renderWithProviders(
      <ThemeProvider>
        <TagsHarness initial={[]} />
      </ThemeProvider>
    );
    const field = screen.getByTestId('rental-tags-input-field');
    await fireEvent.changeText(field, 'speaker');
    await fireEvent(field, 'submitEditing');
    await fireEvent.changeText(field, 'outdoor,');
    expect(screen.getByText('speaker')).toBeTruthy();
    expect(screen.getByText('outdoor')).toBeTruthy();
  });
});

describe('RentalWeeklyHoursEditor', () => {
  afterEach(cleanup);

  it('copies the first open day hours to the other open days', async () => {
    const onRows = jest.fn();
    const screen = await renderWithProviders(
      <ThemeProvider>
        <HoursHarness onRows={onRows} />
      </ThemeProvider>
    );
    await fireEvent.press(screen.getByTestId('weekly-hours-copy-all'));
    const rows = onRows.mock.calls[0][0] as RentalWeeklyAvailabilityRow[];
    expect(rows[2].start_time).toBe('09:00:00');
    expect(rows[2].end_time).toBe('17:00:00');
    expect(rows[0].is_available).toBe(false);
  });

  it('closing a day clears its times and hides the fields', async () => {
    const onRows = jest.fn();
    const screen = await renderWithProviders(
      <ThemeProvider>
        <HoursHarness onRows={onRows} />
      </ThemeProvider>
    );
    await fireEvent(screen.getByTestId('weekly-hours-switch-2'), 'valueChange', false);
    expect(screen.queryByTestId('weekly-hours-start-2')).toBeNull();
    expect(onRows.mock.calls[0][0][2].start_time).toBeNull();
  });
});
