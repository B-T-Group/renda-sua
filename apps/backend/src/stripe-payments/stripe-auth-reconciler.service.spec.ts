import { StripeAuthReconcilerService } from './stripe-auth-reconciler.service';

function reconciler() {
  const queries: string[] = [];
  const mutations: Array<{ query: string; vars: any }> = [];
  const rec: any = Object.create(StripeAuthReconcilerService.prototype);
  rec.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  rec.databaseService = { updateTransaction: jest.fn() };
  rec.orderSystemJobsService = { onOrderPaymentFailed: jest.fn() };
  rec.hasuraSystemService = {
    executeQuery: jest.fn(async (query: string) => {
      queries.push(query);
      if (query.includes('rental_bookings')) {
        return { rental_bookings: [rec.booking] };
      }
      if (query.includes('rental_status_history')) {
        return { rental_status_history: rec.notes };
      }
      return { orders: rec.orders ?? [] };
    }),
    executeMutation: jest.fn(async (query: string, vars: any) => {
      mutations.push({ query, vars });
      if (query.includes('update_rental_bookings')) {
        return { update_rental_bookings: { affected_rows: rec.cancelRows } };
      }
      return { insert_rental_status_history_one: { id: 'h1' } };
    }),
  };
  rec.booking = null;
  rec.notes = [];
  rec.cancelRows = 1;
  return { rec, queries, mutations };
}

describe('StripeAuthReconcilerService rentals', () => {
  it('cancels a proposed rental when the card authorization is canceled', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'proposed',
      payment_status: 'authorized',
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations[0].query).toContain('status: { _eq: proposed }');
    expect(mutations[1].vars.object.notes).toBe('Stripe authorization lapsed');
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
    expect(rec.orderSystemJobsService.onOrderPaymentFailed).not.toHaveBeenCalled();
  });

  it('leaves an out rental open and notes the lapse once', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'active',
      payment_status: 'authorized',
    };
    rec.notes = [];
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations.some((m) => m.query.includes('update_rental_bookings'))).toBe(
      false
    );
    expect(mutations).toHaveLength(1);
    rec.notes = [{ id: 'h1' }];
    mutations.length = 0;
    await rec.handleCanceledStripeAuthorization('tx2', 'RB1', 'rental_booking');
    expect(mutations).toHaveLength(0);
  });

  it('still fails an assigned order when its authorization lapses', async () => {
    const { rec } = reconciler();
    rec.orders = [
      {
        id: 'o1',
        order_number: 'ORD1',
        current_status: 'assigned_to_agent',
        payment_status: 'authorized',
      },
    ];
    await rec.handleCanceledStripeAuthorization('tx1', 'ORD1', 'order');
    expect(rec.orderSystemJobsService.onOrderPaymentFailed).toHaveBeenCalledWith(
      'o1',
      'Payment authorization expired before pickup'
    );
  });
});
