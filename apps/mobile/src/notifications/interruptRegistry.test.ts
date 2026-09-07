import { describe, expect, it } from 'vitest';
import { matchInterrupt } from './interruptRegistry';

const orderId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

describe('matchInterrupt', () => {
  it('matches an active delivery offer', () => {
    expect(matchInterrupt({ type: 'order_offer', orderId })).toEqual({
      kind: 'order_offer',
      orderId,
      cancelled: false,
    });
  });

  it('matches a cancelled delivery offer', () => {
    expect(
      matchInterrupt({ type: 'order_offer_cancelled', orderId })
    ).toEqual({
      kind: 'order_offer',
      orderId,
      cancelled: true,
    });
  });

  it('matches owner incoming-order events without locationId', () => {
    expect(matchInterrupt({ event: 'order_created', orderId })).toEqual({
      kind: 'incoming_order',
      orderId,
      locationId: undefined,
    });
  });

  it('matches mid-window acceptance reminders as incoming orders', () => {
    expect(
      matchInterrupt({ event: 'order_acceptance_reminder', orderId })
    ).toEqual({
      kind: 'incoming_order',
      orderId,
      locationId: undefined,
    });
  });

  it('keeps locationId on incoming-order delegate fan-out', () => {
    expect(
      matchInterrupt({ event: 'order_created', orderId, locationId })
    ).toEqual({
      kind: 'incoming_order',
      orderId,
      locationId,
    });
  });

  it('matches a stock availability check by messageId', () => {
    expect(
      matchInterrupt({ type: 'stock_availability_check', messageId })
    ).toEqual({
      kind: 'stock_availability_check',
      messageId,
    });
  });

  it('parses stock check messageId from url', () => {
    expect(
      matchInterrupt({
        type: 'stock_availability_check',
        url: `https://app.rendasua.com/stock-availability/${messageId}`,
      })
    ).toEqual({
      kind: 'stock_availability_check',
      messageId,
    });
  });

  it('returns null for unrelated payloads', () => {
    expect(matchInterrupt({ type: 'order_status', orderId })).toBeNull();
    expect(matchInterrupt(undefined)).toBeNull();
  });
});
