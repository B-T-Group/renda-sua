import { describe, expect, it } from 'vitest';
import type { DeliveryTimeSlot } from '../types/deliveryWindow';
import { ymDsWithBookableSlots } from './deliveryWindowUtils';

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
});
