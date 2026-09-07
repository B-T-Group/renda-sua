import { describe, expect, it } from 'vitest';
import type { IncomingOrderDetails } from '../types/incomingOrder';
import {
  deliverySlotEnd,
  isActionableDeliverySlotPast,
  isDeliverySlotPast,
} from './isDeliverySlotPast';

function details(
  window: IncomingOrderDetails['delivery_time_windows']
): IncomingOrderDetails {
  return { delivery_time_windows: window } as IncomingOrderDetails;
}

describe('isDeliverySlotPast', () => {
  const now = new Date(2026, 7, 24, 13, 0, 0);

  it('returns false for ASAP / shipping with no preferred date', () => {
    expect(isDeliverySlotPast(details([]), now)).toBe(false);
    expect(isDeliverySlotPast(details(undefined), now)).toBe(false);
    expect(isDeliverySlotPast(null, now)).toBe(false);
  });

  it('returns false for a future window', () => {
    expect(
      isDeliverySlotPast(
        details([
          {
            id: 'w1',
            preferred_date: '2026-08-25',
            time_slot_start: '08:00',
            time_slot_end: '12:00',
          },
        ]),
        now
      )
    ).toBe(false);
  });

  it('returns false while still inside today’s window', () => {
    expect(
      isDeliverySlotPast(
        details([
          {
            id: 'w1',
            preferred_date: '2026-08-24',
            time_slot_start: '08:00',
            time_slot_end: '14:00',
          },
        ]),
        now
      )
    ).toBe(false);
  });

  it('returns true after the slot ended today', () => {
    expect(
      isDeliverySlotPast(
        details([
          {
            id: 'w1',
            preferred_date: '2026-08-24',
            time_slot_start: '08:00',
            time_slot_end: '12:00',
          },
        ]),
        now
      )
    ).toBe(true);
  });

  it('returns true for a previous calendar date', () => {
    expect(
      isDeliverySlotPast(
        details([
          {
            id: 'w1',
            preferred_date: '2026-07-01',
            time_slot_start: '08:00',
            time_slot_end: '12:00',
          },
        ]),
        now
      )
    ).toBe(true);
  });

  it('uses start time when end is missing', () => {
    expect(
      isDeliverySlotPast(
        details([
          {
            id: 'w1',
            preferred_date: '2026-08-24',
            time_slot_start: '12:00',
          },
        ]),
        now
      )
    ).toBe(true);
  });

  it('uses end of the calendar day when times are missing', () => {
    expect(
      isDeliverySlotPast(
        details([{ id: 'w1', preferred_date: '2026-08-24' }]),
        now
      )
    ).toBe(false);
    expect(
      isDeliverySlotPast(
        details([{ id: 'w1', preferred_date: '2026-08-24' }]),
        new Date(2026, 7, 24, 23, 59, 59, 999)
      )
    ).toBe(false);
    expect(
      isDeliverySlotPast(
        details([{ id: 'w1', preferred_date: '2026-08-24' }]),
        new Date(2026, 7, 25, 0, 0, 0)
      )
    ).toBe(true);
  });
});

describe('isActionableDeliverySlotPast', () => {
  const now = new Date(2026, 7, 24, 13, 0, 0);
  const past = details([
    {
      id: 'w1',
      preferred_date: '2026-07-01',
      time_slot_start: '08:00',
      time_slot_end: '12:00',
    },
  ]);

  it('ignores past windows until the order is actionable', () => {
    expect(isActionableDeliverySlotPast(past, 'loading', now)).toBe(false);
    expect(isActionableDeliverySlotPast(past, 'error', now)).toBe(false);
    expect(isActionableDeliverySlotPast(past, 'resolved', now)).toBe(false);
  });

  it('applies past-slot lock once the order is active', () => {
    expect(isActionableDeliverySlotPast(past, 'active', now)).toBe(true);
    expect(isActionableDeliverySlotPast(past, 'busy', now)).toBe(true);
    expect(isActionableDeliverySlotPast(past, 'confirming', now)).toBe(true);
  });
});

describe('deliverySlotEnd', () => {
  it('returns local end datetime for a scheduled window', () => {
    const end = deliverySlotEnd(
      details([
        {
          id: 'w1',
          preferred_date: '2026-08-24',
          time_slot_start: '08:00',
          time_slot_end: '12:00',
        },
      ])
    );
    expect(end).toEqual(new Date(2026, 7, 24, 12, 0, 0, 0));
  });

  it('returns null when there is no preferred date', () => {
    expect(deliverySlotEnd(details([]))).toBeNull();
  });
});
