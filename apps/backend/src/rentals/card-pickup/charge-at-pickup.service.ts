import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { AccountsService } from '../../accounts/accounts.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SiteEventsService } from '../../site-events/site-events.service';
import { emitServerSiteEvent } from '../../site-events/server-site-events.helper';
import type { SiteEventTypeV1 } from '../../site-events/site-event-types';
import { StripeConfig } from '../../config/configuration';
import {
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from '../../stripe-payments/stripe-payments-database.service';
import { StripeService } from '../../stripe-payments/stripe.service';
import { assertLedgerResult, rentalLedgerKey } from '../rental-ledger';
import { CHARGE_AT_PICKUP_FLAG } from './rental-card-payment-policy';
import {
  applyPickupPlan,
  classifyIntent,
  decideCancelBeforePickup,
  decideDepositRenewal,
  decidePickup,
  priceChargeAtPickupSettlement,
  readCaptureBeforeIso,
  type IntentState,
  type PickupPlan,
} from './charge-at-pickup.machine';
import {
  contractKey,
  contractRefundKey,
  depositCancelKey,
  depositCaptureKey,
  depositKey,
  remainderKey,
  renewalKey,
  setupCheckoutKey,
  setupIntentKey,
} from './charge-at-pickup.keys';

const RENEW_LEAD_MS = 48 * 3600000;
const REMAINDER_REMIND_MS = 3 * 86400000;
const REMAINDER_OVERDUE_MS = 7 * 86400000;

export interface ChargeStartResult {
  type: string;
  code: string | null;
  clientSecret: string | null;
  which: 'contract' | 'deposit' | null;
}

@Injectable()
export class ChargeAtPickupService {
  private readonly logger = new Logger(ChargeAtPickupService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly stripe: StripeService,
    private readonly payments: StripePaymentsDatabaseService,
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService,
    private readonly siteEvents: SiteEventsService,
    private readonly config: ConfigService
  ) {}

  async isEnabled(): Promise<boolean> {
    try {
      const row = await this.readFlag();
      return row?.boolean_value === true;
    } catch (error: any) {
      this.logger.warn(`charge-at-pickup flag: ${error?.message ?? error}`);
      return false;
    }
  }

  async beginSaveCard(
    booking: any,
    channel: 'payment_sheet' | 'checkout'
  ): Promise<{ clientSecret: string | null; checkoutUrl: string | null }> {
    const customerId = await this.ensureCustomer(booking);
    if (channel === 'checkout') return this.beginCheckoutSetup(booking, customerId);
    return this.beginSheetSetup(booking, customerId);
  }

  async confirmSavedCard(booking: any): Promise<boolean> {
    const id = booking.stripe_setup_intent_id as string | undefined;
    if (!id) return false;
    const intent = await this.stripe.retrieveSetupIntent(id);
    if (intent.status !== 'succeeded') return false;
    await this.stampSavedCard(booking, intent);
    return true;
  }

  async chargeAtStart(booking: any): Promise<ChargeStartResult> {
    const early = this.alreadyCharged(booking);
    if (early) return early;
    if (!booking.card_saved_at || !booking.stripe_payment_method_id) {
      const plan = decidePickup(this.pickupInput(booking, 'absent', 'absent'));
      await applyPickupPlan(plan, this.effects(booking, null, null, plan));
      return this.startResult(plan, null, null);
    }
    const contract = await this.ensureContract(booking);
    const deposit = await this.depositAfterContract(booking, contract.state);
    const plan = decidePickup(this.pickupInput(booking, contract.state, deposit.state));
    await applyPickupPlan(plan, this.effects(booking, contract.intent, deposit.intent, plan));
    return this.startResult(plan, contract.intent, deposit.intent);
  }

  async settleReturned(booking: any, overtime: number, damage: number, collectDamage: boolean): Promise<void> {
    const quote = priceChargeAtPickupSettlement({
      overtime,
      damage,
      deposit: Number(booking.deposit_hold_amount ?? booking.security_deposit_amount) || 0,
      collectDamage,
    });
    await this.applySettlement(booking, quote);
  }

  async sweep(now = new Date()): Promise<void> {
    await this.sweepRenewals(now);
    await this.sweepUnsavedCards(now);
    await this.sweepRemainders(now);
  }

  async onSetupSucceeded(intent: Stripe.SetupIntent): Promise<void> {
    const bookingId = intent.metadata?.bookingId;
    if (!bookingId || intent.status !== 'succeeded') return;
    const booking = await this.load(bookingId);
    if (!booking) return;
    const won = await this.claim(booking, `setup:${intent.id}:succeeded`, 'setup', 0, 'succeeded', intent.id);
    if (!won) return;
    await this.stampSavedCard(booking, intent);
    this.emit('rental_card_setup_succeeded', booking, {});
  }

  async onContractEvent(tx: StripePaymentTransaction): Promise<void> {
    await this.webhookLeg(tx, 'contract', 'succeeded');
  }

  async onDepositAuthorized(tx: StripePaymentTransaction, captureBefore: string | null): Promise<void> {
    const booking = await this.bookingForTx(tx);
    if (!booking) return;
    const won = await this.claim(booking, `deposit:${tx.stripe_payment_intent_id}:held`, 'deposit', tx.amount, 'requires_capture', tx.stripe_payment_intent_id);
    if (!won) return;
    const before = captureBefore ?? (await this.captureBeforeFromId(tx.stripe_payment_intent_id));
    if (before) await this.patch(booking.id, { deposit_capture_before: before });
  }

  async onRemainderPaid(tx: StripePaymentTransaction): Promise<void> {
    const booking = await this.bookingForTx(tx);
    if (!booking) return;
    const won = await this.claim(booking, `remainder:${tx.stripe_payment_intent_id}:paid`, 'remainder', tx.amount, 'succeeded', tx.stripe_payment_intent_id);
    if (!won) return;
    await this.patch(booking.id, { remainder_status: 'paid', remainder_paid_at: new Date().toISOString() });
    this.emit('rental_remainder_paid', booking, { amount: tx.amount });
  }

  cancelPlan(booking: any): { chargeSavedCard: false; voidAuthorization: boolean } {
    return decideCancelBeforePickup({
      mode: booking.card_payment_mode ?? null,
      started: !!booking.actual_start_at,
      paymentStatus: booking.payment_status ?? null,
    });
  }

  async noteCancelled(booking: any): Promise<void> {
    await this.voidOpenPickupIntents(booking);
    this.emit('rental_cancelled_before_pickup', booking, { reason: 'cancel' });
  }

  async noteExpiredUnstarted(booking: any): Promise<void> {
    if (booking.card_payment_mode !== 'charge_at_pickup') return;
    await this.voidOpenPickupIntents(booking);
    this.emit('rental_reserved_expired_unstarted', booking, { reason: 'grace' });
  }

  private async readFlag(): Promise<{ boolean_value?: boolean | null } | null> {
    const res = await this.hasura.executeQuery<{
      application_configurations: Array<{ boolean_value?: boolean | null }>;
    }>(FLAG_QUERY, { key: CHARGE_AT_PICKUP_FLAG });
    return res.application_configurations?.[0] ?? null;
  }

  private alreadyCharged(booking: any): ChargeStartResult | null {
    if (booking.payment_status !== 'deposit_held' && booking.status !== 'active') return null;
    return { type: 'start', code: null, clientSecret: null, which: null };
  }

  private pickupInput(booking: any, contract: IntentState, deposit: IntentState) {
    return {
      mode: 'charge_at_pickup' as const,
      flagOn: true,
      paymentStatus: booking.payment_status ?? null,
      cardSaved: !!booking.card_saved_at && !!booking.stripe_payment_method_id,
      contract,
      deposit,
    };
  }

  private async depositAfterContract(booking: any, contract: IntentState) {
    if (contract !== 'succeeded') return { state: 'absent' as IntentState, intent: null };
    if ((Number(booking.security_deposit_amount) || 0) <= 0) {
      return { state: 'succeeded' as IntentState, intent: null };
    }
    return this.ensureDeposit(booking);
  }

  private startResult(plan: PickupPlan, contract: Stripe.PaymentIntent | null, deposit: Stripe.PaymentIntent | null): ChargeStartResult {
    const intent = plan.which === 'deposit' ? deposit : contract;
    return {
      type: plan.type,
      code: plan.code,
      which: plan.which,
      clientSecret: plan.type === 'requires_action' ? intent?.client_secret ?? null : null,
    };
  }

  private effects(booking: any, contract: Stripe.PaymentIntent | null, deposit: Stripe.PaymentIntent | null, plan: PickupPlan) {
    return {
      refundContract: () => this.compensate(booking, contract),
      ledgerContract: () => this.ledgerContractOnce(booking, contract),
      markStarted: () => this.markDepositHeld(booking, contract, deposit),
      rememberFailure: (code: string) => this.rememberFailure(booking, code, plan),
      returnAction: () => this.rememberAction(booking),
    };
  }

  private async ensureCustomer(booking: any): Promise<string> {
    if (booking.stripe_customer_id) return booking.stripe_customer_id as string;
    const customerId = await this.stripe.createRentalCustomer({
      userId: booking.client?.user_id,
      email: booking.client?.user?.email ?? null,
    });
    await this.patch(booking.id, { stripe_customer_id: customerId });
    booking.stripe_customer_id = customerId;
    return customerId;
  }

  private async beginSheetSetup(booking: any, customerId: string) {
    const intent = await this.stripe.createCardSetupIntent({
      customerId,
      bookingId: booking.id,
      idempotencyKey: setupIntentKey(booking.id),
    });
    await this.patch(booking.id, { stripe_setup_intent_id: intent.id });
    this.emit('rental_card_setup_started', booking, { channel: 'payment_sheet' });
    return { clientSecret: intent.client_secret, checkoutUrl: null };
  }

  private async beginCheckoutSetup(booking: any, customerId: string) {
    const base = this.config.get<StripeConfig>('stripe')?.appBaseUrl || '';
    const session = await this.stripe.createSetupCheckout({
      customerId,
      bookingId: booking.id,
      successUrl: `${base}/rentals/bookings/${booking.id}?card=saved`,
      cancelUrl: `${base}/rentals/bookings/${booking.id}?card=cancel`,
      idempotencyKey: setupCheckoutKey(booking.id),
    });
    const setupId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
    if (setupId) await this.patch(booking.id, { stripe_setup_intent_id: setupId });
    this.emit('rental_card_setup_started', booking, { channel: 'checkout' });
    return { clientSecret: null, checkoutUrl: session.url ?? null };
  }

  private async stampSavedCard(booking: any, intent: Stripe.SetupIntent): Promise<void> {
    const methodId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id;
    const card = await this.cardSummary(methodId);
    await this.patch(booking.id, {
      stripe_setup_intent_id: intent.id,
      stripe_payment_method_id: methodId ?? null,
      stripe_customer_id: typeof intent.customer === 'string' ? intent.customer : booking.stripe_customer_id,
      card_brand: card.brand,
      card_last4: card.last4,
      card_saved_at: new Date().toISOString(),
      contract_expires_at: null,
      pickup_payment_failure_code: null,
    });
  }

  private async cardSummary(methodId: string | undefined): Promise<{ brand: string | null; last4: string | null }> {
    if (!methodId) return { brand: null, last4: null };
    const method = await this.stripe.retrieveCardPaymentMethod(methodId);
    return { brand: method.card?.brand ?? null, last4: method.card?.last4 ?? null };
  }

  private async ensureContract(booking: any): Promise<{ state: IntentState; intent: Stripe.PaymentIntent | null }> {
    const reused = await this.reuseIntent(booking, 'contract');
    if (reused) return reused;
    const attempt = this.attempt(booking);
    const intent = await this.stripe.createOffSessionPaymentIntent({
      amount: Number(booking.total_amount),
      currency: booking.currency,
      customerId: booking.stripe_customer_id,
      paymentMethodId: booking.stripe_payment_method_id,
      description: `Rental ${booking.booking_number} contract`,
      captureMethod: 'automatic',
      idempotencyKey: contractKey(booking.id, attempt),
      metadata: this.meta(booking, 'contract'),
    });
    await this.rememberIntent(booking, 'contract', intent, attempt);
    return { state: classifyIntent(intent.status), intent };
  }

  private async ensureDeposit(booking: any): Promise<{ state: IntentState; intent: Stripe.PaymentIntent | null }> {
    const reused = await this.reuseIntent(booking, 'deposit');
    if (reused) return reused;
    const attempt = this.attempt(booking);
    const amount = Math.max(0, Number(booking.security_deposit_amount) || 0);
    const intent = await this.stripe.createOffSessionPaymentIntent({
      amount,
      currency: booking.currency,
      customerId: booking.stripe_customer_id,
      paymentMethodId: booking.stripe_payment_method_id,
      description: `Rental ${booking.booking_number} deposit hold`,
      captureMethod: 'manual',
      extendedAuthorization: true,
      idempotencyKey: depositKey(booking.id, attempt),
      metadata: this.meta(booking, 'deposit'),
    });
    await this.rememberIntent(booking, 'deposit', intent, attempt);
    return { state: classifyIntent(intent.status), intent };
  }

  private async reuseIntent(booking: any, leg: 'contract' | 'deposit') {
    if (this.attempt(booking) !== Number(booking.charged_attempt)) return null;
    const id = leg === 'contract' ? booking.contract_payment_intent_id : booking.deposit_payment_intent_id;
    if (!id) return null;
    const intent = await this.stripe.retrieveExpandedPaymentIntent(id);
    return { state: classifyIntent(intent.status), intent };
  }

  private async rememberIntent(booking: any, leg: 'contract' | 'deposit', intent: Stripe.PaymentIntent, attempt: number) {
    const column = leg === 'contract' ? 'contract_payment_intent_id' : 'deposit_payment_intent_id';
    const captureBefore = await this.captureBefore(intent);
    await this.recordPaymentRow(booking, intent, leg);
    await this.patch(booking.id, {
      [column]: intent.id,
      charged_attempt: attempt,
      ...(leg === 'deposit' && captureBefore ? { deposit_capture_before: captureBefore, deposit_hold_amount: Number(booking.security_deposit_amount) || 0 } : {}),
    });
    booking[column] = intent.id;
    booking.charged_attempt = attempt;
  }

  private async compensate(booking: any, contract: Stripe.PaymentIntent | null): Promise<void> {
    if (!contract?.id) return;
    await this.ledgerContractOnce(booking, contract);
    await this.stripe.refundCardPayment({
      paymentIntentId: contract.id,
      amount: Number(booking.total_amount),
      currency: booking.currency,
      idempotencyKey: contractRefundKey(booking.id, this.attempt(booking)),
      metadata: { bookingId: booking.id, purpose: 'deposit_auth_failed' },
    });
    await this.reverseContractLedger(booking);
    this.emit('rental_pickup_payment_failed', booking, { reason: 'DEPOSIT_AUTH_FAILED' });
  }

  private async ledgerContractOnce(booking: any, contract: Stripe.PaymentIntent | null): Promise<void> {
    const id = contract?.id ?? booking.contract_payment_intent_id;
    const won = await this.claim(booking, `contract:${id}:succeeded`, 'contract', Number(booking.total_amount), 'succeeded', id);
    if (!won) return;
    await this.ledgerAmount(booking, Number(booking.total_amount), 'pickup-contract', 'Pickup contract');
    this.emit('rental_pickup_contract_captured', booking, { amount: Number(booking.total_amount) });
  }

  private async markDepositHeld(booking: any, contract: Stripe.PaymentIntent | null, deposit: Stripe.PaymentIntent | null): Promise<void> {
    const before = deposit ? await this.captureBefore(deposit) : booking.deposit_capture_before;
    const holdId = deposit?.id ?? `nodeposit:${booking.id}`;
    const won = await this.claim(booking, `deposit:${holdId}:held`, 'deposit', Number(booking.security_deposit_amount) || 0, 'requires_capture', deposit?.id);
    await this.patch(booking.id, {
      payment_status: 'deposit_held',
      payment_timing: 'pay_at_pickup',
      captured_amount: Number(booking.total_amount),
      deposit_capture_before: before,
      deposit_hold_amount: Number(booking.security_deposit_amount) || 0,
      contract_payment_intent_id: contract?.id ?? booking.contract_payment_intent_id,
      deposit_payment_intent_id: deposit?.id ?? booking.deposit_payment_intent_id,
      pickup_payment_failure_code: null,
    });
    if (won) this.emit('rental_pickup_deposit_held', booking, { captureBefore: before });
    this.emitLongStay(booking);
  }

  private async rememberFailure(booking: any, code: string, plan: PickupPlan): Promise<void> {
    await this.patch(booking.id, {
      pickup_payment_failure_code: code,
      pickup_payment_failure_reason: plan.type,
      pickup_charge_attempt: this.attempt(booking) + 1,
    });
    if (code !== 'DEPOSIT_AUTH_FAILED') {
      this.emit('rental_pickup_payment_failed', booking, { reason: code });
    }
  }

  private async rememberAction(booking: any): Promise<void> {
    await this.patch(booking.id, { pickup_payment_failure_code: 'PICKUP_REQUIRES_ACTION' });
    this.emit('rental_pickup_payment_failed', booking, { reason: 'PICKUP_REQUIRES_ACTION' });
  }

  private async applySettlement(booking: any, quote: ReturnType<typeof priceChargeAtPickupSettlement>): Promise<void> {
    const pi = booking.deposit_payment_intent_id as string | undefined;
    if (!pi || booking.deposit_settled_at) return;
    if (quote.capture <= 0) await this.releaseDeposit(booking, pi);
    else await this.captureDeposit(booking, pi, quote);
    if (quote.invoice > 0) await this.invoiceRemainder(booking, quote);
  }

  private async releaseDeposit(booking: any, pi: string): Promise<void> {
    await this.stripe.cancelPaymentIntent(pi, depositCancelKey(pi));
    await this.patch(booking.id, { deposit_settled_at: new Date().toISOString(), payment_status: 'paid' });
    const won = await this.claim(booking, `deposit:${pi}:released`, 'release', Number(booking.deposit_hold_amount) || 0, 'cancelled', pi);
    if (won) this.emit('rental_deposit_released', booking, { amount: Number(booking.deposit_hold_amount) || 0 });
  }

  private async captureDeposit(booking: any, pi: string, quote: ReturnType<typeof priceChargeAtPickupSettlement>): Promise<void> {
    await this.stripe.capturePaymentIntent(pi, depositCaptureKey(booking.id, quote.capture), {
      amount: quote.capture,
      currency: booking.currency,
    });
    await this.ledgerAmount(booking, quote.capture, 'deposit-capture', 'Deposit capture');
    await this.patch(booking.id, {
      deposit_settled_at: new Date().toISOString(),
      payment_status: 'paid',
      overtime_amount: quote.overtimeTaken,
    });
    this.emit('rental_deposit_captured', booking, { amount: quote.capture, invoice: quote.invoice });
  }

  private async invoiceRemainder(booking: any, quote: ReturnType<typeof priceChargeAtPickupSettlement>): Promise<void> {
    const won = await this.claim(booking, `remainder:${booking.id}:invoiced`, 'remainder_invoice', quote.invoice, 'invoiced', null);
    if (!won) return;
    await this.patch(booking.id, {
      remainder_amount: quote.invoice,
      remainder_status: 'invoiced',
      remainder_overtime_covered: quote.overtimeTaken,
      remainder_damage_covered: quote.damageTaken,
      remainder_invoiced_at: new Date().toISOString(),
    });
    this.emit('rental_remainder_invoiced', booking, { amount: quote.invoice });
    await this.notifyRemainder(booking, quote);
  }

  async payRemainder(booking: any): Promise<{ clientSecret: string | null; checkoutUrl: string | null }> {
    const amount = Number(booking.remainder_amount) || 0;
    if (booking.remainder_status === 'paid' || amount <= 0) return { clientSecret: null, checkoutUrl: null };
    const customerId = await this.ensureCustomer(booking);
    const intent = await this.stripe.createOffSessionPaymentIntent({
      amount,
      currency: booking.currency,
      customerId,
      paymentMethodId: booking.stripe_payment_method_id,
      description: `Rental ${booking.booking_number} remainder`,
      captureMethod: 'automatic',
      idempotencyKey: remainderKey(booking.id),
      metadata: this.meta(booking, 'remainder'),
      offSession: false,
    });
    await this.recordPaymentRow(booking, intent, 'remainder');
    await this.patch(booking.id, { remainder_payment_intent_id: intent.id });
    if (classifyIntent(intent.status) === 'succeeded') await this.onRemainderPaid(this.fakeTx(booking, intent, amount));
    return { clientSecret: intent.client_secret, checkoutUrl: null };
  }

  private async sweepRenewals(now: Date): Promise<void> {
    const rows = await this.dueRenewals(new Date(now.getTime() + RENEW_LEAD_MS).toISOString());
    for (const row of rows) await this.renewOne(row, now);
  }

  private async renewOne(booking: any, now: Date): Promise<void> {
    const fresh = await this.load(booking.id);
    if (!fresh?.deposit_capture_before || fresh.deposit_settled_at) return;
    const created = await this.renewalIntent(fresh);
    const plan = decideDepositRenewal({
      captureBefore: new Date(fresh.deposit_capture_before),
      now,
      newHold: this.renewalHold(created?.status),
      firstFailureAt: fresh.deposit_renewal_failed_at ? new Date(fresh.deposit_renewal_failed_at) : null,
      escalated: !!fresh.deposit_renewal_escalated_at,
    });
    await this.applyRenewal(fresh, plan, created);
  }

  private async renewalIntent(booking: any): Promise<Stripe.PaymentIntent | null> {
    const existing = await this.retrieveRenewal(booking);
    if (existing && classifyIntent(existing.status) !== 'failed') return existing;
    if (!booking.stripe_payment_method_id) return existing;
    return this.createRenewal(booking);
  }

  private async retrieveRenewal(booking: any): Promise<Stripe.PaymentIntent | null> {
    if (!booking.renewal_payment_intent_id) return null;
    if (Number(booking.renewal_intent_attempt) !== Number(booking.deposit_renewal_attempt)) return null;
    return this.stripe.retrieveExpandedPaymentIntent(booking.renewal_payment_intent_id);
  }

  private async createRenewal(booking: any): Promise<Stripe.PaymentIntent> {
    const attempt = Number(booking.deposit_renewal_attempt) || 0;
    const intent = await this.stripe.createOffSessionPaymentIntent({
      amount: Number(booking.deposit_hold_amount ?? booking.security_deposit_amount) || 0,
      currency: booking.currency,
      customerId: booking.stripe_customer_id,
      paymentMethodId: booking.stripe_payment_method_id,
      description: `Rental ${booking.booking_number} deposit renewal`,
      captureMethod: 'manual',
      extendedAuthorization: true,
      idempotencyKey: renewalKey(booking.id, booking.deposit_capture_before, attempt),
      metadata: this.meta(booking, 'deposit_renewal'),
    });
    await this.patch(booking.id, { renewal_payment_intent_id: intent.id, renewal_intent_attempt: attempt });
    return intent;
  }

  private async applyRenewal(booking: any, plan: ReturnType<typeof decideDepositRenewal>, intent: Stripe.PaymentIntent | null): Promise<void> {
    if (plan.type === 'renewed' && intent) return this.swapHold(booking, intent);
    if (plan.type === 'needs_action' || plan.type === 'failed_keep_old') return this.keepOldHold(booking, plan.type, intent);
    if (plan.type === 'escalate') return this.escalateRenewal(booking);
  }

  private async swapHold(booking: any, intent: Stripe.PaymentIntent): Promise<void> {
    const previous = booking.deposit_capture_before as string;
    const next = await this.captureBefore(intent);
    const oldId = booking.deposit_payment_intent_id as string;
    await this.stripe.cancelPaymentIntent(oldId, depositCancelKey(oldId));
    await this.patch(booking.id, {
      deposit_payment_intent_id: intent.id,
      deposit_capture_before: next,
      renewal_payment_intent_id: null,
      deposit_renewal_status: 'succeeded',
      deposit_renewal_failed_at: null,
    });
    this.emit('rental_deposit_renewal_succeeded', booking, { previousCaptureBefore: previous, newCaptureBefore: next });
  }

  private async keepOldHold(booking: any, type: string, intent: Stripe.PaymentIntent | null): Promise<void> {
    const status = type === 'needs_action' ? 'needs_action' : 'failed';
    const counted = Number(booking.renewal_intent_attempt) !== Number(booking.deposit_renewal_attempt);
    const bump = status === 'failed' && !counted ? 1 : 0;
    const first = booking.deposit_renewal_status !== status;
    await this.patch(booking.id, {
      deposit_renewal_status: status,
      deposit_renewal_reason: intent?.last_payment_error?.code ?? type,
      deposit_renewal_failed_at: booking.deposit_renewal_failed_at ?? new Date().toISOString(),
      deposit_renewal_attempt: Number(booking.deposit_renewal_attempt || 0) + bump,
    });
    this.emit('rental_deposit_renewal_failed', booking, { reason: type, captureBefore: booking.deposit_capture_before });
    if (first) await this.notifyRenewalFailed(booking);
  }

  private async escalateRenewal(booking: any): Promise<void> {
    if (booking.deposit_renewal_escalated_at) return;
    const when = new Date().toISOString();
    await this.patch(booking.id, { deposit_renewal_status: 'escalated', deposit_renewal_escalated_at: when });
    await this.openSupportAlert(booking, 'deposit_renewal', this.supportRenewalCopy(booking));
    this.emit('rental_deposit_renewal_escalated', booking, { captureBefore: booking.deposit_capture_before });
  }

  private async sweepUnsavedCards(now: Date): Promise<void> {
    const rows = await this.queryBookings(UNSAVED_CARD_QUERY, { now: now.toISOString() });
    for (const row of rows) await this.expireUnsaved(row.id);
  }

  private async expireUnsaved(bookingId: string): Promise<void> {
    const booking = await this.load(bookingId);
    if (!booking || booking.card_saved_at || booking.status !== 'reserved') return;
    const won = await this.casCancel(bookingId);
    if (!won) return;
    this.emit('rental_cancelled_before_pickup', booking, { reason: 'card_not_saved' });
  }

  private async sweepRemainders(now: Date): Promise<void> {
    const rows = await this.queryBookings(REMAINDER_QUERY, {});
    for (const row of rows) await this.advanceRemainder(row, now);
  }

  private async advanceRemainder(booking: any, now: Date): Promise<void> {
    const invoiced = booking.remainder_invoiced_at ? new Date(booking.remainder_invoiced_at).getTime() : now.getTime();
    const age = now.getTime() - invoiced;
    if (age >= REMAINDER_OVERDUE_MS && booking.remainder_status !== 'overdue') {
      await this.markRemainderOverdue(booking);
      return;
    }
    if (age >= REMAINDER_REMIND_MS && !booking.remainder_reminded_at) await this.remindRemainder(booking);
  }

  private async markRemainderOverdue(booking: any): Promise<void> {
    await this.patch(booking.id, { remainder_status: 'overdue' });
    await this.openSupportAlert(booking, 'remainder_overdue', `Remainder ${booking.remainder_amount} ${booking.currency} is overdue for ${booking.booking_number}.`);
    this.emit('rental_remainder_overdue', booking, { amount: Number(booking.remainder_amount) || 0 });
  }

  private async remindRemainder(booking: any): Promise<void> {
    await this.patch(booking.id, { remainder_reminded_at: new Date().toISOString() });
    await this.pushUser(booking.client?.user_id, booking, 'Pay the remaining balance on your rental.');
  }

  private async webhookLeg(tx: StripePaymentTransaction, leg: string, status: string): Promise<void> {
    const booking = await this.bookingForTx(tx);
    if (!booking) return;
    const won = await this.claim(booking, `${leg}:${tx.stripe_payment_intent_id}:${status}`, leg, tx.amount, status, tx.stripe_payment_intent_id);
    if (!won) return;
    if (leg === 'contract') await this.ledgerAmount(booking, tx.amount, 'pickup-contract', 'Pickup contract');
  }

  private async voidOpenPickupIntents(booking: any): Promise<void> {
    const ids = [booking.contract_payment_intent_id, booking.deposit_payment_intent_id].filter(Boolean);
    for (const id of ids) {
      try {
        const pi = await this.stripe.retrievePaymentIntent(id);
        if (pi.status === 'requires_capture' || pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
          await this.stripe.cancelPaymentIntent(id, depositCancelKey(id));
        }
      } catch (error: any) {
        this.logger.warn(`void pickup intent ${id}: ${error?.message ?? error}`);
      }
    }
  }

  private async captureBeforeFromId(id: string | undefined): Promise<string | null> {
    if (!id) return null;
    return this.captureBefore(await this.stripe.retrieveExpandedPaymentIntent(id));
  }

  private async captureBefore(intent: Stripe.PaymentIntent): Promise<string | null> {
    const full = intent.latest_charge ? intent : await this.stripe.retrieveExpandedPaymentIntent(intent.id);
    const charge = full.latest_charge;
    if (!charge || typeof charge === 'string') return null;
    return readCaptureBeforeIso(charge.payment_method_details?.card?.capture_before);
  }

  private async ledgerAmount(booking: any, amount: number, leg: string, label: string): Promise<void> {
    if (amount <= 0) return;
    const client = await this.accountsId(booking.client.user_id, booking.currency);
    const business = await this.businessAccount(booking);
    await this.credit(client, amount, booking.id, `${leg}:credit`, `Stripe rental ${label} ${booking.id}`);
    await this.debit(client, amount, booking.id, `${leg}:payment`, `Rental ${label} ${booking.id}`);
    await this.credit(business, amount, booking.id, `${leg}:proceeds`, `Rental ${label} proceeds ${booking.id}`);
  }

  private async reverseContractLedger(booking: any): Promise<void> {
    const amount = Number(booking.total_amount);
    const client = await this.accountsId(booking.client.user_id, booking.currency);
    const business = await this.businessAccount(booking);
    await this.debit(business, amount, booking.id, 'pickup-contract:refund-proceeds', `Refund rental contract ${booking.id}`);
    await this.credit(client, amount, booking.id, 'pickup-contract:refund-payment', `Refund rental contract ${booking.id}`);
    await this.debit(client, amount, booking.id, 'pickup-contract:refund-credit', `Refund rental contract ${booking.id}`);
  }

  private async credit(accountId: string, amount: number, bookingId: string, leg: string, memo: string): Promise<void> {
    const result = await this.accounts.registerTransaction({
      accountId,
      amount,
      transactionType: 'deposit',
      memo,
      referenceId: bookingId,
      idempotencyKey: rentalLedgerKey(bookingId, leg),
    });
    assertLedgerResult(result, leg);
  }

  private async debit(accountId: string, amount: number, bookingId: string, leg: string, memo: string): Promise<void> {
    const result = await this.accounts.registerTransaction({
      accountId,
      amount,
      transactionType: 'payment',
      memo,
      referenceId: bookingId,
      idempotencyKey: rentalLedgerKey(bookingId, leg),
    });
    assertLedgerResult(result, leg);
  }

  private async accountsId(userId: string, currency: string): Promise<string> {
    const account = await this.hasura.getAccount(userId, currency);
    if (!account?.id) throw new Error('Client account missing');
    return account.id;
  }

  private async businessAccount(booking: any): Promise<string> {
    const locId = booking.rental_location_listing?.business_location_id;
    const account = await this.hasura.ensureAccountForBusinessLocation(locId);
    if (!account?.id) throw new Error('Business account missing');
    return account.id;
  }

  private async recordPaymentRow(booking: any, intent: Stripe.PaymentIntent, leg: string): Promise<void> {
    const reference = `${leg}_${intent.id}`.slice(0, 40);
    const existing = await this.payments.getTransactionByPaymentIntentId(intent.id);
    if (existing) return;
    const row = await this.payments.createTransaction({
      reference,
      amount: this.major(intent),
      currency: booking.currency,
      description: intent.description ?? leg,
      transaction_type: 'PAYMENT',
      payment_entity: this.entityFor(leg),
      entity_id: booking.booking_number,
      capture_method: intent.capture_method === 'manual' ? 'manual' : 'automatic',
    });
    await this.payments.updateTransaction(row.id, { stripe_payment_intent_id: intent.id });
  }

  private entityFor(leg: string): 'rental_pickup_contract' | 'rental_deposit' | 'rental_remainder' {
    if (leg === 'deposit' || leg === 'deposit_renewal') return 'rental_deposit';
    if (leg === 'remainder') return 'rental_remainder';
    return 'rental_pickup_contract';
  }

  private async claim(booking: any, eventKey: string, leg: string, amount: number, status: string, stripeId?: string | null): Promise<boolean> {
    try {
      const res = await this.hasura.executeMutation<{ insert_rental_card_money_events_one: { id: string } | null }>(
        `mutation ClaimCardEvent($object: rental_card_money_events_insert_input!) {
          insert_rental_card_money_events_one(object: $object) { id }
        }`,
        { object: { booking_id: booking.id, event_key: eventKey, leg, amount, currency: booking.currency, status, stripe_id: stripeId ?? null } }
      );
      return !!res.insert_rental_card_money_events_one?.id;
    } catch (error: any) {
      if (this.duplicate(error)) return false;
      throw error;
    }
  }

  private async patch(id: string, set: Record<string, unknown>): Promise<void> {
    await this.hasura.executeMutation(
      `mutation PatchChargeAtPickup($id: uuid!, $set: rental_bookings_set_input!) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id, set }
    );
  }

  private async load(id: string): Promise<any | null> {
    const res = await this.hasura.executeQuery<{ rental_bookings_by_pk: any }>(BOOKING_QUERY, { id });
    return res.rental_bookings_by_pk ?? null;
  }

  private async bookingForTx(tx: StripePaymentTransaction): Promise<any | null> {
    const res = await this.hasura.executeQuery<{ rental_bookings: any[] }>(
      `query BookingByNumber($n: String!) { rental_bookings(where: { booking_number: { _eq: $n } }, limit: 1) { id } }`,
      { n: tx.entity_id }
    );
    const id = res.rental_bookings?.[0]?.id;
    return id ? this.load(id) : null;
  }

  private async dueRenewals(until: string): Promise<any[]> {
    return this.queryBookings(RENEWAL_QUERY, { until });
  }

  private async queryBookings(query: string, variables: Record<string, unknown>): Promise<any[]> {
    const res = await this.hasura.executeQuery<{ rental_bookings: any[] }>(query, variables);
    return res.rental_bookings ?? [];
  }

  private async casCancel(id: string): Promise<boolean> {
    const res = await this.hasura.executeMutation<{ update_rental_bookings: { affected_rows: number } }>(
      `mutation CancelUnsavedCard($id: uuid!) {
        update_rental_bookings(where: { id: { _eq: $id }, status: { _eq: reserved }, card_saved_at: { _is_null: true } }, _set: { status: cancelled, payment_status: cancelled, contract_expires_at: null }) { affected_rows }
      }`,
      { id }
    );
    return (res.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async openSupportAlert(booking: any, kind: string, message: string): Promise<void> {
    try {
      await this.hasura.executeMutation(
        `mutation Alert($object: rental_support_alerts_insert_input!) {
          insert_rental_support_alerts_one(object: $object) { id }
        }`,
        { object: { booking_id: booking.id, kind, message } }
      );
    } catch (error: any) {
      if (!this.duplicate(error)) this.logger.warn(`support alert: ${error?.message ?? error}`);
    }
    await this.notifications.sendRentalSupportAlert({ subject: kind, body: message, bookingId: booking.id });
  }

  private async notifyRenewalFailed(booking: any): Promise<void> {
    const amount = this.money(booking.deposit_hold_amount ?? booking.security_deposit_amount, booking.currency);
    await this.pushUser(booking.client?.user_id, booking, `Update your card to renew the ${amount} deposit hold. Your rental continues. Support has been notified.`);
    await this.pushUser(booking.business?.user_id, booking, 'The deposit hold could not be renewed. Support is following up. The rental continues.');
  }

  private async notifyRemainder(booking: any, quote: { invoice: number }): Promise<void> {
    await this.pushUser(booking.client?.user_id, booking, `Pay ${this.money(quote.invoice, booking.currency)}`);
    await this.pushUser(booking.business?.user_id, booking, `A remainder of ${this.money(quote.invoice, booking.currency)} has been invoiced to the renter.`);
  }

  private async pushUser(userId: string | undefined, booking: any, body: string): Promise<void> {
    if (!userId) return;
    try {
      await this.notifications.sendRentalCardPickupPush({ userId, bookingId: booking.id, body });
    } catch (error: any) {
      this.logger.warn(`push: ${error?.message ?? error}`);
    }
  }

  private supportRenewalCopy(booking: any): string {
    return `Deposit renewal failed for booking ${booking.booking_number}. The rental continues. The current hold expired on ${booking.deposit_capture_before}. Contact the renter to update the card.`;
  }

  private emit(event: SiteEventTypeV1, booking: any, extra: Record<string, unknown>): void {
    emitServerSiteEvent(this.siteEvents, event, {
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      country: booking.country_code ?? null,
      rail: 'stripe',
      flag: CHARGE_AT_PICKUP_FLAG,
      ...extra,
    });
  }

  private emitLongStay(booking: any): void {
    const end = new Date(booking.end_at).getTime();
    const booked = new Date(booking.created_at ?? Date.now()).getTime();
    const review = 72 * 3600000;
    if (end + review <= booked + 6 * 86400000) return;
    this.emit('rental_long_stay_started', booking, {});
  }

  private renewalHold(status: string | undefined): 'succeeded' | 'failed' | 'requires_action' | 'not_attempted' {
    const state = classifyIntent(status);
    if (state === 'requires_capture' || state === 'succeeded') return 'succeeded';
    if (state === 'requires_action') return 'requires_action';
    if (state === 'absent') return 'not_attempted';
    return 'failed';
  }

  private attempt(booking: any): number {
    return Number(booking.pickup_charge_attempt) || 0;
  }

  private meta(booking: any, purpose: string): Record<string, string> {
    return { bookingId: booking.id, bookingNumber: booking.booking_number ?? '', purpose, reference: `${purpose}_${booking.id}` };
  }

  private major(intent: Stripe.PaymentIntent): number {
    const zero = new Set(['xaf', 'xof', 'jpy', 'krw', 'vnd', 'clp']);
    if (zero.has(intent.currency)) return intent.amount;
    return intent.amount / 100;
  }

  private fakeTx(booking: any, intent: Stripe.PaymentIntent, amount: number): StripePaymentTransaction {
    return {
      id: intent.id,
      reference: intent.id,
      amount,
      currency: booking.currency,
      status: 'success',
      transaction_type: 'PAYMENT',
      entity_id: booking.booking_number,
      stripe_payment_intent_id: intent.id,
      payment_entity: 'rental_remainder',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private duplicate(error: any): boolean {
    const text = `${error?.message ?? ''} ${JSON.stringify(error?.response ?? '')}`;
    return text.includes('Uniqueness violation') || text.includes('unique');
  }

  private money(amount: number, currency: string): string {
    const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(amount) || 0).replace(/\u202f/g, ' ');
    return currency === 'XAF' || currency === 'XOF' ? `${formatted} FCFA` : `${formatted} ${currency}`;
  }
}

const FLAG_QUERY = `query ChargeAtPickupFlag($key: String!) {
  application_configurations(where: { config_key: { _eq: $key }, country_code: { _is_null: true }, status: { _eq: "active" } }, limit: 1) { boolean_value }
}`;

const BOOKING_QUERY = `query ChargeAtPickupBooking($id: uuid!) {
  rental_bookings_by_pk(id: $id) {
    id booking_number status currency total_amount security_deposit_amount payment_status payment_timing
    card_payment_mode stripe_setup_intent_id stripe_customer_id stripe_payment_method_id card_brand card_last4 card_saved_at
    contract_payment_intent_id deposit_payment_intent_id deposit_capture_before deposit_hold_amount deposit_settled_at
    deposit_renewal_status deposit_renewal_attempt deposit_renewal_failed_at deposit_renewal_escalated_at
    renewal_payment_intent_id renewal_intent_attempt pickup_charge_attempt charged_attempt
    pickup_payment_failure_code remainder_amount remainder_status remainder_invoiced_at remainder_reminded_at
    contract_expires_at start_at end_at created_at actual_start_at inspection_policy_version
    client { user_id user { email } }
    business { user_id }
    rental_location_listing { business_location_id business_location { address { country } } }
  }
}`;

const RENEWAL_QUERY = `query DueDepositRenewals($until: timestamptz!) {
  rental_bookings(where: {
    card_payment_mode: { _eq: "charge_at_pickup" }
    deposit_settled_at: { _is_null: true }
    deposit_payment_intent_id: { _is_null: false }
    deposit_capture_before: { _lte: $until }
    status: { _in: [active, awaiting_return] }
  }) { id }
}`;

const UNSAVED_CARD_QUERY = `query UnsavedCardReservations($now: timestamptz!) {
  rental_bookings(where: {
    card_payment_mode: { _eq: "charge_at_pickup" }
    status: { _eq: reserved }
    card_saved_at: { _is_null: true }
    contract_expires_at: { _lt: $now }
  }) { id }
}`;

const REMAINDER_QUERY = `query OpenRemainders {
  rental_bookings(where: { remainder_status: { _in: ["invoiced", "overdue"] } }) { id }
}`;
