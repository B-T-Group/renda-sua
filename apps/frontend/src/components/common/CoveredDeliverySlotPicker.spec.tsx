import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import CoveredDeliverySlotPicker from './CoveredDeliverySlotPicker';
import type { DeliveryWindowData } from './DeliveryTimeWindowSelector';

const mockT = (key: string, opts?: string | { defaultValue?: string }) =>
  typeof opts === 'string' ? opts : opts?.defaultValue ?? key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));

const slots = [
  { date: '2026-10-21', slot_id: 'pm', slot_key: 'afternoon', start: '12:00', end: '16:00', pickup_time: '12:30' },
  { date: '2026-10-22', slot_id: 'am', slot_key: 'morning', start: '08:00', end: '12:00' },
];

function Harness({ onChange }: { onChange: (v: DeliveryWindowData | null) => void }) {
  const [value, setValue] = useState<DeliveryWindowData | null>(null);
  return (
    <CoveredDeliverySlotPicker
      slots={slots}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('CoveredDeliverySlotPicker', () => {
  it('shows the scheduled-only notice and only the covered slots', () => {
    render(<Harness onChange={jest.fn()} />);
    expect(screen.getByText(/Scheduled delivery only for this store right now/)).toBeTruthy();
    expect(screen.getByText('12:00 - 16:00')).toBeTruthy();
    expect(screen.getByText('08:00 - 12:00')).toBeTruthy();
    expect(screen.getByText('Picked up from the store at 12:30')).toBeTruthy();
    expect(screen.getAllByTestId(/^covered-slot-/)).toHaveLength(2);
  });

  it('defaults to the earliest covered slot and lets the shopper pick another', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith({ slot_id: 'pm', preferred_date: '2026-10-21' });
    fireEvent.click(screen.getByText('08:00 - 12:00'));
    expect(onChange).toHaveBeenLastCalledWith({ slot_id: 'am', preferred_date: '2026-10-22' });
    expect(
      screen.getByTestId('covered-slot-2026-10-22-am').getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('replaces a window that is not covered', () => {
    const onChange = jest.fn();
    render(
      <CoveredDeliverySlotPicker
        slots={slots}
        value={{ slot_id: 'pm', preferred_date: '2026-10-25' }}
        onChange={onChange}
      />
    );
    expect(onChange).toHaveBeenCalledWith({ slot_id: 'pm', preferred_date: '2026-10-21' });
  });
});
