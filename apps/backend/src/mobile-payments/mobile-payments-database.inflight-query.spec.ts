import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';

describe('in-flight mobile payment queries', () => {
  const row = {
    id: 'tx-1',
    reference: 'ORD-1-a',
    status: 'processing',
    amount: 1000,
    currency: 'XAF',
  };

  function service(rows: unknown[] | undefined = [row]) {
    const executeQuery = jest.fn().mockResolvedValue({
      mobile_payment_transactions: rows,
    });
    const db = new MobilePaymentsDatabaseService({ executeQuery } as never);
    return { db, executeQuery };
  }

  function queryOf(executeQuery: jest.Mock): string {
    return executeQuery.mock.calls[0][0] as string;
  }

  it('loads the latest pending or processing order payment', async () => {
    const { db, executeQuery } = service();

    await expect(
      db.getPendingOrderPaymentTransactionByOrderNumber('ORD-1')
    ).resolves.toEqual(row);
    expect(executeQuery.mock.calls[0][1]).toEqual({ orderNumber: 'ORD-1' });
    const query = queryOf(executeQuery);
    expect(query).toContain('payment_entity: { _eq: order }');
    expect(query).toContain('status: { _in: ["pending", "processing"] }');
    expect(query).toContain('entity_id: { _eq: $orderNumber }');
    expect(query).toContain('limit: 1');
  });

  it('returns null when no in-flight order payment exists', async () => {
    const { db } = service([]);

    await expect(
      db.getPendingOrderPaymentTransactionByOrderNumber('ORD-1')
    ).resolves.toBeNull();
  });

  it('treats a successful order collect as collection proof', async () => {
    const { db, executeQuery } = service([{ id: 'tx-ok' }]);

    await expect(db.hasSuccessfulOrderPayment('ORD-1', '  ')).resolves.toBe(
      true
    );
    expect(executeQuery.mock.calls[0][1]).toEqual({ ids: ['ORD-1'] });
    const query = queryOf(executeQuery);
    expect(query).toContain('payment_entity: { _eq: order }');
    expect(query).toContain('status: { _eq: "success" }');
    expect(query).toContain('entity_id: { _in: $ids }');
  });

  it('returns false when no successful order collect exists', async () => {
    const { db } = service([]);

    await expect(db.hasSuccessfulOrderPayment('ORD-1')).resolves.toBe(false);
  });

  it('skips the proof query for blank ids and dedupes repeats', async () => {
    const { db, executeQuery } = service([{ id: 'tx-ok' }]);

    await expect(db.hasSuccessfulOrderPayment('  ', '')).resolves.toBe(false);
    expect(executeQuery).not.toHaveBeenCalled();

    await expect(db.hasSuccessfulOrderPayment('ORD-1', ' ORD-1 ', 'ORD-2')).resolves.toBe(true);
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(executeQuery.mock.calls[0][1]).toEqual({ ids: ['ORD-1', 'ORD-2'] });
  });

  it('treats a missing transaction list as no collection proof', async () => {
    const executeQuery = jest.fn().mockResolvedValue({});
    const db = new MobilePaymentsDatabaseService({ executeQuery } as never);

    await expect(db.hasSuccessfulOrderPayment('ORD-1')).resolves.toBe(false);
  });

  it('lists give-change withdrawals that are still pending only', async () => {
    const { db, executeQuery } = service();

    await expect(db.getPendingGiveChangeWithdrawals()).resolves.toEqual([row]);
    const query = queryOf(executeQuery);
    expect(query).toContain('status: { _eq: "pending" }');
    expect(query).toContain('transaction_type: { _eq: "GIVE_CHANGE" }');
    expect(query).not.toContain('processing');
  });

  it('treats only a successful rental_booking row as Mobile Money proof', async () => {
    const { db, executeQuery } = service([{ id: 'tx-rental' }]);

    await expect(db.hasSuccessfulRentalBookingPayment('RB-1')).resolves.toBe(true);
    expect(executeQuery.mock.calls[0][1]).toEqual({ bookingNumber: 'RB-1' });
    const query = queryOf(executeQuery);
    expect(query).toContain('payment_entity: { _eq: rental_booking }');
    expect(query).toContain('status: { _eq: "success" }');
    expect(query).toContain('entity_id: { _eq: $bookingNumber }');
    expect(query).not.toContain('pending');
    expect(query).not.toContain('processing');
  });

  it('returns false when the rental payment list is empty or missing', async () => {
    const empty = service([]);
    await expect(empty.db.hasSuccessfulRentalBookingPayment('RB-1')).resolves.toBe(false);

    const missing = new MobilePaymentsDatabaseService({
      executeQuery: jest.fn().mockResolvedValue({}),
    } as never);
    await expect(missing.hasSuccessfulRentalBookingPayment('RB-1')).resolves.toBe(false);
  });

  it('rethrows a rental payment lookup failure instead of calling it unpaid', async () => {
    const executeQuery = jest.fn().mockRejectedValue(new Error('hasura down'));
    const db = new MobilePaymentsDatabaseService({ executeQuery } as never);

    await expect(db.hasSuccessfulRentalBookingPayment('RB-1')).rejects.toThrow('hasura down');
  });

  it('lists pending and processing rows for admin reconciliation', async () => {
    const { db, executeQuery } = service();

    await db.getPendingIntegrationTransactions({ limit: 10, offset: 2 });
    const query = queryOf(executeQuery);
    expect(query).toContain('status: { _in: ["pending", "processing"] }');
    expect(query).toContain('limit: 10');
    expect(query).toContain('offset: 2');
  });
});
