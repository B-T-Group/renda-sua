import { describe, expect, it } from 'vitest';
import {
  deliveryConfirmActions,
  deliveryConfirmOrderId,
  deliveryConfirmSourceFromUrl,
  minutesLeft,
  secondsSinceDelivered,
} from './deliveryConfirmLink';

const ID = '0f6e3a5e-1d1b-4b0a-9a51-2c8f6c4d1e2f';

describe('deliveryConfirmLink', () => {
  it('recognises orders/:id/confirm only', () => {
    expect(deliveryConfirmOrderId(`orders/${ID}/confirm`)).toBe(ID);
    expect(deliveryConfirmOrderId(`orders/${ID}`)).toBeNull();
    expect(deliveryConfirmOrderId(`orders/not-an-id/confirm`)).toBeNull();
  });

  it('reads the channel from src', () => {
    expect(deliveryConfirmSourceFromUrl(`https://rendasua.com/app/orders/${ID}/confirm?persona=client&src=wa`)).toBe('wa');
    expect(deliveryConfirmSourceFromUrl(`rendasua://orders/${ID}/confirm?src=sms`)).toBe('sms');
    expect(deliveryConfirmSourceFromUrl(`rendasua://orders/${ID}/confirm`)).toBe('in_app');
  });

  it('counts down from server time, not the device clock', () => {
    // Device clock is 10 minutes fast.
    const fetched = Date.parse('2026-11-04T15:10:00Z');
    expect(
      minutesLeft({
        deadlineAt: '2026-11-04T16:00:00Z',
        serverNow: '2026-11-04T15:00:00Z',
        fetchedAtMs: fetched,
        nowMs: fetched,
      })
    ).toBe(60);
    expect(minutesLeft({ deadlineAt: null, serverNow: null, fetchedAtMs: 0, nowMs: 0 })).toBeNull();
    expect(
      minutesLeft({ deadlineAt: '2026-11-04T15:00:00Z', serverNow: null, fetchedAtMs: 0, nowMs: Date.parse('2026-11-04T16:00:00Z') })
    ).toBe(0);
  });

  it('disables all three actions offline (no queueing)', () => {
    const live = { canComplete: true, canReport: true };
    expect(deliveryConfirmActions(live, false)).toEqual({ complete: true, report: true, failed: true });
    expect(deliveryConfirmActions(live, true)).toEqual({ complete: false, report: false, failed: false });
    expect(deliveryConfirmActions({ canReportAfterCompletion: true }, false)).toEqual({
      complete: false,
      report: true,
      failed: true,
    });
  });

  it('seconds since delivered', () => {
    expect(secondsSinceDelivered('2026-11-04T15:00:00Z', Date.parse('2026-11-04T15:01:30Z'))).toBe(90);
    expect(secondsSinceDelivered(null, 0)).toBeNull();
  });
});
