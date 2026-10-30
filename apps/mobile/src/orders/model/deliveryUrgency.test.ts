import {
  deliverByDeadlineAt,
  pickupDeadlineAt,
  urgencyFor,
} from './deliveryUrgency';
import type { OrderLike, OrderViewModelContext } from './types';

const t: OrderViewModelContext['t'] = (key, defaultValue, options) => {
  let out = defaultValue ?? key;
  if (!options) return out;
  for (const [name, value] of Object.entries(options)) {
    out = out.replace(new RegExp(`{{${name}}}`, 'g'), String(value));
  }
  return out;
};

const ctx: OrderViewModelContext = {
  t,
  now: new Date('2026-08-02T12:00:00Z'),
  locale: 'en',
};

function order(overrides: Partial<OrderLike> = {}): OrderLike {
  return {
    id: 'o1',
    order_number: 'RS-100',
    current_status: 'assigned_to_agent',
    ...overrides,
  };
}

describe('pickupDeadlineAt', () => {
  it('prefers pickup_due_at over pickup_by', () => {
    expect(
      pickupDeadlineAt(
        order({
          pickup_due_at: '2026-08-02T13:00:00Z',
          pickup_by: '2026-08-02T14:00:00Z',
        })
      )
    ).toBe('2026-08-02T13:00:00Z');
  });

  it('falls back to pickup_by and ignores promised_ready_at', () => {
    expect(
      pickupDeadlineAt(
        order({
          pickup_due_at: null,
          pickup_by: '2026-08-02T14:30:00Z',
          promised_ready_at: '2026-08-02T11:00:00Z',
        })
      )
    ).toBe('2026-08-02T14:30:00Z');
  });
});

describe('deliverByDeadlineAt', () => {
  it('uses the selected window time_slot_end', () => {
    const deadline = deliverByDeadlineAt(
      order({
        fulfillment_timing: 'scheduled',
        delivery_time_window_id: 'w2',
        delivery_time_windows: [
          {
            id: 'w1',
            preferred_date: '2026-08-02',
            time_slot_end: '11:00',
          },
          {
            id: 'w2',
            preferred_date: '2026-08-02',
            time_slot_end: '16:30',
          },
        ],
      })
    );
    expect(deadline).toBeTruthy();
    const local = new Date(deadline as string);
    expect(local.getHours()).toBe(16);
    expect(local.getMinutes()).toBe(30);
  });

  it('falls back to estimated_delivery_time then promised_fulfill_by', () => {
    expect(
      deliverByDeadlineAt(
        order({
          fulfillment_timing: 'scheduled',
          estimated_delivery_time: '2026-08-02T17:00:00Z',
          promised_fulfill_by: '2026-08-02T18:00:00Z',
        })
      )
    ).toBe('2026-08-02T17:00:00Z');
    expect(
      deliverByDeadlineAt(
        order({
          fulfillment_timing: 'scheduled',
          promised_fulfill_by: '2026-08-02T18:00:00Z',
        })
      )
    ).toBe('2026-08-02T18:00:00Z');
  });

  it('skips ASAP and missing promised times', () => {
    expect(
      deliverByDeadlineAt(
        order({
          fulfillment_timing: 'asap',
          estimated_delivery_time: '2026-08-02T17:00:00Z',
          promised_fulfill_by: '2026-08-02T18:00:00Z',
        })
      )
    ).toBeNull();
    expect(deliverByDeadlineAt(order({ fulfillment_timing: 'scheduled' }))).toBeNull();
  });
});

describe('urgencyFor', () => {
  it('shows timed pickup-by for ready_for_pickup and assigned_to_agent', () => {
    const ready = urgencyFor(
      order({
        current_status: 'ready_for_pickup',
        pickup_due_at: '2026-08-02T15:00:00Z',
      }),
      ctx
    );
    const assigned = urgencyFor(
      order({
        current_status: 'assigned_to_agent',
        pickup_by: '2026-08-02T15:00:00Z',
      }),
      ctx
    );
    expect(ready?.deadlineAt).toBe('2026-08-02T15:00:00Z');
    expect(ready?.label).toMatch(/^Pick up by /);
    expect(ready?.overdue).toBe(false);
    expect(assigned?.deadlineAt).toBe('2026-08-02T15:00:00Z');
    expect(assigned?.label).toMatch(/^Pick up by /);
  });

  it('marks pickup-by overdue after the deadline', () => {
    const urgency = urgencyFor(
      order({
        current_status: 'assigned_to_agent',
        pickup_due_at: '2026-08-02T11:00:00Z',
      }),
      ctx
    );
    expect(urgency?.overdue).toBe(true);
  });

  it('shows timed deliver-by after pickup, not on ready_for_pickup', () => {
    const inTransit = urgencyFor(
      order({
        current_status: 'in_transit',
        fulfillment_timing: 'scheduled',
        estimated_delivery_time: '2026-08-02T18:00:00Z',
        pickup_due_at: '2026-08-02T13:00:00Z',
      }),
      ctx
    );
    const ready = urgencyFor(
      order({
        current_status: 'ready_for_pickup',
        fulfillment_timing: 'scheduled',
        estimated_delivery_time: '2026-08-02T18:00:00Z',
        pickup_due_at: '2026-08-02T13:00:00Z',
      }),
      ctx
    );
    expect(inTransit?.deadlineAt).toBe('2026-08-02T18:00:00Z');
    expect(inTransit?.label).toMatch(/^Deliver by /);
    expect(ready?.deadlineAt).toBe('2026-08-02T13:00:00Z');
    expect(ready?.label).toMatch(/^Pick up by /);
  });

  it('omits deliver-by for ASAP after pickup', () => {
    expect(
      urgencyFor(
        order({
          current_status: 'picked_up',
          fulfillment_timing: 'asap',
          estimated_delivery_time: '2026-08-02T18:00:00Z',
        }),
        ctx
      )
    ).toBeNull();
  });
});
