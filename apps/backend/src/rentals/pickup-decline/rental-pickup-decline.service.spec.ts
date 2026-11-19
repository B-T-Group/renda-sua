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
  pinFails?: number;
  claimLoses?: boolean;
  stampFails?: boolean;
  stealClaim?: boolean;
  dropOwnedWrite?: boolean;
  noticeFails?: boolean;
  renterFails?: boolean;
  poll?: 'refunded' | 'failed' | 'refund_pending' | 'missing' | 'unknown';
  probeFor?: (ref: string) => 'refunded' | 'failed' | 'refund_pending' | 'missing' | 'unknown';
  noticeRetries?: Array<Record<string, unknown>>;
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
    support: 0,
    supportPayload: null as { outcome?: string; externalId?: string; walletCredited?: boolean } | null,
    renter: [] as Array<{ landed?: string; amount?: number; currency?: string; bookingId?: string }>,
    cas: 0,
    claimAtSend: null as string | null,
  };
  const hasura = {
    executeQuery: jest.fn(async (query: string) => {
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
      if (query.includes('DeleteConditionDecline')) {
        declines.splice(0, declines.length);
        return { delete_rental_condition_declines_by_pk: { id: 'decline-1' } };
      }
      if (query.includes('ClaimDeclineRefund')) {
        const row = refundRow((vars as { id?: string }).id);
        const attempts = Number(row.refund_attempts ?? 0);
        const same = attempts === (vars as { attempts?: number }).attempts;
        if (options.claimLoses || row.refund_status !== 'refund_pending' || !same) {
          return { update_rental_bookings: { affected_rows: 0 } };
        }
        Object.assign(row, vars.set);
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
        if (historyFails > 0) {
          historyFails -= 1;
          throw new Error('history fk');
        }
        const row = refundRow((vars as { id?: string }).id);
        const token = (vars as { token?: string }).token;
        if (options.dropOwnedWrite || row.refund_claim_token !== token) return { close_decline_refund: [] };
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
      calls.refund.push(request);
      calls.claimAtSend = (state.refund_claim_token as string | null) ?? null;
      if (options.refundThrows) throw new Error('timeout');
      return options.refund ?? { status: 'refunded', provider: 'mtn', providerRef: 'ref-1', unsupported: false };
    }),
    poll: jest.fn(async () => options.poll ?? 'refund_pending'),
    probe: jest.fn(async (_provider: string, ref: string) => options.probeFor?.(ref) ?? options.poll ?? 'refund_pending'),
    probeByExternalId: jest.fn(async () => options.external ?? options.poll ?? 'refund_pending'),
    externalRefundId: (bookingId: string) => `rental-decline-${bookingId}`,
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
        return true;
      }),
      notifyRenterConditionRefund: jest.fn(async (payload: { landed?: string; amount?: number; currency?: string }) => {
        calls.renter.push(payload);
        return options.renterFails ? false : true;
      }),
    } as never,
    {
      clearPinForOrder: jest.fn(async () => {
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
        calls.consume += 1;
        const next = consumeHoldForPayout(wallet, amount);
        wallet.available = next.available;
        wallet.withheld = next.withheld;
      }),
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
    } as never
  );
  return { service, state, calls, momo, hasura, wallet, historyNotes };
}

const input = { versionId: VERSION, reason: 'damaged' };

function collect() {
  return [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }];
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
    expect(absent.momo.probeByExternalId).toHaveBeenCalled();
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
