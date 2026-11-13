import {
  applyPickupPlan,
  claimWebhookKey,
  decideCancelBeforePickup,
  decideDepositRenewal,
  decidePickup,
  priceChargeAtPickupSettlement,
  renewalNeedsReconcile,
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
  it('starts when the deposit hold and the rental charge both succeed', () => {
    const plan = decidePickup(base);
    expect(plan).toMatchObject({ type: 'start', start: true, cancelDeposit: false });
  });

  it('charges nothing when the deposit auth fails', () => {
    const plan = decidePickup({ ...base, deposit: 'failed', contract: 'absent' });
    expect(plan).toMatchObject({
      type: 'declined',
      code: 'DEPOSIT_AUTH_FAILED',
      start: false,
      cancelDeposit: false,
    });
  });

  it('cancels the deposit hold when the rental charge fails and does not start', () => {
    const plan = decidePickup({ ...base, contract: 'failed' });
    expect(plan).toMatchObject({
      type: 'release_deposit',
      code: 'PICKUP_PAYMENT_DECLINED',
      start: false,
      cancelDeposit: true,
    });
  });

  it('keeps a still-valid deposit hold when the rental charge needs a bank step', () => {
    expect(decidePickup({ ...base, contract: 'requires_action' })).toMatchObject({
      type: 'requires_action',
      which: 'contract',
      cancelDeposit: false,
      start: false,
    });
  });

  it('asks for deposit authentication before any rental charge', () => {
    expect(decidePickup({ ...base, deposit: 'requires_action', contract: 'absent' })).toMatchObject({
      type: 'requires_action',
      which: 'deposit',
      cancelDeposit: false,
      start: false,
    });
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

  it('does not cancel the old hold when the new authorization still needs action', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const plan = decideDepositRenewal({
      captureBefore: new Date(now.getTime() + 24 * 3600000),
      now,
      newHold: 'requires_action',
      firstFailureAt: null,
      escalated: false,
    });
    expect(plan).toMatchObject({ type: 'needs_action', cancelOld: false, endRental: false });
  });

  it('reconciles only a live new hold that has not replaced the current one', () => {
    expect(renewalNeedsReconcile({
      renewalState: 'requires_capture',
      currentDepositId: 'pi_old',
      renewalId: 'pi_new',
    })).toBe(true);
    expect(renewalNeedsReconcile({
      renewalState: 'failed',
      currentDepositId: 'pi_old',
      renewalId: 'pi_new',
    })).toBe(false);
    expect(renewalNeedsReconcile({
      renewalState: 'requires_capture',
      currentDepositId: 'pi_new',
      renewalId: 'pi_new',
    })).toBe(false);
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
    expect(plan.cancelDeposit).toBe(false);
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
    expect(quote.capture).toBeLessThanOrEqual(45000);
  });

  it('never captures more than the authorized deposit and invoices only the excess', () => {
    const quote = priceChargeAtPickupSettlement({
      overtime: 80000,
      damage: 10000,
      deposit: 45000,
      collectDamage: true,
    });
    expect(quote.capture).toBe(45000);
    expect(quote.invoice).toBe(45000);
    expect(quote.capture).toBeLessThanOrEqual(45000);
  });

  it('cancels the deposit and does not start when the rental charge failed', async () => {
    const calls: string[] = [];
    await applyPickupPlan(decidePickup({ ...base, contract: 'failed' }), {
      cancelDeposit: async () => {
        calls.push('cancel');
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
    expect(calls).toEqual(['cancel', 'fail']);
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
