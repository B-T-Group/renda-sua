import {
  applyPickupPlan,
  claimWebhookKey,
  decideCancelBeforePickup,
  decideDepositRenewal,
  decidePickup,
  priceChargeAtPickupSettlement,
} from './charge-at-pickup.machine';

const base = {
  mode: 'charge_at_pickup' as const,
  flagOn: true,
  paymentStatus: 'pending',
  cardSaved: true,
  contract: 'succeeded' as const,
  deposit: 'requires_capture' as const,
};

describe('charge at pickup state machine', () => {
  it('starts when the rental charge and the deposit hold both succeed', () => {
    const plan = decidePickup(base);
    expect(plan).toMatchObject({ type: 'start', start: true, refundContract: false });
  });

  it('refunds the rental charge when the deposit auth fails', () => {
    const plan = decidePickup({ ...base, deposit: 'failed' });
    expect(plan).toMatchObject({
      type: 'compensate',
      code: 'DEPOSIT_AUTH_FAILED',
      start: false,
      refundContract: true,
    });
  });

  it('does not start or refund when the bank asks for a step-up', () => {
    expect(decidePickup({ ...base, contract: 'requires_action' })).toMatchObject({
      type: 'requires_action',
      which: 'contract',
      refundContract: false,
      start: false,
    });
    expect(decidePickup({ ...base, deposit: 'requires_action' }).which).toBe('deposit');
  });

  it('renews by replacing the hold and does not end the rental', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const captureBefore = new Date(now.getTime() + 24 * 3600000);
    const plan = decideDepositRenewal({
      captureBefore,
      now,
      newHold: 'succeeded',
      firstFailureAt: null,
      escalated: false,
    });
    expect(plan).toMatchObject({ type: 'renewed', cancelOld: true, endRental: false, alertSupport: false });
  });

  it('keeps the old hold and continues the rental when renewal fails', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const plan = decideDepositRenewal({
      captureBefore: new Date(now.getTime() + 24 * 3600000),
      now,
      newHold: 'failed',
      firstFailureAt: now,
      escalated: false,
    });
    expect(plan).toMatchObject({
      type: 'failed_keep_old',
      cancelOld: false,
      endRental: false,
      promptRenter: true,
    });
  });

  it('escalates after a day of failed renewals without ending the rental', () => {
    const now = new Date('2026-11-14T12:00:00.000Z');
    const plan = decideDepositRenewal({
      captureBefore: new Date(now.getTime() + 12 * 3600000),
      now,
      newHold: 'failed',
      firstFailureAt: new Date(now.getTime() - 25 * 3600000),
      escalated: false,
    });
    expect(plan).toMatchObject({ type: 'escalate', endRental: false, alertSupport: true });
  });

  it('does not charge the saved card when the renter cancels before pickup', () => {
    expect(
      decideCancelBeforePickup({ mode: 'charge_at_pickup', started: false, paymentStatus: 'pending' })
    ).toEqual({ allowed: true, chargeSavedCard: false, voidAuthorization: false });
  });

  it('leaves a legacy authorized booking on the booking-time hold', () => {
    const plan = decidePickup({
      ...base,
      mode: 'authorize_upfront',
      flagOn: true,
      paymentStatus: 'authorized',
    });
    expect(plan.type).toBe('legacy_unchanged');
    expect(plan.refundContract).toBe(false);
  });

  it('does nothing new when the flag is off and the booking was not stamped', () => {
    expect(
      decidePickup({ ...base, mode: null, flagOn: false, paymentStatus: 'pending' }).type
    ).toBe('flag_off');
  });

  it('invoices only the remainder above the deposit', () => {
    const quote = priceChargeAtPickupSettlement({
      overtime: 20000,
      damage: 40000,
      deposit: 45000,
      collectDamage: true,
    });
    expect(quote).toMatchObject({
      capture: 45000,
      overtimeTaken: 20000,
      damageTaken: 25000,
      invoice: 15000,
      recaptureContract: false,
    });
  });

  it('runs the compensate effects and does not start', async () => {
    const calls: string[] = [];
    await applyPickupPlan(decidePickup({ ...base, deposit: 'failed' }), {
      refundContract: async () => {
        calls.push('refund');
      },
      ledgerContract: async () => {
        calls.push('ledger');
      },
      markStarted: async () => {
        calls.push('start');
      },
      rememberFailure: async () => {
        calls.push('fail');
      },
      returnAction: async () => {
        calls.push('action');
      },
    });
    expect(calls).toEqual(['refund', 'fail']);
  });
});

describe('webhook idempotency', () => {
  it('applies a money event once', () => {
    const first = claimWebhookKey([], 'contract:pi_1:succeeded');
    const second = claimWebhookKey(first.seen, 'contract:pi_1:succeeded');
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.seen).toEqual(['contract:pi_1:succeeded']);
  });
});
