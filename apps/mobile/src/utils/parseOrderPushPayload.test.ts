import { describe, expect, it } from 'vitest';
import { parseOrderPushPayload } from './parseOrderPushPayload';

describe('parseOrderPushPayload', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const locationId = '22222222-2222-4222-8222-222222222222';

  it('deep-links business pickup_reminder to the order', () => {
    const parsed = parseOrderPushPayload({
      event: 'pickup_reminder',
      orderId,
      persona: 'business',
    });
    expect(parsed).toEqual({
      orderId,
      openMessages: false,
      highlightMessageId: undefined,
      rate: undefined,
      persona: 'business',
      locationId: undefined,
    });
  });

  it('leaves agent pickup_reminder to the agent overlay', () => {
    expect(
      parseOrderPushPayload({
        event: 'pickup_reminder',
        orderId,
        persona: 'agent',
      })
    ).toBeNull();
  });

  it('leaves store_pickup_reminder to the client overlay', () => {
    expect(
      parseOrderPushPayload({
        event: 'store_pickup_reminder',
        orderId,
        persona: 'client',
      })
    ).toBeNull();
  });

  it('still opens order_status pushes', () => {
    const parsed = parseOrderPushPayload({
      type: 'order_status',
      orderId,
      persona: 'business',
      status: 'confirmed',
    });
    expect(parsed?.orderId).toBe(orderId);
    expect(parsed?.persona).toBe('business');
  });

  it('keeps new-order acceptance events for the incoming overlay', () => {
    expect(
      parseOrderPushPayload({
        event: 'order_created',
        orderId,
        persona: 'business',
      })
    ).toBeNull();
  });

  it('opens delegate order_created when locationId is present', () => {
    const parsed = parseOrderPushPayload({
      event: 'order_created',
      orderId,
      locationId,
    });
    expect(parsed).toEqual({
      orderId,
      openMessages: false,
      highlightMessageId: undefined,
      rate: undefined,
      persona: null,
      locationId,
    });
  });

  it('parses locationId from order_status delegate fan-out', () => {
    const parsed = parseOrderPushPayload({
      event: 'order_status',
      orderId,
      locationId,
    });
    expect(parsed?.locationId).toBe(locationId);
    expect(parsed?.orderId).toBe(orderId);
  });
});
