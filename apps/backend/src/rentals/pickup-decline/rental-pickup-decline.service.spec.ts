import { HttpException } from '@nestjs/common';
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
  refund?: { status: string; providerRef: string | null; unsupported: boolean; provider: string };
  declines?: Array<Record<string, unknown>>;
} = {}) {
  const state = booking(options.booking);
  const declines = [...(options.declines ?? [])];
  const calls = { release: 0, refund: [] as unknown[], support: 0, cas: 0 };
  const hasura = {
    executeQuery: jest.fn(async (query: string) => {
      if (query.includes('DeclineBooking')) return { rental_bookings_by_pk: { ...state, client: state.client, business: state.business } };
      if (query.includes('FindConditionDecline') || query.includes('FindDeclineForBooking')) {
        return { rental_condition_declines: declines };
      }
      if (query.includes('DeclineCollects')) return { mobile_payment_transactions: options.collects ?? [] };
      if (query.includes('DeclineHold')) {
        return { rental_holds: options.hold ? [{ client_hold_amount: options.hold, status: 'active' }] : [] };
      }
      if (query.includes('DeclineReadyPhotos')) return { rental_condition_decline_photos: [] };
      return {};
    }),
    executeMutation: jest.fn(async (query: string, vars: { from?: string[]; set?: Record<string, unknown>; object?: Record<string, unknown> }) => {
      if (query.includes('CasUpdateRentalBooking')) {
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
        const row = { id: 'decline-1', ...(vars.object ?? {}) };
        declines.push(row);
        return { insert_rental_condition_declines_one: { id: 'decline-1' } };
      }
      if (query.includes('StampDeclineRefund') || query.includes('ApplyDeclineRefundPoll')) {
        Object.assign(state, vars.set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      return { update_rental_bookings: { affected_rows: 1 }, insert_rental_status_history_one: { id: 'h' } };
    }),
  };
  const momo = {
    refund: jest.fn(async (request: unknown) => {
      calls.refund.push(request);
      return options.refund ?? { status: 'refunded', provider: 'mtn', providerRef: 'ref-1', unsupported: false };
    }),
    poll: jest.fn(async () => 'refund_pending'),
  };
  const service = new RentalPickupDeclineService(
    hasura as never,
    { getUser: jest.fn(async () => options.user ?? { id: 'user-1', active_persona: 'client', client: { id: CLIENT } }) } as never,
    { pickupDeclineEnabled: jest.fn(async () => options.flag !== false) } as never,
    momo as never,
    { signedForDecline: jest.fn(async () => []) } as never,
    {
      sendConditionDeclinedNotice: jest.fn(async () => undefined),
      notifySupportConditionRefund: jest.fn(async () => {
        calls.support += 1;
      }),
    } as never,
    { clearPinForOrder: jest.fn(async () => undefined) } as never,
    {
      releaseFreeCancelFunds: jest.fn(async () => {
        calls.release += 1;
        if (options.releaseThrows) throw new Error('stripe void failed');
      }),
    } as never
  );
  return { service, state, calls, momo, hasura };
}

const input = { versionId: VERSION, reason: 'damaged' };

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

  it('refunds only the collected Mobile Money amount', async () => {
    const { service, calls } = harness({
      collects: [{ amount: 100, currency: 'XAF', provider: 'mtn', customer_phone: '2376700006712', transaction_id: 'tx' }],
    });
    const result = await service.decline(BOOKING, input);
    expect(result.rail).toBe('momo_paid');
    expect(result.amount).toBe(100);
    expect(result.refundStatus).toBe('refunded');
    expect(result.phoneMask).toBe('····· 67 12');
    expect(calls.refund[0]).toMatchObject({ amount: 100, currency: 'XAF' });
    expect(calls.release).toBe(1);
  });

  it('leaves an unsupported provider pending and tells support', async () => {
    const { service, calls, state } = harness({
      collects: [{ amount: 45000, currency: 'XAF', provider: 'mypvit', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'refund_pending', provider: 'mypvit', providerRef: null, unsupported: true },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('refund_pending');
    expect(state.refund_status).toBe('refund_pending');
    expect(calls.support).toBe(1);
    expect((calls.refund[0] as { amount: number }).amount).toBe(45000);
  });

  it('records a failed refund and does not pretend it succeeded', async () => {
    const { service, calls } = harness({
      collects: [{ amount: 100, currency: 'XAF', provider: 'freemopay', customer_phone: '2376700006712', transaction_id: 'tx' }],
      refund: { status: 'failed', provider: 'freemopay', providerRef: 'ref', unsupported: false },
    });
    const result = await service.decline(BOOKING, input);
    expect(result.refundStatus).toBe('failed');
    expect(calls.support).toBe(1);
  });

  it('returns the stored decline without calling the provider again', async () => {
    const { service, calls } = harness({
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
      }],
    });
    const result = await service.decline(BOOKING, input);
    expect(result.idempotent).toBe(true);
    expect(result.refundStatus).toBe('refunded');
    expect(calls.release).toBe(0);
    expect(calls.refund).toHaveLength(0);
    expect(calls.cas).toBe(0);
  });

  it('hides the decline on a booking read when the flag is off', async () => {
    const { service, hasura } = harness({ flag: false });
    const decorated = await service.decorateBooking(booking());
    expect(decorated.condition_decline).toBeUndefined();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });
});
