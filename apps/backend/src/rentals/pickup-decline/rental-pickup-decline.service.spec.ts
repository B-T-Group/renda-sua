import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { HttpException } from '@nestjs/common';
import { consumeHoldForPayout, creditFailedPayout, stableRefundReference, type DeclineWallet } from './pickup-decline.money';
import { PENDING_REFUNDS, RENTER_NOTICE_RETRIES } from './pickup-decline.queries';
import { RentalPickupDeclineService } from './rental-pickup-decline.service';

const BOOKING = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const CLIENT = '33333333-3333-4333-8333-333333333333';

function booking(over: Record<string, unknown> = {}) {
  return {
    id: BOOKING,
    booking_number: 'RB-25496310',
    status: 'reserved',
    payment_status: 'authorized',
    contract_expires_at: '2026-11-20T00:00:00.000Z',
    actual_start_at: null,
    inspection_policy_version: 1,
    pickup_current_version_id: VERSION,
    condition_declined_at: null,
    refund_status: 'none',
    refund_provider: null,
    refund_provider_ref: null,
    refund_list_empty_at: null as string | null,
    refund_unknown_streak: 0,
    refund_unknown_notice_at: null as string | null,
    authorized_amount: 0,
    total_amount: 250,
    currency: 'XAF',
    client_id: CLIENT,
    business_id: 'biz',
    client: { user_id: 'user-1', user: { first_name: 'Marie', last_name: 'K' } },
    business: { user_id: 'biz-user' },
    rental_location_listing: {
      business_location: { address: { country: 'CM' } },
      rental_item: { name: 'JBL PartyBox 310' },
    },
    ...over,
  };
}

function harness(options: {
  booking?: Record<string, unknown>;
  user?: Record<string, unknown>;
  flag?: boolean;
  cas?: 'win' | 'lose';
  collects?: Array<Record<string, unknown>>;
  hold?: number;
  releaseThrows?: boolean;
  refund?: {
    status: string;
    providerRef: string | null;
    unsupported: boolean;
    provider: string;
    unsent?: boolean;
    connectFailure?: boolean;
    blankRef?: boolean;
    limited?: boolean;
  };
  refundFor?: (request: { creditAged?: boolean; beforeProviderSend?: () => Promise<boolean> }) => {
    status: string;
    providerRef: string | null;
    unsupported: boolean;
    provider: string;
    blankRef?: boolean;
    limited?: boolean;
  };
  refundThrows?: boolean;
  declines?: Array<Record<string, unknown>>;
  pending?: Array<Record<string, unknown>>;
  refunds?: boolean;
  insertFails?: number;
  historyFails?: number;
  superuser?: boolean;
  permissions?: string[];
  external?: 'missing' | 'unknown' | 'refunded' | 'refund_pending' | 'failed';
  fedapayExternal?: { kind: 'unknown' | 'missing' | 'live'; status: string | null; id: string | null; provableEmpty?: boolean; limited?: boolean };
  pinFails?: number;
  claimLoses?: boolean;
  duringClaim?: (row: Record<string, unknown>) => void;
  afterClaim?: (row: Record<string, unknown>) => void;
  stampFails?: boolean;
  stealClaim?: boolean;
  dropOwnedWrite?: boolean;
  noticeFails?: boolean;
  noticeOk?: boolean;
  fedapayMinutes?: Record<string, number>;
  renterFails?: boolean;
  poll?: 'refunded' | 'failed' | 'refund_pending' | 'missing' | 'unknown';
  probeFor?: (ref: string) => 'refunded' | 'failed' | 'refund_pending' | 'missing' | 'unknown';
  noticeRetries?: Array<Record<string, unknown>>;
  consumeRace?: 'applied' | 'hidden' | 'fail';
  guardFieldMissing?: boolean;
} = {}) {
  const state = booking(options.booking);
  const declines = [...(options.declines ?? [])];
  let insertFails = options.insertFails ?? 0;
  let historyFails = options.historyFails ?? 0;
  let pinFails = options.pinFails ?? 0;
  let restoreFails = options.restoreThrows ? 1 : 0;
  const notes = new Set<string>();
  const historyNotes: string[] = [];
  const wallet: DeclineWallet = { available: 0, withheld: options.hold ?? 0 };
  const calls = {
    release: 0,
    consume: 0,
    restore: 0,
    pending: 0,
    history: 0,
    notice: 0,
    refund: [] as unknown[],
    steps: [] as string[],
    support: 0,
    supportPayload: null as { outcome?: string; externalId?: string; walletCredited?: boolean } | null,
    renter: [] as Array<{ landed?: string; amount?: number; currency?: string; bookingId?: string }>,
    cas: 0,
    claimAtSend: null as string | null,
    debited: 0,
    removed: 0,
    plainClose: 0,
    pins: 0,
  };
  const hasura = {
    executeQuery: jest.fn(async (query: string, vars?: { key?: string }) => {
      if (query.includes('FedapayRefundConfig')) {
        const value = options.fedapayMinutes?.[vars?.key ?? ''];
        return { application_configurations: value == null ? [] : [{ number_value: value }] };
      }
      if (query.includes('DeclineRefundAccount')) return { accounts: [{ id: 'account-1' }] };
      if (query.includes('DeclineBooking')) return { rental_bookings_by_pk: { ...state, client: state.client, business: state.business } };
      if (query.includes('FindConditionDecline') || query.includes('FindDeclineForBooking')) {
        return { rental_condition_declines: declines };
      }
      if (query.includes('DeclineCollects')) return { mobile_payment_transactions: options.collects ?? [] };
      if (query.includes('PendingDeclineRefunds')) return { rental_bookings: options.pending ?? [] };
      if (query.includes('DeclineRenterNoticeRetries')) return { rental_bookings: openNoticeRetries() };
      if (query.includes('DeclineHold')) {
        return { rental_holds: options.hold ? [{ client_hold_amount: options.hold, status: 'active' }] : [] };
      }
      if (query.includes('DeclineReadyPhotos')) return { rental_condition_decline_photos: [] };
      if (query.includes('DeclineHistoryNote')) {
        return { rental_status_history: notes.has('Renter declined the pickup condition') ? [{ id: 'h' }] : [] };
      }
      return {};
    }),
    executeMutation: jest.fn(async (query: string, vars: { from?: string[]; set?: Record<string, unknown>; object?: Record<string, unknown>; versionId?: string }) => {
      if (query.includes('InsertRentalStatusHistory')) calls.history += 1;
      if (query.includes('CancelPendingDeclineCollects')) {
        calls.pending += 1;
        return { update_mobile_payment_transactions: { affected_rows: 1 } };
      }
      if (query.includes('CasUpdateRentalBooking') || query.includes('DeclineCancelBooking')) {
        if (vars.versionId && vars.versionId !== state.pickup_current_version_id) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        calls.cas += 1;
        if (options.cas === 'lose' && calls.cas === 1) {
          state.status = 'active';
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        if (!vars.from?.includes(state.status)) return { update_rental_bookings: { affected_rows: 0 } };
        Object.assign(state, vars.set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('InsertConditionDecline')) {
        if (insertFails > 0) {
          insertFails -= 1;
          throw new Error('hasura 503');
        }
        const row = { id: 'decline-1', ...(vars.object ?? {}), effects_recorded_at: null };
        declines.push(row);
        return { insert_rental_condition_declines_one: { id: 'decline-1' } };
      }
      if (query.includes('ReleaseDeclineRefundClaim')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_claim_token = null;
        row.refund_claim_at = null;
        row.refund_attempts = (vars as { attempts?: number }).attempts;
        row.refund_next_at = (vars as { nextAt?: string | null }).nextAt ?? null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClaimDeclineRefund')) {
        const row = refundRow((vars as { id?: string }).id);
        options.duringClaim?.(row);
        const attempts = Number(row.refund_attempts ?? 0);
        const same = attempts === (vars as { attempts?: number }).attempts;
        if (options.claimLoses || row.refund_status !== 'refund_pending' || !same) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        Object.assign(row, vars.set);
        options.afterClaim?.(row);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('KeepDeclineRefundClaim')) {
        const row = refundRow((vars as { id?: string }).id);
        const token = (vars as { token?: string }).token;
        if (options.stealClaim || row.refund_claim_token !== token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ApplyOwnedDeclineRefund')) {
        const row = refundRow((vars as { id?: string }).id);
        const token = (vars as { token?: string }).token;
        if (options.dropOwnedWrite || row.refund_claim_token !== token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        Object.assign(row, vars.set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('RestoreDeclineRefundAttempt')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_attempts = (vars as { attempts?: number }).attempts;
        row.refund_next_at = (vars as { next?: string }).next;
        row.refund_unknown_streak = (vars as { streak?: number }).streak;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('StampDeclineListEmpty')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token || row.refund_list_empty_at) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_list_empty_at = (vars as { at?: string }).at;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClearDeclineListEmpty')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_list_empty_at = null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('StampDeclineUnknownNotice')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_unknown_notice_at = (vars as { at?: string }).at;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ScheduleDeclineRefundPoll')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_next_at = (vars as { next?: string }).next;
        row.refund_unknown_streak = 0;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('BumpDeclineSendAttempt')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_send_attempted_at = (vars as { at?: string }).at;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('StampDeclineSendAttempt')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        if (row.refund_send_attempted_at) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_send_attempted_at = (vars as { at?: string }).at;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClearDeclineSendAttempt')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_send_attempted_at = null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('close_decline_refund')) {
        if (options.guardFieldMissing && query.includes('$guardOpen')) {
          throw new Error("field 'p_guard_open' not found in type: 'close_decline_refund_args'");
        }
        if (!query.includes('$guardOpen')) calls.plainClose += 1;
        if (historyFails > 0) {
          historyFails -= 1;
          throw new Error('history fk');
        }
        const row = refundRow((vars as { id?: string }).id);
        const token = (vars as { token?: string }).token;
        if (options.dropOwnedWrite || row.refund_claim_token !== token) return { close_decline_refund: [] };
        if ((vars as { guardOpen?: boolean }).guardOpen) {
          const stamp = (row.refund_send_attempted_at as string | null) ?? null;
          const expected = (vars as { sendAttemptedAt?: string | null }).sendAttemptedAt ?? null;
          if (row.refund_provider_ref || stamp !== expected) return { close_decline_refund: [] };
        }
        const pay = Number((vars as { amount?: number }).amount ?? 0);
        Object.assign(row, {
          refund_status: (vars as { status?: string }).status,
          refund_claim_token: null,
          refund_claim_at: null,
          refund_provider_ref: (vars as { providerRef?: string | null }).providerRef || row.refund_provider_ref,
          refund_credited_at: pay > 0 ? new Date().toISOString() : row.refund_credited_at,
        });
        historyNotes.push(String((vars as { notes?: string }).notes ?? ''));
        calls.history += 1;
        if (pay > 0) {
          calls.restore += 1;
          const next = creditFailedPayout(wallet, pay);
          wallet.available = next.available;
          wallet.withheld = next.withheld;
        }
        return { close_decline_refund: [{ id: row.id }] };
      }
      if (query.includes('StampDeclineRefundSent')) {
        if (options.stampFails) return { update_rental_bookings: { affected_rows: 0 } };
        const row = refundRow((vars as { id?: string }).id);
        const token = (vars as { token?: string }).token;
        const ref = (vars as { ref?: string }).ref;
        const existing = row.refund_provider_ref as string | null | undefined;
        if (row.refund_claim_token !== token || row.refund_sent_at) return { update_rental_bookings: { affected_rows: 0 } };
        if (existing && ref && existing !== ref) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_sent_at = (vars as { at?: string }).at;
        if (ref) row.refund_provider_ref = ref;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('KeepDeclineProviderRef')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_provider_ref !== (vars as { stableRef?: string }).stableRef) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_provider_ref = (vars as { ref?: string }).ref ?? null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ReleaseDeclineRefundNotice')) {
        const row = refundRow((vars as { id?: string }).id);
        const outcome = String((vars as { outcome?: string }).outcome ?? '');
        const notices = (row.refund_notices as string[] | undefined) ?? [];
        row.refund_notices = notices.filter((item) => item !== outcome);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClearDeclineStableRef')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        if (row.refund_provider_ref === (vars as { stableRef?: string }).stableRef) row.refund_provider_ref = null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClearDeclineRefundSent')) {
        const row = refundRow((vars as { id?: string }).id);
        if (row.refund_claim_token !== (vars as { token?: string }).token) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        row.refund_sent_at = null;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('MarkDeclineWalletCredit')) {
        const row = refundRow((vars as { id?: string }).id);
        row.refund_credited_at = (vars as { at?: string }).at;
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('NoteDeclineRefundOnce')) {
        const row = refundRow((vars as { id?: string }).id);
        const raw = (vars as { outcome?: string | string[] }).outcome;
        const outcome = Array.isArray(raw) ? raw[0] : raw ?? '';
        const notices = (row.refund_notices as string[] | undefined) ?? [];
        if (notices.includes(outcome)) return { update_rental_bookings: { affected_rows: 0 } };
        row.refund_notices = [...notices, outcome];
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('ClaimDeclineEffects')) {
        const row = declines[0] as { effects_recorded_at?: string | null } | undefined;
        if (!row || row.effects_recorded_at) return { update_rental_condition_declines: { affected_rows: 0 } };
        row.effects_recorded_at = (vars as { at?: string }).at ?? new Date().toISOString();
        return { update_rental_condition_declines: { affected_rows: 1 } };
      }
      if (query.includes('ClearDeclineEffects')) {
        const row = declines[0] as { effects_recorded_at?: string | null } | undefined;
        if (row) row.effects_recorded_at = null;
        return { update_rental_condition_declines_by_pk: { id: 'decline-1' } };
      }
      if (query.includes('StampDeclineRefund') || query.includes('ApplyDeclineRefundPoll')) {
        Object.assign(refundRow((vars as { id?: string }).id), vars.set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query.includes('InsertRentalStatusHistory') && historyFails > 0) {
        historyFails -= 1;
        throw new Error('history fk');
      }
      if (query.includes('InsertRentalStatusHistory')) {
        const text = String((vars as { object?: { notes?: string } }).object?.notes ?? '');
        historyNotes.push(text);
        if (text === 'Renter declined the pickup condition') notes.add(text);
      }
      return { update_rental_bookings: { affected_rows: 1 }, insert_rental_status_history_one: { id: 'h' } };
    }),
  };
  const openNoticeRetries = () => (options.noticeRetries ?? []).filter((row) => {
    const notices = (row.refund_notices as string[] | undefined) ?? [];
    const open = notices.includes('renter_try:1') || notices.includes('renter_try:2');
    const exhausted = notices.includes('renter_try:3');
    return open && !exhausted && !notices.includes('renter_landed');
  }).sort((left, right) => String(left.refund_status_at ?? '').localeCompare(String(right.refund_status_at ?? '')));
  const refundRow = (id?: string) => {
    const pending = (options.pending ?? []).find((row) => row.id === id);
    return (pending as typeof state) ?? state;
  };
  const momo = {
    refund: jest.fn(async (request: unknown) => {
      calls.steps.push('refund');
      calls.refund.push(request);
      calls.claimAtSend = (state.refund_claim_token as string | null) ?? null;
      if (options.refundThrows) throw new Error('timeout');
      if (options.refundFor) return options.refundFor(request as { creditAged?: boolean });
      return options.refund ?? { status: 'refunded', provider: 'mtn', providerRef: 'ref-1', unsupported: false };
    }),
    poll: jest.fn(async () => options.poll ?? 'refund_pending'),
    probe: jest.fn(async (_provider: string, ref: string) => options.probeFor?.(ref) ?? options.poll ?? 'refund_pending'),
    probeByExternalId: jest.fn(async () => options.external ?? options.poll ?? 'refund_pending'),
    lookupFedapayExternal: jest.fn(async () => options.fedapayExternal ?? { kind: 'unknown', status: null, id: null, provableEmpty: false }),
    externalRefundId: (bookingId: string) => `rental-decline-${bookingId}`,
  };
  const revertUnpaid = (text: string, params?: unknown[]) => {
    if (!text.includes('blocked')) return [];
    const landed = calls.debited > 0 || Boolean(state.refund_provider_ref) || Boolean(state.refund_sent_at)
      || Boolean(state.refund_status && state.refund_status !== 'none');
    if (landed) return [];
    const declineId = (params?.[2] as string | null) ?? null;
    const index = declineId ? declines.findIndex((row) => row.id === declineId) : -1;
    if (declineId && index < 0) return [];
    if (index >= 0) {
      declines.splice(index, 1);
      calls.removed += 1;
    }
    if (declines.length > 0) return [];
    Object.assign(state, {
      status: params?.[3],
      payment_status: params?.[4],
      contract_expires_at: params?.[5],
      condition_declined_at: null,
    });
    return [{ id: state.id }];
  };
  const service = new RentalPickupDeclineService(
    hasura as never,
    { getUser: jest.fn(async () => options.user ?? { id: 'user-1', active_persona: 'client', client: { id: CLIENT } }) } as never,
    { pickupDeclineEnabled: jest.fn(async () => options.flag !== false) } as never,
    momo as never,
    { signedForDecline: jest.fn(async () => []) } as never,
    {
      sendConditionDeclinedNotice: jest.fn(async () => {
        calls.notice += 1;
      }),
      notifySupportConditionRefund: jest.fn(async (payload: { outcome?: string; externalId?: string; walletCredited?: boolean }) => {
        calls.support += 1;
        calls.supportPayload = payload;
        if (options.noticeFails) throw new Error('smtp down');
        return options.noticeOk !== false;
      }),
      notifyRenterConditionRefund: jest.fn(async (payload: { landed?: string; amount?: number; currency?: string }) => {
        calls.renter.push(payload);
        return options.renterFails ? false : true;
      }),
    } as never,
    {
      clearPinForOrder: jest.fn(async () => {
        calls.pins += 1;
        if (pinFails > 0) {
          pinFails -= 1;
          throw new Error('pin down');
        }
      }),
    } as never,
    {
      releaseFreeCancelFunds: jest.fn(async () => {
        calls.release += 1;
        if (options.releaseThrows) throw new Error('stripe void failed');
        wallet.available += wallet.withheld;
        wallet.withheld = 0;
      }),
      consumeDeclineHold: jest.fn(async (_booking: unknown, amount: number) => {
        calls.steps.push('consume');
        calls.consume += 1;
        if (options.consumeRace === 'applied' && calls.consume === 1) {
          calls.debited = 1;
          throw new HttpException('Insufficient funds for this transaction', 502);
        }
        if (options.consumeRace === 'hidden') {
          throw new HttpException('Insufficient funds for this transaction', 502);
        }
        if (options.consumeRace === 'fail') throw new HttpException('ledger down', 502);
        calls.debited = 1;
        const next = consumeHoldForPayout(wallet, amount);
        wallet.available = next.available;
        wallet.withheld = next.withheld;
      }),
      declineRefundDebited: jest.fn(async () => calls.debited > 0),
      restoreDeclinePayout: jest.fn(async (_booking: unknown, amount: number) => {
        calls.restore += 1;
        if (restoreFails > 0) {
          restoreFails -= 1;
          throw new Error('ledger down');
        }
        const next = creditFailedPayout(wallet, amount);
        wallet.available = next.available;
        wallet.withheld = next.withheld;
      }),
    } as never,
    {
      getEffectiveAccess: jest.fn(async () => ({
        isSuperuser: options.superuser ?? options.refunds !== false,
        permissions: options.permissions ?? [],
      })),
    } as never,
    {
      transaction: jest.fn(async (fn: (query: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) => {
        calls.steps.push('lock');
        const result = await fn(async () => []);
        calls.steps.push('unlock');
        return result;
      }),
      query: jest.fn(async (text: string, params?: unknown[]) => revertUnpaid(text, params)),
    } as never
  );
  return { service, state, calls, momo, hasura, wallet, historyNotes };
}

const input = { versionId: VERSION, reason: 'damaged' };

function collect() {
  return [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }];
}

async function refusedStamp(behindMs: number): Promise<number> {
  const run = harness({
    booking: openOverride(),
    external: 'missing',
    duringClaim: (row) => {
      row.refund_send_attempted_at = new Date(Date.now() - behindMs).toISOString();
    },
  });
  await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
    status: 409,
  });
  expect(run.calls.restore).toBe(0);
  expect(run.state.refund_status).toBe('refund_pending');
  expect(run.momo.probeByExternalId).not.toHaveBeenCalled();
  return run.calls.restore === 0 ? 1 : 2;
}

function openOverride() {
  return {
    status: 'cancelled',
    refund_status: 'refund_pending',
    refund_amount: 100,
    refund_provider: 'fedapay',
    refund_provider_ref: null,
    refund_sent_at: null,
    refund_attempts: 1,
    refund_send_attempted_at: null,
  };
}

async function overrideRace(mode: 'sent-blank' | 'created-unsent', external: 'missing' | 'unknown'): Promise<string> {
  let credits = 0;
  let closed = 0;
  let pending = 0;
  for (let i = 0; i < 8; i += 1) {
    const run = harness({
      booking: openOverride(),
      external,
      duringClaim: (row) => {
        row.refund_send_attempted_at = new Date(Date.now() + 5_000).toISOString();
        row.refund_provider_ref = null;
      },
    });
    try {
      await run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' });
      credits += 1;
    } catch (error: any) {
      void error;
    }
    if (run.state.refund_status === 'failed') closed += 1;
    if (run.state.refund_status === 'refund_pending') pending += 1;
  }
  const moneyOut = mode === 'sent-blank' && credits === 0 ? 1 : credits;
  return `${mode} credits=${credits} closed=${closed} pending=${pending} moneyOut=${moneyOut}`;
}

function pendingRefund(over: Record<string, unknown> = {}) {
  return {
    id: BOOKING,
    booking_number: 'RB-25496310',
    currency: 'XAF',
    status: 'cancelled',
    refund_status: 'refund_pending',
    refund_attempts: 0,
    refund_amount: 100,
    refund_provider: 'mtn',
    refund_provider_ref: 'mtn-ref',
    refund_list_empty_at: null as string | null,
    refund_unknown_streak: 0,
    refund_unknown_notice_at: null as string | null,
    refund_next_at: null as string | null,
    client: { user_id: 'user-1' },
    business: { user_id: 'biz-user' },
    rental_location_listing: { rental_item: { name: 'JBL PartyBox 310' } },
    ...over,
  };
}

describe('RentalPickupDeclineService', () => {
  it('is a no-op when the flag is off', async () => {
    const { service, calls } = harness({ flag: false });
    await expect(service.decline(BOOKING, input)).rejects.toBeInstanceOf(HttpException);
    expect(calls.cas).toBe(0);
    expect(calls.release).toBe(0);
    expect(calls.refund).toHaveLength(0);
  });

  it('rejects a business user and an uninspected booking', async () => {
    const business = harness({ user: { id: 'u', active_persona: 'business', business: { id: 'biz' } } });
    await expect(business.service.decline(BOOKING, input)).rejects.toMatchObject({ status: 403 });
    expect(business.calls.cas).toBe(0);
    const plain = harness({ booking: { inspection_policy_version: null } });
    await expect(plain.service.decline(BOOKING, input)).rejects.toMatchObject({ status: 400 });
    expect(plain.calls.release).toBe(0);
  });

  it('rejects a version mismatch and a lost race with start', async () => {
    const version = harness();
    await expect(version.service.decline(BOOKING, { ...input, versionId: '99999999-9999-4999-8999-999999999999' })).rejects.toMatchObject({ status: 409 });
    expect(version.calls.release).toBe(0);
    const race = harness({ cas: 'lose' });
    await expect(race.service.decline(BOOKING, input)).rejects.toMatchObject({ status: 409 });
    expect(race.calls.release).toBe(0);
    expect(race.calls.refund).toHaveLength(0);
  });

  it('reverts the cancel when the card void fails', async () => {
    const { service, state, calls } = harness({
      booking: { currency: 'CAD', authorized_amount: 65, total_amount: 65 },
      releaseThrows: true,
    });
    await expect(service.decline(BOOKING, input)).rejects.toThrow('stripe void failed');
    expect(state.status).toBe('reserved');
    expect(state.condition_declined_at).toBeNull();
    expect(calls.refund).toHaveLength(0);
  });

  it('voids a card hold and does not call a Mobile Money provider', async () => {
    const { service, calls } = harness({
      booking: { currency: 'CAD', authorized_amount: 65, total_amount: 65 },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.rail).toBe('card');
    expect(result.amount).toBe(65);
    expect(result.refundStatus).toBe('none');
    expect(calls.release).toBe(1);
    expect(calls.refund).toHaveLength(0);
  });

  it('releases a wallet hold', async () => {
    const { service, calls } = harness({
      booking: { currency: 'CAD', authorized_amount: 0, total_amount: 40 },
      hold: 40,
    });
    const result = await service.decline(BOOKING, input);
    expect(result.rail).toBe('wallet');
    expect(result.amount).toBe(40);
    expect(calls.release).toBe(1);
  });

  it('consumes the wallet hold once and pays the collected amount to the phone', async () => {
    const { service, calls, wallet } = harness({
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx', payment_method: 'mtn' }],
    });
    const result = await service.decline(BOOKING, input);
    expect(result.rail).toBe('momo_paid');
    expect(result.amount).toBe(100);
    expect(result.refundStatus).toBe('refunded');
    expect(calls.release).toBe(0);
    expect(calls.consume).toBe(1);
    expect(calls.restore).toBe(0);
    expect(calls.pending).toBe(1);
    expect(wallet.withheld).toBe(0);
    expect(wallet.available).toBe(0);
    expect(wallet.available + (calls.refund[0] as { amount: number }).amount).toBe(100);
    expect(calls.notice).toBe(1);
    expect(calls.history).toBe(1);
  });

  it('keeps one debit when five declines run together', async () => {
    const run = harness({ hold: 100, collects: collect() });
    const results = await Promise.all(Array.from({ length: 5 }, () => run.service.decline(BOOKING, input)));
    expect(results.filter((row) => row.success)).toHaveLength(5);
    expect(run.calls.consume).toBe(1);
    expect(run.calls.refund.length).toBeLessThanOrEqual(1);
    expect(run.calls.refund).toHaveLength(1);
    expect(run.state.status).toBe('cancelled');
    expect(run.calls.removed).toBe(0);
    expect(run.calls.history).toBe(1);
    expect(run.calls.pins).toBe(1);
  });

  it('sends the provider payout after the booking lock commits', async () => {
    const run = harness({ hold: 100, collects: collect() });
    await run.service.decline(BOOKING, input);
    expect(run.calls.steps.indexOf('unlock')).toBeLessThan(run.calls.steps.indexOf('refund'));
    expect(run.calls.steps.indexOf('lock')).toBeLessThan(run.calls.steps.indexOf('unlock'));
    expect(run.calls.refund).toHaveLength(1);
  });

  it('does not restore the booking when the revert sees a debit', async () => {
    const run = harness({ hold: 100, collects: collect(), consumeRace: 'applied' });
    await run.service.decline(BOOKING, input);
    expect(run.state.status).toBe('cancelled');
    expect(run.calls.removed).toBe(0);
  });

  it('does not revert the cancel when the debit was already applied', async () => {
    const run = harness({ hold: 100, collects: collect(), consumeRace: 'applied' });
    const result = await run.service.decline(BOOKING, input);
    expect(result.success).toBe(true);
    expect(run.state.status).toBe('cancelled');
    expect(run.state.condition_declined_at).toBeTruthy();
    expect(run.calls.removed).toBe(0);
    expect(run.calls.consume).toBe(1);
    expect(run.calls.refund).toHaveLength(1);
  });

  it('reverts a debit that never landed', async () => {
    const run = harness({ hold: 100, collects: collect(), consumeRace: 'fail' });
    await expect(run.service.decline(BOOKING, input)).rejects.toThrow('ledger down');
    expect(run.state.status).toBe('reserved');
    expect(run.state.condition_declined_at).toBeNull();
    expect(run.calls.removed).toBe(1);
    expect(run.calls.refund).toHaveLength(0);
  });

  it('returns refund already in progress when a concurrent resume cannot see the debit', async () => {
    const run = harness({
      hold: 100,
      collects: collect(),
      consumeRace: 'hidden',
      declines: [{ id: 'decline-1', money_rail: 'momo_paid', money_amount: 100, money_currency: 'XAF', effects_recorded_at: null }],
      booking: { status: 'cancelled', payment_status: 'cancelled', condition_declined_at: '2026-11-19T00:00:00.000Z', refund_status: 'none' },
    });
    await expect(run.service.decline(BOOKING, input)).rejects.toMatchObject({
      status: 409,
      response: { code: 'REFUND_IN_PROGRESS', message: 'refund already in progress' },
    });
    expect(run.state.status).toBe('cancelled');
    expect(run.calls.removed).toBe(0);
    expect(run.calls.refund).toHaveLength(0);
  });

  it('keeps history, pins, and payouts at zero when five retries find a finished decline', async () => {
    const run = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'refunded' },
      declines: [{
        id: 'decline-1',
        version_id: VERSION,
        reason: 'damaged',
        reason_text: null,
        money_rail: 'momo_paid',
        money_amount: 100,
        money_currency: 'XAF',
        phone_mask: '····· 67 12',
        effects_recorded_at: '2026-11-18T00:00:00.000Z',
      }],
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => run.service.decline(BOOKING, input)));
    expect(results.every((row) => row.idempotent)).toBe(true);
    expect(run.calls.history).toBe(0);
    expect(run.calls.pins).toBe(0);
    expect(run.calls.refund).toHaveLength(0);
    expect(run.calls.consume).toBe(0);
    expect(run.state.status).toBe('cancelled');
  });

  it('credits the wallet back when the payout fails and does not release the hold as well', async () => {
    const { service, calls, wallet } = harness({
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'failed', provider: 'freemopay', providerRef: 'ref', unsupported: false },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('failed');
    expect(calls.release).toBe(0);
    expect(calls.consume).toBe(1);
    expect(calls.restore).toBe(1);
    expect(wallet.available).toBe(100);
    expect(wallet.withheld).toBe(0);
    expect(calls.support).toBe(1);
  });

  it('keeps the debit when the provider times out, and flags support after five attempts', async () => {
    const timedOut = harness({
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refundThrows: true,
    });
    const result = await timedOut.service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('refund_pending');
    expect(timedOut.calls.restore).toBe(0);
    expect(timedOut.wallet.available).toBe(0);
    expect(timedOut.calls.support).toBe(0);
    const retry = harness({
      pending: [{
        id: BOOKING,
        booking_number: 'RB-25496310',
        currency: 'XAF',
        refund_status: 'refund_pending',
        refund_attempts: 4,
        refund_provider: 'mtn',
        refund_provider_ref: null,
        client: { user_id: 'user-1' },
      }],
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'mtn', providerRef: null, unsupported: false },
    });
    expect(await retry.service.reconcilePending()).toBe(0);
    expect(retry.calls.support).toBe(1);
    expect(retry.calls.refund).toHaveLength(1);
  });

  it('marks an unsupported provider manual after one credit, so a manual payout cannot double-pay', async () => {
    const { service, calls, state, wallet } = harness({
      hold: 45000,
      collects: [{ amount: 45000, currency: 'XAF', provider: 'mypvit', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'mypvit', providerRef: null, unsupported: true },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('manual');
    expect(state.refund_status).toBe('manual');
    expect(calls.support).toBe(1);
    expect(calls.restore).toBe(1);
    expect(wallet.available).toBe(45000);
    expect((calls.refund[0] as { amount: number }).amount).toBe(45000);
    expect(await service.reconcilePending()).toBe(0);
    expect(calls.refund).toHaveLength(1);
  });

  it('returns the stored decline without calling the provider again', async () => {
    const { service, calls } = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'refunded' },
      declines: [{
        id: 'decline-1',
        version_id: '99999999-9999-4999-8999-999999999999',
        reason: 'damaged',
        reason_text: null,
        money_rail: 'momo_paid',
        money_amount: 100,
        money_currency: 'XAF',
        phone_mask: '····· 67 12',
      }],
    });
    const result = await service.decline(BOOKING, input);
    expect(result.idempotent).toBe(true);
    expect(result.refundStatus).toBe('refunded');
    expect(calls.release).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(calls.cas).toBe(0);
    expect(calls.notice).toBe(0);
    expect(calls.history).toBe(0);
  });

  it('consumes the wallet hold on resume before paying the phone', async () => {
    const { service, calls, wallet } = harness({
      hold: 100,
      collects: collect(),
      declines: [
        {
          id: 'decline-1',
          money_rail: 'momo_paid',
          money_amount: 100,
          money_currency: 'XAF',
          effects_recorded_at: null,
        },
      ],
      booking: {
        status: 'cancelled',
        payment_status: 'cancelled',
        condition_declined_at: '2026-11-19T00:00:00.000Z',
        refund_status: 'none',
      },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('refunded');
    expect(result.idempotent).toBe(true);
    expect(calls.consume).toBe(1);
    expect(calls.refund).toHaveLength(1);
    expect(calls.steps.indexOf('consume')).toBeLessThan(calls.steps.indexOf('refund'));
    expect(wallet.withheld).toBe(0);
    expect(wallet.available).toBe(0);
  });

  it('retries the decline payout at the recorded amount when a later collect is already success', async () => {
    const { service, calls } = harness({
      booking: {
        status: 'cancelled',
        condition_declined_at: '2026-11-18T00:00:00.000Z',
        refund_status: 'none',
      },
      declines: [{
        id: 'decline-1',
        version_id: VERSION,
        reason: 'damaged',
        reason_text: null,
        money_rail: 'momo_paid',
        money_amount: 100,
        money_currency: 'XAF',
        phone_mask: '····· 67 12',
      }],
      collects: [
        ...collect(),
        { amount: 40, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'late' },
      ],
    });
    await service.decline(BOOKING, input);
    expect(calls.refund).toHaveLength(1);
    expect((calls.refund[0] as { amount: number }).amount).toBe(100);
    expect(calls.consume).toBe(1);
  });

  it('leaves a second collect in the wallet instead of paying it on top of the first debit', async () => {
    const { service, calls } = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'none' },
      collects: collect(),
    });
    await service.refundLateCollect(BOOKING, {
      amount: 40,
      currency: 'XAF',
      provider: 'mtn',
      phone: '2376700006712',
      transactionId: 'late',
    });
    expect(calls.consume).toBe(1);
    expect(calls.refund).toHaveLength(1);
    expect((calls.refund[0] as { amount: number }).amount).toBe(100);
  });

  it('does not let the refund cron pay a collect that arrived after the debit was claimed', async () => {
    const row = pendingRefund({ refund_provider_ref: null, refund_attempts: 0, refund_amount: 100 });
    const { service, calls } = harness({
      pending: [row],
      collects: [
        ...collect(),
        { amount: 40, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'late' },
      ],
    });
    await service.reconcilePending();
    expect(calls.refund).toHaveLength(1);
    expect((calls.refund[0] as { amount: number }).amount).toBe(100);
  });

  it('queues a payout for a late collect that is not marked success yet', async () => {
    const { service, calls } = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'none' },
      collects: [],
    });
    await service.refundLateCollect(BOOKING, {
      amount: 100,
      currency: 'XAF',
      provider: 'mtn',
      phone: '2376700006712',
      transactionId: 'late',
    });
    expect(calls.support).toBe(1);
    expect(calls.consume).toBe(1);
    expect(calls.refund).toHaveLength(1);
    expect((calls.refund[0] as { referenceId: string }).referenceId).toBe(stableRefundReference(BOOKING));
  });

  it('refunds a late collect through the same hold debit', async () => {
    const { service, calls, wallet } = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'none' },
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }],
    });
    await service.refundLateCollect(BOOKING);
    expect(calls.release).toBe(0);
    expect(calls.consume).toBe(1);
    expect(wallet.withheld).toBe(0);
    expect(wallet.available + (calls.refund[0] as { amount: number }).amount).toBe(100);
  });

  it('blocks a decline after the renter accepted the pickup report', async () => {
    const { service, calls } = harness({ booking: { pickup_accepted_version_id: VERSION } });
    await expect(service.decline(BOOKING, input)).rejects.toMatchObject({ status: 409, message: 'Report a problem' });
    expect(calls.cas).toBe(0);
    expect(calls.consume).toBe(0);
  });

  it('requires a refund permission and a reference or a note', async () => {
    const denied = harness({
      booking: { status: 'cancelled', refund_status: 'refund_pending' },
      refunds: false,
    });
    await expect(denied.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'ref' })).rejects.toMatchObject({ status: 403 });
    const missing = harness({ booking: { status: 'cancelled', refund_status: 'refund_pending' } });
    await expect(missing.service.markRefund(BOOKING, { status: 'refunded' })).rejects.toMatchObject({ status: 400 });
    const { service, calls, state, wallet } = harness({
      poll: 'missing',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
      },
    });
    await expect(service.markRefund(BOOKING, { status: 'manual_override', note: 'No payout landed' })).resolves.toEqual({ refundStatus: 'failed' });
    expect(state.refund_status).toBe('failed');
    expect(calls.restore).toBe(1);
    expect(wallet.available).toBe(100);
    expect(calls.history).toBe(1);
  });

  it('credits the wallet before a failed poll can mark the refund failed', async () => {
    const pending = pendingRefund();
    const sibling = pendingRefund({ id: '44444444-4444-4444-8444-444444444444', booking_number: 'RB-2' });
    const crashed = harness({ pending: [pending, sibling], poll: 'failed', restoreThrows: true });
    await expect(crashed.service.reconcilePending()).resolves.toBe(1);
    expect(pending.refund_status).toBe('refund_pending');
    expect(sibling.refund_status).toBe('failed');
    expect(crashed.wallet.available).toBe(100);
    expect(crashed.calls.support).toBeGreaterThan(0);
    const row = pendingRefund();
    const paid = harness({ pending: [row], poll: 'failed' });
    expect(await paid.service.reconcilePending()).toBe(1);
    expect(paid.calls.restore).toBe(1);
    expect(paid.wallet.available).toBe(100);
    expect(row.refund_status).toBe('failed');
    expect(paid.calls.support).toBe(1);
  });

  it('uses the 12-argument close when p_guard_open is not on the function yet', async () => {
    const run = harness({
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'mtn',
        refund_provider_ref: 'mtn-ref',
      },
      poll: 'failed',
      guardFieldMissing: true,
    });
    await expect(run.service.markRefund(BOOKING, { status: 'failed', providerRef: 'mtn-ref' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    expect(run.calls.plainClose).toBe(1);
    expect(run.state.refund_status).toBe('failed');
    expect(run.calls.restore).toBe(1);
  });

  it('does not credit an override when the guard argument is missing', async () => {
    const run = harness({
      booking: openOverride(),
      external: 'missing',
      guardFieldMissing: true,
    });
    await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(run.calls.plainClose).toBe(0);
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
  });

  it('does not send a second payout when the claim is lost or the reference is already stored', async () => {
    const lost = harness({
      claimLoses: true,
      pending: [pendingRefund({ refund_provider_ref: null })],
      collects: collect(),
    });
    expect(await lost.service.reconcilePending()).toBe(0);
    expect(lost.calls.refund).toHaveLength(0);
    const row = pendingRefund({ refund_provider_ref: null, refund_attempts: 0 });
    const won = harness({
      pending: [row],
      collects: collect(),
      refund: { status: 'refund_pending', provider: 'mtn', providerRef: null, unsupported: false },
    });
    await won.service.reconcilePending();
    await won.service.reconcilePending();
    expect(won.calls.refund).toHaveLength(1);
    expect((won.calls.refund[0] as { referenceId: string }).referenceId).toBe(stableRefundReference(BOOKING));
  });

  it('records the decline before moving money, so a failed insert can be retried', async () => {
    const { service, calls, state, wallet } = harness({
      insertFails: 1,
      hold: 100,
      collects: collect(),
    });
    await expect(service.decline(BOOKING, input)).rejects.toThrow('hasura 503');
    expect(calls.consume).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(state.status).toBe('reserved');
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('refunded');
    expect(calls.refund).toHaveLength(1);
    expect(wallet.withheld).toBe(0);
    expect(state.status).toBe('cancelled');
  });

  it('does not write a second history row when a later side effect is retried', async () => {
    const { service, calls } = harness({
      pinFails: 1,
      booking: { currency: 'CAD', authorized_amount: 65, total_amount: 65 },
    });
    await service.decline(BOOKING, input);
    expect(calls.history).toBe(1);
    const second = await service.decline(BOOKING, input);
    expect(second.idempotent).toBe(true);
    expect(calls.history).toBe(1);
  });

  it('stamps the refund claim before the first provider call', async () => {
    const { service, calls } = harness({ collects: collect() });
    await service.decline(BOOKING, input);
    expect(calls.claimAtSend).toEqual(expect.any(String));
    expect(calls.refund).toHaveLength(1);
  });

  it('aborts a payout when another worker owns the claim token', async () => {
    const row = pendingRefund({ refund_provider_ref: null });
    const { service, calls } = harness({ pending: [row], collects: collect(), stealClaim: true });
    expect(await service.reconcilePending()).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(calls.restore).toBe(0);
    expect(row.refund_status).toBe('refund_pending');
  });

  it('does not resend FreemoPay when its status lookup is missing', async () => {
    const row = pendingRefund({ refund_provider: 'freemopay', refund_provider_ref: 'fp-1' });
    const { service, calls } = harness({ pending: [row], poll: 'missing' });
    expect(await service.reconcilePending()).toBe(0);
    await service.reconcilePending();
    expect(calls.refund).toHaveLength(0);
    expect(calls.support).toBe(1);
    expect(calls.supportPayload?.walletCredited).toBe(false);
    expect(calls.supportPayload?.externalId).toBe('fp-1');
    expect(row.refund_status).toBe('refund_pending');
  });

  it('keeps the FreemoPay reference when the final write loses the claim', async () => {
    const row = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 0,
    });
    const { service } = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'freemopay', providerRef: 'FP-1', unsupported: false },
      dropOwnedWrite: true,
    });
    expect(await service.reconcilePending()).toBe(0);
    expect(row.refund_provider_ref).toBe('FP-1');
    expect(row.refund_status).toBe('refund_pending');
  });

  it('refuses to mark a sent refund failed unless FreemoPay says it failed', async () => {
    const sent = harness({
      poll: 'missing',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: stableRefundReference(BOOKING),
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(sent.service.markRefund(BOOKING, { status: 'failed', note: 'guess', providerRef: 'none' })).rejects.toMatchObject({
      status: 400,
    });
    expect(sent.calls.restore).toBe(0);
    const paid = harness({
      poll: 'refunded',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_provider: 'freemopay',
        refund_provider_ref: 'FP-1',
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(paid.service.markRefund(BOOKING, { status: 'failed', providerRef: 'FP-1' })).rejects.toMatchObject({ status: 409 });
    expect(paid.calls.restore).toBe(0);
    const { service, calls, state, historyNotes } = harness({
      poll: 'failed',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: 'FP-1',
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(service.markRefund(BOOKING, { status: 'failed', providerRef: 'FP-1', note: 'portal' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    expect(calls.restore).toBe(1);
    expect(state.refund_status).toBe('failed');
    expect(state.refund_provider_ref).toBe('FP-1');
    expect(historyNotes.join(' ')).toContain('provider reported failed');
    expect(historyNotes.join(' ')).not.toContain('none');
  });

  it('does not tell support again for a duplicate late collect', async () => {
    const { service, calls } = harness({
      booking: { status: 'cancelled', condition_declined_at: '2026-11-18T00:00:00.000Z', refund_status: 'none' },
      collects: [],
    });
    const extra = { amount: 100, currency: 'XAF', provider: 'mtn', phone: '2376700006712', transactionId: 'late' };
    await service.refundLateCollect(BOOKING, extra);
    await service.refundLateCollect(BOOKING, extra);
    expect(calls.support).toBe(1);
    expect(calls.refund).toHaveLength(1);
  });

  it('still returns the decline when the history insert fails, and retries that side effect', async () => {
    const { service, calls } = harness({
      historyFails: 1,
      booking: { currency: 'CAD', authorized_amount: 65, total_amount: 65 },
    });
    const first = await service.decline(BOOKING, input);
    expect(first.status).toBe('cancelled');
    expect(calls.history).toBe(1);
    const second = await service.decline(BOOKING, input);
    expect(second.idempotent).toBe(true);
    expect(calls.history).toBe(2);
  });

  it('polls a FreemoPay attempt and asks support instead of resending on a 404', async () => {
    const found = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: stableRefundReference(BOOKING),
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    });
    const paid = harness({ pending: [found], poll: 'refunded' });
    expect(await paid.service.reconcilePending()).toBe(1);
    expect(paid.calls.refund).toHaveLength(0);
    expect(found.refund_status).toBe('refunded');
    const missing = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: stableRefundReference(BOOKING),
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    });
    const again = harness({
      pending: [missing],
      poll: 'missing',
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'freemopay', providerRef: 'FP-2', unsupported: false },
    });
    expect(await again.service.reconcilePending()).toBe(0);
    expect(again.calls.refund).toHaveLength(0);
    expect(again.calls.supportPayload?.outcome).toBe('manual_check');
    const stored = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: 'FP-1',
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    });
    const kept = harness({ pending: [stored], poll: 'missing' });
    expect(await kept.service.reconcilePending()).toBe(0);
    expect(kept.calls.refund).toHaveLength(0);
    expect(kept.calls.supportPayload?.outcome).toBe('manual_check');
  });

  it('resends an MTN payout with the same reference when the lookup is missing', async () => {
    const ref = stableRefundReference(BOOKING);
    const row = pendingRefund({ refund_provider: 'mtn', refund_provider_ref: ref, refund_sent_at: null });
    const { service, calls } = harness({
      pending: [row],
      poll: 'missing',
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'mtn', providerRef: ref, unsupported: false },
    });
    expect(await service.reconcilePending()).toBe(0);
    expect(calls.refund).toHaveLength(1);
    expect((calls.refund[0] as { referenceId?: string }).referenceId).toBe(ref);
    expect(calls.support).toBe(0);
  });

  it('clears the stable reference when the sent stamp does not land', async () => {
    const row = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 0,
    });
    const { service, calls } = harness({
      pending: [row],
      stampFails: true,
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
    });
    expect(await service.reconcilePending()).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(row.refund_provider_ref).toBeNull();
  });

  it('keeps polling a refund past five attempts and does not send another payout', async () => {
    const row = pendingRefund({
      refund_provider: 'freemopay',
      refund_provider_ref: stableRefundReference(BOOKING),
      refund_sent_at: '2026-11-18T00:00:00.000Z',
      refund_attempts: 5,
    });
    const { service, calls } = harness({ pending: [row], poll: 'missing' });
    expect(await service.reconcilePending()).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(calls.supportPayload?.outcome).toBe('exhausted');
  });

  it('credits a confirmed-unpaid refund through the claim, and refunded takes the claim too', async () => {
    const unpaid = harness({
      poll: 'failed',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: 'FP-1',
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(unpaid.service.markRefund(BOOKING, { status: 'unpaid', note: 'Provider has no payout' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    const paidOut = harness({
      poll: 'refunded',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_provider: 'freemopay',
        refund_provider_ref: 'FP-1',
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(paidOut.service.markRefund(BOOKING, { status: 'unpaid', note: 'checked' })).rejects.toMatchObject({
      status: 409,
    });
    expect(paidOut.calls.restore).toBe(0);
    const unknown = harness({
      poll: 'missing',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: stableRefundReference(BOOKING),
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(unknown.service.markRefund(BOOKING, { status: 'unpaid', note: 'checked' })).rejects.toMatchObject({
      status: 409,
    });
    expect(unknown.calls.restore).toBe(0);
    const neverSent = harness({
      poll: 'missing',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: stableRefundReference(BOOKING),
        refund_sent_at: null,
      },
    });
    await expect(neverSent.service.markRefund(BOOKING, { status: 'unpaid', note: 'both lookups empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(neverSent.calls.restore).toBe(0);
    expect(unpaid.calls.restore).toBe(1);
    expect(unpaid.state.refund_status).toBe('failed');
    expect(unpaid.state.refund_credited_at).toBeTruthy();
    const paid = harness({
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider_ref: 'FP-9',
      },
    });
    await expect(paid.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-9' })).rejects.toMatchObject({
      status: 409,
    });
    expect(paid.state.refund_status).toBe('refund_pending');
    expect(paid.calls.restore).toBe(0);
    expect(paid.calls.renter).toEqual([]);
    const confirmed = harness({
      poll: 'refunded',
      booking: { status: 'cancelled', refund_status: 'refund_pending', refund_amount: 100, refund_provider_ref: 'FP-9' },
    });
    await expect(confirmed.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-9' })).resolves.toEqual({
      refundStatus: 'refunded',
    });
    expect(confirmed.calls.renter).toEqual([expect.objectContaining({ landed: 'sent', amount: 100 })]);
    expect(unpaid.calls.renter).toEqual([expect.objectContaining({ landed: 'wallet' })]);
    const again = harness({
      poll: 'failed',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'freemopay',
        refund_provider_ref: 'FP-1',
        refund_sent_at: '2026-11-18T00:00:00.000Z',
        refund_notices: ['renter_landed'],
      },
    });
    await again.service.markRefund(BOOKING, { status: 'unpaid', note: 'already told' });
    expect(again.calls.restore).toBe(1);
    expect(again.calls.renter).toEqual([]);
    const lost = harness({
      poll: 'refunded',
      booking: { status: 'cancelled', refund_status: 'refund_pending', refund_provider_ref: 'FP-9' },
      claimLoses: true,
    });
    await expect(lost.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-9' })).rejects.toMatchObject({
      status: 409,
      message: 'This refund is being processed. Retry shortly.',
    });
  });

  it('still finishes the decline when the support notice fails, and releases that notice', async () => {
    const { service, calls, state } = harness({
      noticeFails: true,
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'failed', provider: 'freemopay', providerRef: 'ref', unsupported: false },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('failed');
    expect(calls.history).toBe(1);
    expect(calls.notice).toBe(1);
    expect(calls.support).toBe(1);
    expect(state.refund_notices ?? []).toEqual(['renter_try:1', 'renter_landed']);
    expect(calls.renter).toEqual([expect.objectContaining({ landed: 'wallet' })]);
  });

  it('stamps the wallet credit when the manual status write loses its claim', async () => {
    const { service, state, wallet } = harness({
      dropOwnedWrite: true,
      hold: 100,
      collects: [{ amount: 100, currency: 'XAF', provider: 'mypvit', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'mypvit', providerRef: null, unsupported: true },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('refund_pending');
    expect(wallet.available).toBe(100);
    expect(state.refund_status).not.toBe('manual');
    expect(state.refund_credited_at).toBeTruthy();
  });

  it('checks a stored FreemoPay reference before sending, in both lookup modes', async () => {
    const ref = stableRefundReference(BOOKING);
    const collects = [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }];
    const base = { refund_provider: 'freemopay', refund_provider_ref: ref, refund_sent_at: null, refund_attempts: 0 };
    const missing = pendingRefund(base);
    const fpRef = harness({
      pending: [missing],
      poll: 'missing',
      collects,
      refund: { status: 'refund_pending', provider: 'freemopay', providerRef: 'FP-2', unsupported: false },
    });
    expect(await fpRef.service.reconcilePending()).toBe(0);
    expect(fpRef.calls.refund).toHaveLength(0);
    expect(fpRef.momo.probe).toHaveBeenCalledWith('freemopay', ref);
    expect(missing.refund_status).toBe('refund_pending');
    const found = pendingRefund(base);
    const ext = harness({ pending: [found], poll: 'refunded' });
    expect(await ext.service.reconcilePending()).toBe(1);
    expect(ext.calls.refund).toHaveLength(0);
    expect(ext.momo.probe).toHaveBeenCalledWith('freemopay', ref);
    expect(found.refund_status).toBe('refunded');
  });

  it('rejects a reference pasted from another booking, and a pending payout', async () => {
    const row = {
      status: 'cancelled',
      refund_status: 'refund_pending',
      refund_amount: 100,
      refund_provider: 'freemopay',
      refund_provider_ref: 'FP-1',
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    };
    const pasted = harness({ poll: 'failed', booking: row });
    await expect(pasted.service.markRefund(BOOKING, { status: 'failed', providerRef: 'FP-2' })).rejects.toMatchObject({
      status: 400,
    });
    expect(pasted.calls.restore).toBe(0);
    const pending = harness({ poll: 'refund_pending', booking: row });
    await expect(pending.service.markRefund(BOOKING, { status: 'failed', providerRef: 'FP-1' })).rejects.toMatchObject({
      status: 409,
    });
    expect(pending.calls.restore).toBe(0);
    const unknown = harness({ poll: 'unknown', booking: row });
    await expect(unknown.service.markRefund(BOOKING, { status: 'unpaid', providerRef: 'FP-1' })).rejects.toMatchObject({
      status: 409,
    });
    expect(unknown.calls.restore).toBe(0);
  });

  it('does not credit a FreemoPay stable-id miss, in either lookup mode', async () => {
    const stable = stableRefundReference(BOOKING);
    const row = {
      status: 'cancelled',
      refund_status: 'refund_pending',
      refund_amount: 100,
      refund_provider: 'freemopay',
      refund_provider_ref: stable,
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    };
    const fpRef = harness({ booking: row, probeFor: (ref) => (ref === stable ? 'missing' : 'refunded') });
    await expect(fpRef.service.markRefund(BOOKING, { status: 'unpaid', note: 'portal' })).rejects.toMatchObject({ status: 409 });
    expect(fpRef.calls.restore).toBe(0);
    expect(fpRef.momo.probe).toHaveBeenCalledWith('freemopay', stable);
    const ext = harness({ booking: row, probeFor: () => 'refunded' });
    await expect(ext.service.markRefund(BOOKING, { status: 'failed', note: 'portal' })).rejects.toMatchObject({ status: 409 });
    expect(ext.calls.restore).toBe(0);
  });

  it('credits a never-sent refund only through a noted override', async () => {
    const open = {
      status: 'cancelled',
      refund_status: 'refund_pending',
      refund_amount: 100,
      refund_provider: 'freemopay',
      refund_provider_ref: null,
      refund_sent_at: null,
    };
    const blocked = harness({ booking: open, poll: 'missing' });
    await expect(blocked.service.markRefund(BOOKING, { status: 'unpaid', note: 'empty portal' })).rejects.toMatchObject({
      status: 409,
    });
    expect(blocked.calls.restore).toBe(0);
    const credited = harness({ booking: open, poll: 'missing' });
    await expect(
      credited.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal shows no payout' })
    ).resolves.toEqual({ refundStatus: 'failed' });
    expect(credited.calls.restore).toBe(1);
    expect(credited.historyNotes.join(' ')).toContain('manual_override');
    const live = harness({ booking: open, poll: 'refunded' });
    await expect(live.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toMatchObject({
      status: 409,
    });
    expect(live.calls.restore).toBe(0);
    const attempted = harness({
      booking: { ...open, refund_send_attempted_at: '2026-11-18T00:00:00.000Z' },
      poll: 'missing',
    });
    await expect(attempted.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toMatchObject({
      status: 409,
    });
    expect(attempted.calls.restore).toBe(0);
    const unknownLook = harness({ booking: open, poll: 'unknown' });
    await expect(unknownLook.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toMatchObject({
      status: 409,
    });
    const finance = harness({
      booking: open,
      poll: 'missing',
      superuser: false,
      permissions: ['platform.financial.refunds'],
    });
    await expect(finance.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toMatchObject({
      status: 403,
    });
    const admin = harness({
      booking: { ...open },
      poll: 'missing',
      superuser: false,
      permissions: ['platform.financial.refunds.manual_override'],
    });
    await expect(admin.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal shows no payout' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    const lostAudit = harness({ booking: { ...open }, poll: 'missing', historyFails: 1 });
    await expect(lostAudit.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toThrow('history fk');
    expect(lostAudit.state.refund_status).toBe('refund_pending');
    expect(lostAudit.calls.restore).toBe(0);
    expect(lostAudit.historyNotes).toEqual([]);
    const stamped = harness({
      booking: { ...open, refund_provider_ref: stableRefundReference(BOOKING) },
      poll: 'missing',
    });
    await expect(stamped.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal' })).rejects.toMatchObject({
      status: 409,
    });
    expect(stamped.calls.restore).toBe(0);
  });

  it('overrides only a proved miss, and keeps the attempt marker unless the connect failed', async () => {
    const fresh = {
      status: 'cancelled',
      refund_status: 'refund_pending',
      refund_amount: 100,
      refund_provider: 'mtn',
      refund_requested_at: new Date().toISOString(),
    };
    const early = harness({ booking: fresh, poll: 'missing' });
    await expect(early.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(early.calls.restore).toBe(0);
    const aged = harness({
      booking: { ...fresh, refund_requested_at: '2020-01-01T00:00:00.000Z' },
      poll: 'missing',
    });
    await expect(aged.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    const feda = harness({
      booking: { ...fresh, refund_provider: 'fedapay' },
      external: 'unknown',
    });
    await expect(feda.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    const absent = harness({
      booking: { ...fresh, refund_provider: 'fedapay', refund_amount: 100 },
      external: 'missing',
    });
    await expect(absent.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    expect(absent.momo.probeByExternalId).toHaveBeenCalledWith(
      'fedapay',
      `rental-decline-${BOOKING}`,
      `override-rental-decline-${BOOKING}`
    );
    const raced = harness({
      booking: { ...fresh, refund_provider: 'fedapay', refund_amount: 100 },
      external: 'missing',
    });
    raced.momo.probeByExternalId.mockImplementation(async () => {
      raced.state.refund_send_attempted_at = new Date().toISOString();
      raced.state.refund_provider_ref = 'payout-9';
      return 'missing';
    });
    await expect(raced.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(raced.calls.restore).toBe(0);
    expect(raced.state.refund_status).toBe('refund_pending');
    const collects = [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }];
    const kept = harness({
      collects,
      refund: { status: 'refund_pending', provider: 'mtn', providerRef: null, unsupported: false, unsent: true, connectFailure: false },
    });
    await kept.service.decline(BOOKING, input);
    expect(kept.state.refund_send_attempted_at).toBeTruthy();
    const cleared = harness({
      collects,
      refund: { status: 'refund_pending', provider: 'mtn', providerRef: null, unsupported: false, unsent: true, connectFailure: true },
    });
    await cleared.service.decline(BOOKING, input);
    expect(cleared.state.refund_send_attempted_at).toBeFalsy();
  });

  it('does not spend an attempt on an unknown FedaPay lookup, then closes a dashboard send', async () => {
    const waiting = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 4,
      refund_send_attempted_at: new Date().toISOString(),
      currency: 'XOF',
    });
    const outage = harness({
      pending: [waiting],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await outage.service.reconcilePending()).toBe(0);
    expect(waiting.refund_attempts).toBe(4);
    expect(waiting.refund_status).toBe('refund_pending');
    expect(outage.calls.restore).toBe(0);
    const exhausted = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const recovered = harness({
      pending: [exhausted],
      fedapayExternal: { kind: 'live', status: 'sent', id: '9001' },
    });
    expect(await recovered.service.reconcilePending()).toBe(1);
    expect(exhausted.refund_status).toBe('refunded');
    expect(exhausted.refund_provider_ref).toBe('9001');
    expect(recovered.calls.restore).toBe(0);
    expect(recovered.calls.refund).toHaveLength(0);
  });

  it('keeps a FedaPay attempt marker and stores no reference when the create lookup is unknown', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_provider_ref).toBeNull();
    expect(row.refund_send_attempted_at).toBe('2026-11-18T00:00:00.000Z');
    expect(row.refund_status).toBe('refund_pending');
    expect(run.calls.restore).toBe(0);
  });

  it('treats one aged empty FedaPay list as unknown and a second, after the gap, as absent', async () => {
    const aged = new Date(Date.now() - 20 * 60_000).toISOString();
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_send_attempted_at: aged,
      currency: 'XOF',
    });
    const collects = [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }];
    const empty = { kind: 'missing' as const, status: null, id: null, provableEmpty: true };
    const first = harness({
      pending: [row],
      collects,
      fedapayExternal: empty,
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await first.service.reconcilePending()).toBe(0);
    expect(row.refund_list_empty_at).toBeTruthy();
    expect((first.calls.refund[0] as { trustEmptyList?: boolean }).trustEmptyList).toBe(false);
    expect(first.calls.restore).toBe(0);
    const soon = harness({
      pending: [row],
      collects,
      fedapayExternal: empty,
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await soon.service.reconcilePending()).toBe(0);
    expect((soon.calls.refund[0] as { trustEmptyList?: boolean }).trustEmptyList).toBe(false);
    row.refund_list_empty_at = new Date(Date.now() - 11 * 60_000).toISOString();
    const later = harness({
      pending: [row],
      collects,
      fedapayExternal: empty,
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await later.service.reconcilePending()).toBe(0);
    expect((later.calls.refund[0] as { trustEmptyList?: boolean }).trustEmptyList).toBe(true);
  });

  it('does not credit when one match is canceled and another is sent', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      fedapayExternal: { kind: 'live', status: 'sent', id: '9002', provableEmpty: false },
    });
    expect(await run.service.reconcilePending()).toBe(1);
    expect(row.refund_status).toBe('refunded');
    expect(row.refund_provider_ref).toBe('9002');
    expect(run.calls.restore).toBe(0);
    expect(run.calls.refund).toHaveLength(0);
  });

  it('checks an exhausted FedaPay row with no reference about once an hour', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      fedapayExternal: { kind: 'live', status: 'pending', id: '9003', provableEmpty: false },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_status).toBe('refund_pending');
    const wait = Date.parse(String(row.refund_next_at)) - Date.now();
    expect(wait).toBeGreaterThan(50 * 60_000);
    expect(wait).toBeLessThan(70 * 60_000);
    expect(run.calls.restore).toBe(0);
  });

  it('holds a fresh all-dead FedaPay list and credits it once the lag has passed', async () => {
    const collects = [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }];
    const fresh = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_unknown_streak: 0,
      refund_send_attempted_at: new Date().toISOString(),
      currency: 'XOF',
    });
    const held = harness({
      pending: [fresh],
      collects,
      fedapayExternal: { kind: 'live', status: 'failed', id: '11', provableEmpty: false },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await held.service.reconcilePending()).toBe(0);
    expect(fresh.refund_status).not.toBe('failed');
    expect(fresh.refund_unknown_streak).toBe(1);
    expect((held.calls.refund[0] as { creditAged?: boolean }).creditAged).toBe(false);
    const aged = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const credited = harness({
      pending: [aged],
      collects,
      fedapayExternal: { kind: 'live', status: 'canceled', id: '11', provableEmpty: false },
      refund: { status: 'failed', provider: 'fedapay', providerRef: '11', unsupported: false },
    });
    expect(await credited.service.reconcilePending()).toBe(1);
    expect(aged.refund_status).toBe('failed');
    expect((credited.calls.refund[0] as { creditAged?: boolean }).creditAged).toBe(true);
  });

  it('does not credit a later payout hidden by lag when an older canceled row is visible', async () => {
    const collects = [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }];
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_send_attempted_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const sent = harness({
      pending: [row],
      collects,
      fedapayExternal: { kind: 'missing', status: null, id: null, provableEmpty: true },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: 'p2', unsupported: false },
    });
    expect(await sent.service.reconcilePending()).toBe(0);
    expect(row.refund_provider_ref).toBe('p2');
    expect(Date.now() - Date.parse(String(row.refund_send_attempted_at))).toBeLessThan(5_000);
    row.refund_provider_ref = null;
    row.refund_next_at = new Date(Date.now() - 1000).toISOString();
    const hidden = harness({
      pending: [row],
      collects,
      fedapayExternal: { kind: 'live', status: 'canceled', id: 'old', provableEmpty: false },
      refundFor: (request) => request.creditAged
        ? { status: 'failed', provider: 'fedapay', providerRef: 'old', unsupported: false }
        : { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await hidden.service.reconcilePending()).toBe(0);
    expect(row.refund_status).not.toBe('failed');
    expect((hidden.calls.refund[0] as { creditAged?: boolean }).creditAged).toBe(false);
  });

  it('does not credit a send stamped just before the override clock', async () => {
    const moneyOut = await refusedStamp(1_000);
    expect(moneyOut).toBe(1);
  });

  it('does not credit a send stamped by a clock 10 seconds behind', async () => {
    const moneyOut = await refusedStamp(10_000);
    expect(moneyOut).toBe(1);
  });

  it('leaves the cron attempt and retry time after six refused overrides', async () => {
    const next = '2026-11-20T00:00:00.000Z';
    const run = harness({
      booking: { ...openOverride(), refund_attempts: 1, refund_next_at: next },
      external: 'unknown',
    });
    for (let i = 0; i < 6; i += 1) {
      await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
        status: 409,
      });
    }
    expect(run.state.refund_attempts).toBe(1);
    expect(run.state.refund_next_at).toBe(next);
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
    expect(run.state.refund_claim_token).toBeNull();
  });

  it('does not credit when the attempt count changes under the override claim', async () => {
    const run = harness({
      booking: openOverride(),
      external: 'missing',
      afterClaim: (row) => {
        row.refund_attempts = Number(row.refund_attempts ?? 0) + 1;
      },
    });
    await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
    expect(run.momo.probeByExternalId).not.toHaveBeenCalled();
  });

  it('does not credit when a cron send loses its reply during the override', async () => {
    const run = harness({
      booking: openOverride(),
      external: 'missing',
      duringClaim: (row) => {
        row.refund_send_attempted_at = new Date(Date.now() + 5_000).toISOString();
        row.refund_provider_ref = null;
      },
    });
    await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
    expect(run.momo.probeByExternalId).not.toHaveBeenCalled();
  });

  it('leaves a created unsent payout on the open row when the override races it', async () => {
    const run = harness({
      booking: openOverride(),
      external: 'unknown',
      duringClaim: (row) => {
        row.refund_send_attempted_at = new Date(Date.now() + 5_000).toISOString();
      },
    });
    await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
    expect(run.state.refund_provider_ref).toBeNull();
    expect(run.momo.probeByExternalId).not.toHaveBeenCalled();
  });

  it('fails an override closed when the absence lookup is down', async () => {
    const run = harness({ booking: openOverride(), external: 'unknown' });
    await expect(run.service.markRefund(BOOKING, { status: 'manual_override', note: 'portal empty' })).rejects.toMatchObject({
      status: 409,
    });
    expect(run.calls.restore).toBe(0);
    expect(run.state.refund_status).toBe('refund_pending');
    expect(run.state.refund_claim_token).toBeNull();
  });

  it('does not credit a timed-out create when the lookup is down and the payout is hidden', async () => {
    const collects = [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }];
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_send_attempted_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const timedOut = harness({
      pending: [row],
      collects,
      fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false },
      refundFor: async (request) => {
        const stamped = await request.beforeProviderSend?.();
        if (!stamped) return { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true };
        return { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true };
      },
    });
    expect(await timedOut.service.reconcilePending()).toBe(0);
    expect(Date.now() - Date.parse(String(row.refund_send_attempted_at))).toBeLessThan(5_000);
    expect(row.refund_status).toBe('refund_pending');
    row.refund_provider_ref = null;
    row.refund_next_at = new Date(Date.now() - 1000).toISOString();
    const hidden = harness({
      pending: [row],
      collects,
      fedapayExternal: { kind: 'live', status: 'canceled', id: 'old', provableEmpty: false },
      refundFor: (request) => request.creditAged
        ? { status: 'failed', provider: 'fedapay', providerRef: 'old', unsupported: false }
        : { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await hidden.service.reconcilePending()).toBe(0);
    expect(row.refund_status).not.toBe('failed');
    expect((hidden.calls.refund[0] as { creditAged?: boolean }).creditAged).toBe(false);
  });

  it('keeps one payout when overrides race cron sends with the lookup down', async () => {
    const lines = [await overrideRace('sent-blank', 'missing'), await overrideRace('created-unsent', 'unknown')];
    const text = lines.join('\n');
    const dir = '/opt/cursor/artifacts';
    if (existsSync(dir) || existsSync('/opt/cursor')) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/fedapay-storm-override-race.txt`, `${text}\n`);
    }
    expect(lines[0]).toContain('credits=0');
    expect(lines[0]).toContain('closed=0');
    expect(lines[0]).toContain('moneyOut=1');
    expect(lines[1]).toContain('credits=0');
    expect(lines[1]).toContain('closed=0');
    expect(lines[1]).toContain('pending=8');
  });

  it('records an unknown streak when the withdraw hits the tick deadline', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_unknown_streak: 2,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayExternal: { kind: 'live', status: 'failed', id: '11', provableEmpty: false },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true, limited: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_status).not.toBe('failed');
    expect(row.refund_unknown_streak).toBe(3);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(3 * 60_000);
  });

  it('counts a budget-capped FedaPay lookup as an unknown streak', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_unknown_streak: 0,
      refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false, limited: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(1);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(50_000);
    expect(run.calls.refund).toHaveLength(0);
  });

  it('backs off unknown FedaPay lookups and notifies support once', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_unknown_streak: 0,
      refund_send_attempted_at: new Date().toISOString(),
      currency: 'XOF',
    });
    const first = harness({ pending: [row], fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false } });
    expect(await first.service.reconcilePending()).toBe(0);
    expect(row.refund_attempts).toBe(5);
    expect(row.refund_unknown_streak).toBe(1);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(50_000);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeLessThan(70_000);
    expect(first.calls.support).toBe(0);
    row.refund_unknown_streak = 9;
    row.refund_next_at = new Date(Date.now() - 1000).toISOString();
    const tenth = harness({ pending: [row], fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false } });
    expect(await tenth.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(10);
    expect(tenth.calls.support).toBe(1);
    expect(tenth.calls.supportPayload?.outcome).toBe('unknown_streak');
    const again = harness({ pending: [row], fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false } });
    expect(await again.service.reconcilePending()).toBe(0);
    expect(again.calls.support).toBe(0);
  });

  it('does not start the 24h silence when the streak notice is not sent', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_unknown_streak: 9,
      refund_notices: ['manual_check'],
      refund_send_attempted_at: new Date().toISOString(),
      currency: 'XOF',
    });
    const missed = harness({
      pending: [row],
      noticeOk: false,
      fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false },
    });
    expect(await missed.service.reconcilePending()).toBe(0);
    expect(missed.calls.support).toBe(1);
    expect(missed.calls.supportPayload?.outcome).toBe('unknown_streak');
    expect(row.refund_unknown_notice_at).toBeNull();
    expect(row.refund_notices).toEqual(['manual_check']);
    const sent = harness({
      pending: [row],
      fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false },
    });
    expect(await sent.service.reconcilePending()).toBe(0);
    expect(sent.calls.support).toBe(1);
    expect(row.refund_unknown_notice_at).toBeTruthy();
  });

  it('resets the unknown streak when a resend records a provable empty list', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_unknown_streak: 17,
      refund_send_attempted_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayExternal: { kind: 'missing', status: null, id: null, provableEmpty: true },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(0);
    expect(row.refund_attempts).toBe(1);
    const found = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 1,
      refund_unknown_streak: 17,
      refund_send_attempted_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const matched = harness({
      pending: [found],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayExternal: { kind: 'live', status: 'sent', id: '9001', provableEmpty: false },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: '9001', unsupported: false },
    });
    expect(await matched.service.reconcilePending()).toBe(0);
    expect(found.refund_unknown_streak).toBe(0);
    expect(found.refund_provider_ref).toBe('9001');
    const wait = Date.parse(String(row.refund_next_at)) - Date.now();
    expect(wait).toBeGreaterThan(50_000);
    expect(wait).toBeLessThan(90_000);
  });

  it('grows the resend unknown streak and notifies at the configured count', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 0,
      refund_unknown_streak: 0,
      refund_send_attempted_at: new Date().toISOString(),
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayMinutes: { rentals_fedapay_unknown_notice_after: 3 },
      fedapayExternal: { kind: 'unknown', status: null, id: null, provableEmpty: false },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(1);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(50_000);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeLessThan(70_000);
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(2);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(110_000);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeLessThan(130_000);
    expect(run.calls.support).toBe(0);
    expect(await run.service.reconcilePending()).toBe(0);
    expect(row.refund_unknown_streak).toBe(3);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeGreaterThan(220_000);
    expect(Date.parse(String(row.refund_next_at)) - Date.now()).toBeLessThan(260_000);
    expect(run.calls.support).toBe(1);
    expect(run.calls.supportPayload?.outcome).toBe('unknown_streak');
  });

  it('resets the poll streak when an exhausted row sees an empty list or a match', async () => {
    const empty = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_unknown_streak: 6,
      currency: 'XOF',
    });
    const run = harness({
      pending: [empty],
      fedapayExternal: { kind: 'missing', status: null, id: null, provableEmpty: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(empty.refund_unknown_streak).toBe(0);
    expect(empty.refund_attempts).toBe(5);
    const wait = Date.parse(String(empty.refund_next_at)) - Date.now();
    expect(wait).toBeGreaterThan(50 * 60_000);
    expect(wait).toBeLessThan(70 * 60_000);
    const matched = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_attempts: 5,
      refund_unknown_streak: 6,
      currency: 'XOF',
    });
    const found = harness({
      pending: [matched],
      fedapayExternal: { kind: 'live', status: 'sent', id: '9001', provableEmpty: false },
    });
    expect(await found.service.reconcilePending()).toBe(1);
    expect(matched.refund_unknown_streak).toBe(0);
    expect(matched.refund_provider_ref).toBe('9001');
  });

  it('caps a configured lag above 24 hours', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_send_attempted_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      refund_list_empty_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayMinutes: { rentals_fedapay_list_lag_minutes: 1_000_000, rentals_fedapay_list_confirm_minutes: 1_000_000 },
      fedapayExternal: { kind: 'missing', status: null, id: null, provableEmpty: true },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect(run.calls.refund[0]).toEqual(expect.objectContaining({ trustEmptyList: true }));
  });

  it('keeps the 10 minute floor when lag and confirm are configured lower', async () => {
    const row = pendingRefund({
      refund_provider: 'fedapay',
      refund_provider_ref: null,
      refund_sent_at: null,
      refund_send_attempted_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      refund_list_empty_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      currency: 'XOF',
    });
    const run = harness({
      pending: [row],
      collects: [{ amount: 100, currency: 'XOF', provider: 'fedapay', customer_phone: '22890000000', transaction_id: 'tx' }],
      fedapayMinutes: {
        rentals_fedapay_list_lag_minutes: 1,
        rentals_fedapay_list_confirm_minutes: 1,
      },
      fedapayExternal: { kind: 'missing', status: null, id: null, provableEmpty: true },
      refund: { status: 'refund_pending', provider: 'fedapay', providerRef: null, unsupported: false, blankRef: true },
    });
    expect(await run.service.reconcilePending()).toBe(0);
    expect((run.calls.refund[0] as { trustEmptyList?: boolean }).trustEmptyList).toBe(false);
  });

  it('resends a row the cron loaded with its send-attempt marker', async () => {
    expect(PENDING_REFUNDS).toContain('refund_send_attempted_at');
    for (const provider of ['mtn', 'freemopay', 'fedapay']) {
      const currency = provider === 'fedapay' ? 'XOF' : 'XAF';
      const row = pendingRefund({
        refund_provider: provider,
        refund_provider_ref: null,
        refund_sent_at: null,
        refund_send_attempted_at: '2026-11-18T00:00:00.000Z',
        currency,
      });
      const sent = { status: 'refund_pending', provider, providerRef: 'again', unsupported: false };
      const run = harness({
        pending: [row],
        collects: [{ amount: 100, currency, provider, customer_phone: '2376700006712', transaction_id: 'tx' }],
        refund: sent,
      });
      await run.service.reconcilePending();
      expect(run.calls.refund).toHaveLength(1);
    }
  });

  it('does not credit an MTN miss, and waits before resending a fresh accept', async () => {
    const ref = stableRefundReference(BOOKING);
    const collects = [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }];
    const sent = { status: 'refund_pending', provider: 'mtn', providerRef: ref, unsupported: false };
    const timeout = harness({
      poll: 'missing',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'mtn',
        refund_provider_ref: null,
        refund_sent_at: null,
      },
    });
    await expect(timeout.service.markRefund(BOOKING, { status: 'unpaid', note: 'timed out' })).rejects.toMatchObject({
      status: 409,
    });
    expect(timeout.momo.probe).toHaveBeenCalledWith('mtn', ref);
    expect(timeout.calls.restore).toBe(0);
    const fresh = pendingRefund({ refund_provider: 'mtn', refund_provider_ref: ref, refund_sent_at: new Date().toISOString() });
    const young = harness({ pending: [fresh], poll: 'missing', collects, refund: sent });
    expect(await young.service.reconcilePending()).toBe(0);
    expect(young.calls.refund).toHaveLength(0);
    const agedRow = pendingRefund({
      refund_provider: 'mtn',
      refund_provider_ref: ref,
      refund_sent_at: '2020-01-01T00:00:00.000Z',
    });
    const aged = harness({ pending: [agedRow], poll: 'missing', collects, refund: sent });
    expect(await aged.service.reconcilePending()).toBe(0);
    expect(aged.calls.refund).toHaveLength(1);
    expect((aged.calls.refund[0] as { referenceId?: string }).referenceId).toBe(ref);
    const failed = harness({
      poll: 'failed',
      booking: {
        status: 'cancelled',
        refund_status: 'refund_pending',
        refund_amount: 100,
        refund_provider: 'mtn',
        refund_provider_ref: ref,
        refund_sent_at: '2026-11-18T00:00:00.000Z',
      },
    });
    await expect(failed.service.markRefund(BOOKING, { status: 'unpaid', note: 'provider failed' })).resolves.toEqual({
      refundStatus: 'failed',
    });
    expect(failed.calls.restore).toBe(1);
  });

  it('keeps a refunded mark on this booking and refuses a failed payout', async () => {
    const row = {
      status: 'cancelled',
      refund_status: 'refund_pending',
      refund_amount: 100,
      refund_provider: 'freemopay',
      refund_provider_ref: 'FP-1',
      refund_sent_at: '2026-11-18T00:00:00.000Z',
    };
    const foreign = harness({ poll: 'refunded', booking: row });
    await expect(foreign.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-2' })).rejects.toMatchObject({
      status: 400,
    });
    expect(foreign.state.refund_provider_ref).toBe('FP-1');
    const failed = harness({ poll: 'failed', booking: row });
    await expect(failed.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-1' })).rejects.toMatchObject({
      status: 409,
    });
    expect(failed.state.refund_status).toBe('refund_pending');
    const missed = harness({ poll: 'missing', booking: row });
    await expect(missed.service.markRefund(BOOKING, { status: 'refunded', providerRef: 'FP-1' })).rejects.toMatchObject({
      status: 409,
    });
    expect(missed.state.refund_status).toBe('refund_pending');
    const typed = harness({ poll: 'refunded', booking: row });
    await typed.service.markRefund(BOOKING, { status: 'refunded', providerRef: stableRefundReference(BOOKING) });
    expect(typed.state.refund_provider_ref).toBe('FP-1');
    expect(typed.calls.renter).toEqual([expect.objectContaining({ landed: 'sent' })]);
  });

  it('retries a failed renter notice three times and then stops', async () => {
    const row = pendingRefund({
      refund_status: 'failed',
      refund_amount: 100,
      refund_credited_at: '2026-11-18T00:00:00.000Z',
      refund_notices: ['renter_try:1'],
    });
    const failed = harness({ pending: [row], noticeRetries: [row], renterFails: true });
    await failed.service.reconcilePending();
    await failed.service.reconcilePending();
    expect(failed.calls.renter).toHaveLength(2);
    expect(row.refund_notices).toEqual(['renter_try:1', 'renter_try:2', 'renter_try:3']);
    await failed.service.reconcilePending();
    expect(failed.calls.renter).toHaveLength(2);
    const done = pendingRefund({
      refund_status: 'failed',
      refund_amount: 100,
      refund_credited_at: '2026-11-18T00:00:00.000Z',
      refund_notices: ['renter_try:1'],
    });
    const ok = harness({ pending: [done], noticeRetries: [done] });
    await ok.service.reconcilePending();
    expect(done.refund_notices).toContain('renter_landed');
    await ok.service.reconcilePending();
    expect(ok.calls.renter).toHaveLength(1);
    expect(RENTER_NOTICE_RETRIES).toContain('$try3');
    expect(RENTER_NOTICE_RETRIES).toContain('refund_status_at: asc');
    const older = pendingRefund({
      id: '55555555-5555-4555-8555-555555555555',
      refund_status: 'failed',
      refund_amount: 100,
      refund_status_at: '2020-01-01T00:00:00.000Z',
      refund_notices: ['renter_try:1'],
    });
    const newer = pendingRefund({
      id: '66666666-6666-4666-8666-666666666666',
      refund_status: 'failed',
      refund_amount: 100,
      refund_status_at: '2026-01-01T00:00:00.000Z',
      refund_notices: ['renter_try:1'],
    });
    const exhausted = pendingRefund({
      id: '77777777-7777-4777-8777-777777777777',
      refund_status: 'failed',
      refund_amount: 100,
      refund_status_at: '2019-01-01T00:00:00.000Z',
      refund_notices: ['renter_try:1', 'renter_try:2', 'renter_try:3'],
    });
    const ordered = harness({ pending: [older, newer, exhausted], noticeRetries: [newer, exhausted, older] });
    await ordered.service.reconcilePending();
    expect(ordered.calls.renter.map((item) => item.bookingId)).toEqual([older.id, newer.id]);
  });

  it('hides the decline on a booking read when the flag is off', async () => {
    const { service, hasura } = harness({ flag: false });
    const decorated = await service.decorateBooking(booking());
    expect(decorated.condition_decline).toBeUndefined();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });
});
