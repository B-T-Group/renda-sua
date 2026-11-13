/**
 * Pure money decisions for charge-at-pickup. Stripe and the ledger run the
 * commands; they do not decide them.
 */

export type IntentState =
  | 'absent'
  | 'succeeded'
  | 'requires_capture'
  | 'requires_action'
  | 'failed';

export type PickupPlanType =
  | 'legacy_unchanged'
  | 'flag_off'
  | 'card_required'
  | 'start'
  | 'release_deposit'
  | 'requires_action'
  | 'declined';

export interface PickupPlan {
  type: PickupPlanType;
  code: string | null;
  which: 'contract' | 'deposit' | null;
  start: boolean;
  /** Cancel a live deposit auth. Used when the rental charge failed. Free, no refund. */
  cancelDeposit: boolean;
  chargeSavedCard: boolean;
}

export interface PickupAttempt {
  mode: 'authorize_upfront' | 'charge_at_pickup' | null;
  flagOn: boolean;
  paymentStatus: string | null;
  cardSaved: boolean;
  contract: IntentState;
  deposit: IntentState;
}

export function decidePickup(input: PickupAttempt): PickupPlan {
  if (isLegacyAuthorized(input)) return plan('legacy_unchanged', null, false);
  if (input.mode !== 'charge_at_pickup' && !input.flagOn) {
    return plan('flag_off', null, false);
  }
  if (input.mode !== 'charge_at_pickup') return plan('legacy_unchanged', null, false);
  if (!input.cardSaved) return plan('card_required', 'CARD_NOT_SAVED', false);
  return decideIntents(input.contract, input.deposit);
}

export interface RenewalInput {
  captureBefore: Date;
  now: Date;
  newHold: 'succeeded' | 'failed' | 'requires_action' | 'not_attempted';
  firstFailureAt: Date | null;
  escalated: boolean;
  leadHours?: number;
  retryHours?: number;
}

export interface RenewalPlan {
  type: 'not_due' | 'attempt' | 'renewed' | 'failed_keep_old' | 'escalate' | 'needs_action';
  cancelOld: boolean;
  endRental: false;
  alertSupport: boolean;
  promptRenter: boolean;
}

export function decideDepositRenewal(input: RenewalInput): RenewalPlan {
  const lead = (input.leadHours ?? 48) * 3600000;
  if (input.now.getTime() < input.captureBefore.getTime() - lead) {
    return renewal('not_due', false, false, false);
  }
  if (input.newHold === 'succeeded') return renewal('renewed', true, false, false);
  if (input.newHold === 'requires_action') return renewal('needs_action', false, false, true);
  if (input.newHold === 'not_attempted') return renewal('attempt', false, false, false);
  return failedRenewal(input);
}

export interface CancelInput {
  mode: 'authorize_upfront' | 'charge_at_pickup' | null;
  started: boolean;
  paymentStatus: string | null;
}

export interface CancelPlan {
  allowed: boolean;
  chargeSavedCard: false;
  voidAuthorization: boolean;
}

export function decideCancelBeforePickup(input: CancelInput): CancelPlan {
  if (input.started) return { allowed: false, chargeSavedCard: false, voidAuthorization: false };
  const legacyHold = input.paymentStatus === 'authorized' && input.mode !== 'charge_at_pickup';
  return { allowed: true, chargeSavedCard: false, voidAuthorization: legacyHold };
}

export interface DepositSettlementInput {
  overtime: number;
  damage: number;
  deposit: number;
  collectDamage: boolean;
}

export interface DepositSettlementQuote {
  capture: number;
  overtimeTaken: number;
  damageTaken: number;
  invoice: number;
  releaseHold: boolean;
  recaptureContract: false;
}

/**
 * True when a renewal PaymentIntent is already authorized and the booking
 * still points at the previous hold. The cron finishes the swap instead of
 * creating a third hold.
 */
export function renewalNeedsReconcile(input: {
  renewalState: IntentState;
  currentDepositId: string | null;
  renewalId: string | null;
}): boolean {
  if (!input.renewalId || input.renewalId === input.currentDepositId) return false;
  return input.renewalState === 'requires_capture' || input.renewalState === 'succeeded';
}

/** Contract is already captured. Capture never exceeds the authorized deposit. */
export function priceChargeAtPickupSettlement(
  input: DepositSettlementInput
): DepositSettlementQuote {
  const deposit = round2(Math.max(0, input.deposit));
  const overtime = round2(Math.max(0, input.overtime));
  const damage = input.collectDamage ? round2(Math.max(0, input.damage)) : 0;
  const overtimeTaken = round2(Math.min(overtime, deposit));
  const damageRoom = round2(Math.max(0, deposit - overtimeTaken));
  const damageTaken = round2(Math.min(damage, damageRoom));
  const capture = round2(Math.min(overtimeTaken + damageTaken, deposit));
  const uncovered = round2(Math.max(0, overtime + damage - capture));
  return {
    capture,
    overtimeTaken,
    damageTaken,
    invoice: uncovered,
    releaseHold: true,
    recaptureContract: false,
  };
}

export function claimWebhookKey(
  seen: readonly string[],
  key: string
): { seen: string[]; applied: boolean } {
  if (seen.includes(key)) return { seen: [...seen], applied: false };
  return { seen: [...seen, key], applied: true };
}

export interface IntentLike {
  status?: string | null;
}

export function classifyIntent(status: string | null | undefined): IntentState {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'requires_capture') return 'requires_capture';
  if (status === 'requires_action' || status === 'requires_confirmation') {
    return 'requires_action';
  }
  if (!status) return 'absent';
  return 'failed';
}

export function readCaptureBeforeIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

export interface PickupEffects {
  cancelDeposit: () => Promise<void>;
  ledgerContract: () => Promise<void>;
  markStarted: () => Promise<void>;
  rememberFailure: (code: string) => Promise<void>;
  returnAction: (which: 'contract' | 'deposit') => Promise<void>;
}

/** Runs the plan. A duplicate webhook must not call this again. */
export async function applyPickupPlan(plan: PickupPlan, effects: PickupEffects): Promise<void> {
  if (plan.type === 'release_deposit') {
    await effects.cancelDeposit();
    await effects.rememberFailure(plan.code ?? 'PICKUP_PAYMENT_DECLINED');
    return;
  }
  if (plan.type === 'requires_action') {
    await effects.returnAction(plan.which ?? 'contract');
    return;
  }
  if (plan.type === 'declined' || plan.type === 'card_required') {
    await effects.rememberFailure(plan.code ?? 'PICKUP_PAYMENT_DECLINED');
    return;
  }
  if (plan.type !== 'start') return;
  await effects.ledgerContract();
  await effects.markStarted();
}

function isLegacyAuthorized(input: PickupAttempt): boolean {
  return input.paymentStatus === 'authorized' && input.mode !== 'charge_at_pickup';
}

/**
 * Deposit first. A failed deposit never charges the rental. A rental charge that
 * still needs 3DS keeps the deposit so the retry reuses that hold. A failed
 * rental charge cancels the hold. Cancelling it before 3DS would capture the
 * rental with no deposit.
 */
function decideIntents(contract: IntentState, deposit: IntentState): PickupPlan {
  if (deposit === 'requires_action') return actionPlan('deposit');
  if (!held(deposit)) return plan('declined', 'DEPOSIT_AUTH_FAILED', false);
  if (contract === 'requires_action') return actionPlan('contract');
  if (contract === 'succeeded') return plan('start', null, true);
  return releasePlan('PICKUP_PAYMENT_DECLINED');
}

function held(deposit: IntentState): boolean {
  return deposit === 'requires_capture' || deposit === 'succeeded';
}

function actionPlan(which: 'contract' | 'deposit'): PickupPlan {
  return {
    type: 'requires_action',
    code: 'PICKUP_REQUIRES_ACTION',
    which,
    start: false,
    cancelDeposit: false,
    chargeSavedCard: false,
  };
}

function releasePlan(code: string): PickupPlan {
  return {
    type: 'release_deposit',
    code,
    which: null,
    start: false,
    cancelDeposit: true,
    chargeSavedCard: false,
  };
}

function plan(type: PickupPlanType, code: string | null, start: boolean): PickupPlan {
  return { type, code, which: null, start, cancelDeposit: false, chargeSavedCard: false };
}

function failedRenewal(input: RenewalInput): RenewalPlan {
  const retry = (input.retryHours ?? 24) * 3600000;
  const failedAt = input.firstFailureAt?.getTime() ?? input.now.getTime();
  const expired = input.now.getTime() >= input.captureBefore.getTime();
  const gaveUp = input.now.getTime() - failedAt >= retry;
  if ((expired || gaveUp) && !input.escalated) return renewal('escalate', false, true, true);
  return renewal('failed_keep_old', false, false, true);
}

function renewal(
  type: RenewalPlan['type'],
  cancelOld: boolean,
  alertSupport: boolean,
  promptRenter: boolean
): RenewalPlan {
  return { type, cancelOld, endRental: false, alertSupport, promptRenter };
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
