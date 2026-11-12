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
        if (rec.cancelBody !== undefined) return rec.cancelBody;
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
      actual_start_at: null,
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations[0].query).toContain('actual_start_at: { _is_null: true }');
    expect(mutations[0].vars.status).toBe('proposed');
    expect(mutations[1].vars.object.notes).toBe('Stripe authorization lapsed');
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
    expect(rec.orderSystemJobsService.onOrderPaymentFailed).not.toHaveBeenCalled();
  });

  it('cancels a confirmed rental that has not started when the card authorization is canceled', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'confirmed',
      payment_status: 'authorized',
      actual_start_at: null,
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations[0].vars.status).toBe('confirmed');
    expect(mutations[0].query).toContain('payment_status: { _eq: authorized }');
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
  });

  it('does not expire the card row when the unstarted cancel loses', async () => {
    const { rec } = reconciler();
    rec.cancelRows = 0;
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'confirmed',
      payment_status: 'authorized',
      actual_start_at: null,
    };
    await expect(
      rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking')
    ).rejects.toThrow(/Could not cancel unstarted rental RB1/);
    expect(rec.databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('leaves a confirmed rental that already started open and notes the lapse', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'confirmed',
      payment_status: 'authorized',
      actual_start_at: '2026-11-01T12:00:00.000Z',
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations.some((m) => m.query.includes('update_rental_bookings'))).toBe(
      false
    );
    expect(mutations[0].vars.object.notes).toBe('Stripe authorization lapsed');
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

  it('cancels a reserved rental that has not started and clears the card hold', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'reserved',
      payment_status: 'authorized',
      actual_start_at: null,
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations[0].vars.status).toBe('reserved');
    expect(mutations[0].query).toContain('status: cancelled');
    expect(mutations[0].query).toContain('payment_status: cancelled');
    expect(mutations[0].query).toContain('contract_expires_at: null');
    expect(mutations[1].vars.object).toMatchObject({
      status: 'reserved',
      previous_status: 'reserved',
      notes: 'Stripe authorization lapsed',
    });
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
  });

  it('does not cancel a rental whose card is no longer authorized', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'confirmed',
      payment_status: 'captured',
      actual_start_at: null,
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations).toHaveLength(0);
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
  });

  it('expires the card row when the rental cannot be found', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = null;
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations).toHaveLength(0);
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
  });

  it.each(['completed', 'cancelled'])(
    'leaves a %s rental in place when the card authorization lapses',
    async (status) => {
      const { rec, mutations } = reconciler();
      rec.booking = {
        id: 'b1',
        booking_number: 'RB1',
        status,
        payment_status: 'authorized',
        actual_start_at: '2026-11-01T12:00:00.000Z',
      };
      await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
      expect(mutations).toHaveLength(0);
      expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
        'tx1',
        expect.objectContaining({ status: 'expired' })
      );
    }
  );

  it('does not cancel a reserved rental that already has a start time', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'reserved',
      payment_status: 'authorized',
      actual_start_at: '2026-11-10T08:00:00.000Z',
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations.some((m) => m.query.includes('update_rental_bookings'))).toBe(
      false
    );
    expect(rec.databaseService.updateTransaction).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ status: 'expired' })
    );
  });

  it('notes an awaiting-return rental once and does not cancel it', async () => {
    const { rec, mutations } = reconciler();
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'awaiting_return',
      payment_status: 'authorized',
      actual_start_at: '2026-11-01T12:00:00.000Z',
    };
    await rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking');
    expect(mutations.some((m) => m.query.includes('update_rental_bookings'))).toBe(
      false
    );
    expect(mutations[0].vars.object).toMatchObject({
      status: 'awaiting_return',
      previous_status: 'awaiting_return',
    });
  });

  it('does not expire the card row when the cancel result is missing', async () => {
    const { rec, mutations } = reconciler();
    rec.cancelBody = { update_rental_bookings: null };
    rec.booking = {
      id: 'b1',
      booking_number: 'RB1',
      status: 'reserved',
      payment_status: 'authorized',
      actual_start_at: null,
    };
    await expect(
      rec.handleCanceledStripeAuthorization('tx1', 'RB1', 'rental_booking')
    ).rejects.toThrow(/Could not cancel unstarted rental RB1/);
    expect(mutations.some((m) => m.query.includes('insert_rental_status_history'))).toBe(
      false
    );
    expect(rec.databaseService.updateTransaction).not.toHaveBeenCalled();
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
