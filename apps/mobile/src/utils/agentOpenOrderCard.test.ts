import {
  agentDropoffFact,
  compactDropoff,
  compareOpenOrdersForAgent,
  formatFullAddress,
  mergeOpenOrderDropoff,
  openOrderNeedsDropoff,
  storeToDropoffKm,
} from './agentOpenOrderCard';
import type { Order } from '../types/agent';

function order(partial: Partial<Order>): Order {
  return {
    id: '1',
    order_number: '1',
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'd',
    tax_amount: 0,
    currency: 'CAD',
    current_status: 'ready_for_pickup',
    requires_fast_delivery: false,
    created_at: '2026-11-06T12:00:00.000Z',
    updated_at: '2026-11-06T12:00:00.000Z',
    client: { id: 'c', user: { id: 'u', first_name: 'A', last_name: 'B' } },
    business: { id: 'b', name: 'Shop', user: { id: 'u2', first_name: 'S', last_name: 'H' } },
    business_location: { id: 'l', name: 'Shop', location_type: 'store', address: {} as Order['business_location']['address'] },
    delivery_address: {} as Order['delivery_address'],
    order_items: [],
    ...partial,
  };
}

describe('agentDropoffFact', () => {
  it('treats explicit asap as deliver now and hides a payload with no timing', () => {
    expect(agentDropoffFact(order({ fulfillment_timing: 'asap' }), 'en')).toEqual({ kind: 'asap' });
    expect(agentDropoffFact(order({}), 'en')).toBeNull();
  });

  it('formats a scheduled slot with date, name, and hours', () => {
    const fact = agentDropoffFact(
      order({
        fulfillment_timing: 'scheduled',
        delivery_time_windows: [
          {
            id: 'w',
            preferred_date: '2026-11-07',
            time_slot_start: '10:00',
            time_slot_end: '12:00',
            slot: { slot_name: 'Morning' },
          },
        ],
      }),
      'en-US'
    );
    expect(fact.kind).toBe('scheduled');
    if (fact.kind !== 'scheduled') return;
    expect(fact.when).toContain('Nov');
    expect(fact.when).toContain('Morning');
  });

  it('keeps a scheduled order scheduled when the window is missing', () => {
    expect(agentDropoffFact(order({ fulfillment_timing: 'scheduled' }), 'en')).toEqual({
      kind: 'scheduled',
      when: null,
    });
    expect(openOrderNeedsDropoff(order({ fulfillment_timing: 'scheduled' }))).toBe(true);
  });

  it('treats a window without a timing field as scheduled, not ASAP', () => {
    const fact = agentDropoffFact(
      order({
        delivery_time_windows: [
          {
            preferred_date: '2026-11-07',
            time_slot_start: '10:00',
            time_slot_end: '12:00',
            slot: { slot_name: 'Morning' },
          },
        ],
      }),
      'en-US'
    );
    expect(fact?.kind).toBe('scheduled');
    expect(openOrderNeedsDropoff(order({
      fulfillment_timing: 'scheduled',
      delivery_time_windows: [
        {
          preferred_date: '2026-11-07',
          time_slot_start: '10:00',
          time_slot_end: '12:00',
          slot: { slot_name: 'Morning' },
        },
      ],
    }))).toBe(false);
  });
});

describe('open order dropoff merge', () => {
  it('asks for detail when the list row has no timing', () => {
    expect(openOrderNeedsDropoff(order({}))).toBe(true);
    expect(openOrderNeedsDropoff(order({ fulfillment_timing: 'asap' }))).toBe(false);
  });

  it('keeps the list window when the detail payload has no windows', () => {
    const merged = mergeOpenOrderDropoff(
      order({
        fulfillment_timing: 'scheduled',
        delivery_time_windows: [
          {
            preferred_date: '2026-11-06',
            time_slot_start: '08:00',
            time_slot_end: '12:00',
            slot: { slot_name: 'Morning' },
          },
        ],
      }),
      { delivery_time_windows: [], fulfillment_timing: undefined }
    );
    const fact = agentDropoffFact(merged, 'en-US');
    expect(fact?.kind).toBe('scheduled');
    if (fact?.kind !== 'scheduled') return;
    expect(fact.when).toContain('Morning');
  });

  it('copies the confirmed window onto the list row', () => {
    const merged = mergeOpenOrderDropoff(order({}), {
      fulfillment_timing: 'scheduled',
      delivery_time_windows: [
        {
          preferred_date: '2026-11-06',
          time_slot_start: '16:00:00',
          time_slot_end: '20:00:00',
          is_confirmed: true,
          slot: { slot_name: 'Evening' },
        },
      ],
    });
    const fact = agentDropoffFact(merged, 'en-US');
    expect(fact?.kind).toBe('scheduled');
    if (fact?.kind !== 'scheduled') return;
    expect(fact.when).toContain('Evening');
  });
});

describe('compactDropoff', () => {
  it('collapses today evening into a short line', () => {
    const compact = compactDropoff(
      order({
        fulfillment_timing: 'scheduled',
        delivery_time_windows: [
          {
            preferred_date: '2026-11-06',
            time_slot_start: '16:00:00',
            time_slot_end: '20:00:00',
            slot: { slot_name: 'Evening' },
          },
        ],
      }),
      'en-US',
      new Date(2026, 10, 6, 16, 30)
    );
    expect(compact).toEqual({
      day: 'today',
      dateLabel: expect.any(String),
      slot: 'Evening',
      range: '4–8 PM',
    });
  });

  it('marks tomorrow and a later date, and does not use the English collapse off-pattern', () => {
    const now = new Date(2026, 10, 6, 16, 30);
    const row = (
      date: string,
      start: string,
      end: string
    ) =>
      order({
        delivery_time_windows: [
          { preferred_date: date, time_slot_start: start, time_slot_end: end, slot: { slot_name: 'Slot' } },
        ],
      });

    expect(compactDropoff(row('2026-11-07', '16:00', '20:00'), 'en-US', now)?.day).toBe('tomorrow');
    expect(compactDropoff(row('2026-11-09', '16:00', '20:00'), 'en-US', now)?.day).toBe('date');
    expect(compactDropoff(row('2026-11-06', '12:00', '16:00'), 'en-US', now)?.range).toBe('12–4 PM');
    expect(compactDropoff(row('2026-11-06', '00:00', '01:00'), 'en-US', now)?.range).toBe('12–1 AM');
    expect(compactDropoff(row('2026-11-06', '08:00', '12:00'), 'en-US', now)?.range).not.toBe('8–12 AM');
    expect(compactDropoff(row('2026-11-06', '16:00', '20:00'), 'fr-CA', now)?.range).not.toBe('4–8 PM');
    expect(compactDropoff(row('2026-11-06', '25:00', '26:00'), 'en-US', now)?.range).not.toMatch(
      /^\d+–\d+ (AM|PM)$/
    );
  });

  it('returns nothing without a window and keeps a slot-only drop-off', () => {
    expect(compactDropoff(order({}), 'en-US')).toBeNull();
    expect(
      compactDropoff(
        order({ delivery_time_windows: [{ slot: { slot_name: '  Evening  ' } }] }),
        'en-US'
      )
    ).toEqual({ day: 'date', dateLabel: null, slot: 'Evening', range: null });
    expect(
      compactDropoff(order({ delivery_time_windows: [{ preferred_date: 'not-a-date' }] }), 'en-US', new Date(2026, 10, 6))
    ).toMatchObject({ day: 'date', dateLabel: 'not-a-date' });
  });
});

describe('formatFullAddress', () => {
  it('joins street, locality, and country without empty parts', () => {
    expect(
      formatFullAddress({
        address_line_1: '3810 Rue Magnan',
        address_line_2: 'Suite 2',
        city: "L'Assomption",
        state: 'QC',
        postal_code: 'J5W 0L1',
        country: 'Canada',
      })
    ).toBe("3810 Rue Magnan, Suite 2, L'Assomption, QC, J5W 0L1, Canada");
  });

  it('returns empty when the address is missing', () => {
    expect(formatFullAddress(null)).toBe('');
    expect(formatFullAddress({})).toBe('');
  });
});

describe('storeToDropoffKm', () => {
  it('returns null when coordinates are incomplete', () => {
    expect(storeToDropoffKm(order({}))).toBeNull();
  });

  it('returns straight-line km between store and drop-off', () => {
    const km = storeToDropoffKm(
      order({
        business_location: {
          id: 'l',
          name: 'Shop',
          location_type: 'store',
          address: {
            id: 'a1',
            address_line_1: 'A',
            city: 'X',
            state: 'Y',
            country: 'CA',
            latitude: 45.5,
            longitude: -73.5,
          },
        },
        delivery_address: {
          id: 'a2',
          address_line_1: 'B',
          city: 'X',
          state: 'Y',
          country: 'CA',
          latitude: 45.51,
          longitude: -73.5,
        },
      })
    );
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(2);
  });
});

describe('compareOpenOrdersForAgent', () => {
  it('puts dedicated stores ahead of express orders', () => {
    const dedicated = order({ id: 'd', my_dedicated_store: true });
    const express = order({ id: 'e', requires_fast_delivery: true });
    expect([express, dedicated].sort(compareOpenOrdersForAgent).map((o) => o.id)).toEqual(['d', 'e']);
  });

  it('treats a known location as dedicated, then express, then the newest update', () => {
    const byLocation = order({
      id: 'loc',
      business_location: {
        id: 'loc-ded',
        name: 'Shop',
        location_type: 'store',
        address: {} as Order['business_location']['address'],
      },
      updated_at: '2026-11-01T00:00:00.000Z',
    });
    const express = order({
      id: 'exp',
      requires_fast_delivery: true,
      updated_at: '2026-11-02T00:00:00.000Z',
    });
    const older = order({ id: 'old', updated_at: '2026-11-03T00:00:00.000Z' });
    const newer = order({ id: 'new', updated_at: '2026-11-08T00:00:00.000Z' });
    const ids = new Set(['loc-ded']);
    expect(
      [older, express, newer, byLocation]
        .sort((a, b) => compareOpenOrdersForAgent(a, b, ids))
        .map((row) => row.id)
    ).toEqual(['loc', 'exp', 'new', 'old']);
  });
});
