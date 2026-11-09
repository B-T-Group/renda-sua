import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryTimeSlot } from '../types/deliveryWindow';
import {
  buildDayOptionYmDs,
  formatCheckoutEtaRange,
  formatSlotTimeRange,
  formatWindowChoiceLabel,
  pickPreferredSlot,
  ymDsWithBookableSlots,
} from './deliveryWindowUtils';

function slot(over: Partial<DeliveryTimeSlot> = {}): DeliveryTimeSlot {
  return {
    id: 's1',
    slot_name: 'Morning',
    slot_type: 'standard',
    start_time: '08:00:00',
    end_time: '12:00:00',
    is_available: true,
    available_capacity: 3,
    ...over,
  };
}

describe('ymDsWithBookableSlots', () => {
  it('keeps only dates that still have a bookable slot', () => {
    expect(
      ymDsWithBookableSlots([
        { date: '2026-11-06', slots: [slot({ is_available: false, available_capacity: 0 })] },
        { date: '2026-11-07', slots: [slot({ id: 's2' }), slot({ id: 's3', is_available: false })] },
        { date: '2026-11-08', slots: [] },
      ])
    ).toEqual(['2026-11-07']);
  });

  it('drops a day whose only slot is marked open but has no capacity left', () => {
    expect(
      ymDsWithBookableSlots([
        { date: '2026-11-07', slots: [slot({ is_available: true, available_capacity: 0 })] },
      ])
    ).toEqual([]);
  });
});

describe('pickPreferredSlot', () => {
  it('prefers a bookable morning over later slots that appear first', () => {
    const evening = slot({ id: 'eve', slot_name: 'Evening', start_time: '16:00:00' });
    const morning = slot({ id: 'mor', slot_name: 'MORNING window' });
    expect(pickPreferredSlot([evening, morning])?.id).toBe('mor');
  });

  it('skips a full morning and a closed afternoon, then takes evening', () => {
    const picked = pickPreferredSlot([
      slot({ id: 'mor', slot_name: 'Morning', available_capacity: 0 }),
      slot({ id: 'aft', slot_name: 'Afternoon', is_available: false }),
      slot({ id: 'eve', slot_name: 'Evening' }),
    ]);
    expect(picked?.id).toBe('eve');
  });

  it('uses any bookable slot when none of the named periods are open', () => {
    expect(
      pickPreferredSlot([
        slot({ id: 'late', slot_name: 'Late night', available_capacity: 0 }),
        slot({ id: 'mid', slot_name: 'Midday rush' }),
      ])?.id
    ).toBe('mid');
  });

  it('returns null when every slot is full or unavailable', () => {
    expect(
      pickPreferredSlot([
        slot({ available_capacity: 0 }),
        slot({ id: 's2', is_available: false }),
      ])
    ).toBeNull();
    expect(pickPreferredSlot([])).toBeNull();
  });
});

describe('buildDayOptionYmDs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a selected day outside the horizon and does not repeat one inside it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 15, 0, 0));
    expect(buildDayOptionYmDs('2026-11-20', 3)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-20',
    ]);
    expect(buildDayOptionYmDs('2026-11-08', 3)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
    ]);
    expect(buildDayOptionYmDs(null, 0)).toEqual([]);
    expect(buildDayOptionYmDs('2026-12-01', 0)).toEqual(['2026-12-01']);
  });
});

describe('formatSlotTimeRange', () => {
  it('shows hours and minutes and hides a range with a missing bound', () => {
    expect(formatSlotTimeRange(slot())).toBe('08:00 – 12:00');
    expect(formatSlotTimeRange(slot({ end_time: '' }))).toBe('');
    expect(formatSlotTimeRange(slot({ start_time: '' }))).toBe('');
  });
});

describe('formatWindowChoiceLabel', () => {
  it('keeps an unparseable date and drops blank extras', () => {
    expect(formatWindowChoiceLabel('not-a-date', ['', '  ', 'Morning'], 'en-US')).toBe(
      'not-a-date · Morning'
    );
  });
});

describe('formatCheckoutEtaRange', () => {
  it('uses one clock when a bound is missing or both clocks match', () => {
    const ready = '2026-11-07T15:07:00.000Z';
    expect(formatCheckoutEtaRange(ready, null)).not.toContain('–');
    expect(formatCheckoutEtaRange(null, ready)).toBe(formatCheckoutEtaRange(ready, null));
    expect(formatCheckoutEtaRange(ready, ready)).toBe(formatCheckoutEtaRange(ready, null));
    expect(formatCheckoutEtaRange('not-a-date', 'also-bad')).toBeNull();
    expect(formatCheckoutEtaRange('not-a-date', ready)).toBe(formatCheckoutEtaRange(ready, null));
  });
});
