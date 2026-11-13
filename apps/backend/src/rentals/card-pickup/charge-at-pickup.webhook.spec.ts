import { ChargeAtPickupService } from './charge-at-pickup.service';

describe('charge at pickup webhook claim', () => {
  it('ledgers a captured contract once when the webhook is delivered twice', async () => {
    const ledger = jest.fn().mockResolvedValue({ success: true });
    const events: string[] = [];
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        rental_bookings: [{ id: 'booking-1' }],
        rental_bookings_by_pk: {
          id: 'booking-1',
          booking_number: 'RB-204917',
          currency: 'XAF',
          total_amount: 45000,
          client: { user_id: 'user-1' },
          rental_location_listing: { business_location_id: 'loc-1' },
          end_at: '2026-11-25T19:00:00.000Z',
          created_at: '2026-11-13T12:00:00.000Z',
        },
      }),
      executeMutation: jest.fn(async (_q: string, vars: { object?: { event_key?: string } }) => {
        const key = vars.object?.event_key;
        if (!key) return { insert_rental_card_money_events_one: { id: 'x' } };
        if (events.includes(key)) {
          throw new Error('Uniqueness violation. event_key');
        }
        events.push(key);
        return { insert_rental_card_money_events_one: { id: key } };
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-client' }),
      ensureAccountForBusinessLocation: jest.fn().mockResolvedValue({ id: 'acct-business' }),
    };
    const service = new ChargeAtPickupService(
      hasura as never,
      {} as never,
      {} as never,
      { registerTransaction: ledger } as never,
      { sendRentalCardPickupPush: jest.fn(), sendRentalSupportAlert: jest.fn() } as never,
      { trackEvent: jest.fn().mockResolvedValue(undefined) } as never,
      { get: jest.fn() } as never
    );
    const tx = {
      id: 'tx',
      reference: 'ref',
      amount: 45000,
      currency: 'XAF',
      status: 'success' as const,
      transaction_type: 'PAYMENT' as const,
      entity_id: 'RB-204917',
      stripe_payment_intent_id: 'pi_contract',
      payment_entity: 'rental_pickup_contract' as const,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await service.onContractEvent(tx);
    await service.onContractEvent(tx);
    expect(events).toEqual(['contract:pi_contract:succeeded']);
    expect(ledger).toHaveBeenCalledTimes(3);
  });
});

function nowIso(): string {
  return '2026-11-13T12:00:00.000Z';
}
