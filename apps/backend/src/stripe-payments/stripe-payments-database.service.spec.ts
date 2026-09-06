import {
  preferLiveStripeTransaction,
  StripePaymentTransaction,
  StripePaymentsDatabaseService,
} from './stripe-payments-database.service';

function tx(
  overrides: Partial<StripePaymentTransaction> &
    Pick<StripePaymentTransaction, 'id' | 'status'>
): StripePaymentTransaction {
  return {
    reference: overrides.id,
    amount: 10,
    currency: 'usd',
    ...overrides,
  } as StripePaymentTransaction;
}

describe('preferLiveStripeTransaction', () => {
  it('prefers an older authorized payment over a newer pending retry', () => {
    const pendingRetry = tx({ id: 'tx-pending', status: 'pending' });
    const authorized = tx({ id: 'tx-authorized', status: 'authorized' });

    expect(preferLiveStripeTransaction([pendingRetry, authorized])).toEqual(
      authorized
    );
  });

  it('treats capture_pending and success as live over pending', () => {
    const pending = tx({ id: 'tx-pending', status: 'pending' });
    const capturePending = tx({
      id: 'tx-capture',
      status: 'capture_pending',
    });
    const success = tx({ id: 'tx-success', status: 'success' });

    expect(preferLiveStripeTransaction([pending, capturePending])).toEqual(
      capturePending
    );
    expect(preferLiveStripeTransaction([pending, success])).toEqual(success);
  });

  it('falls back to pending, then the first row, then null', () => {
    const pending = tx({ id: 'tx-pending', status: 'pending' });
    const failed = tx({ id: 'tx-failed', status: 'failed' });

    expect(preferLiveStripeTransaction([pending])).toEqual(pending);
    expect(preferLiveStripeTransaction([failed])).toEqual(failed);
    expect(preferLiveStripeTransaction([])).toBeNull();
  });
});

describe('StripePaymentsDatabaseService', () => {
  const hasuraService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  let service: StripePaymentsDatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePaymentsDatabaseService(hasuraService as never);
  });

  describe('getTransactionByEntityId', () => {
    it('excludes failed status and orders by created_at desc', async () => {
      const authorizedTx = {
        id: 'tx-authorized',
        entity_id: 'ORDER-1001',
        status: 'authorized',
      };
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [authorizedTx],
      });

      const result = await service.getTransactionByEntityId('ORDER-1001');

      expect(result).toEqual(authorizedTx);
      expect(hasuraService.executeQuery).toHaveBeenCalledTimes(1);
      const [query, variables] = hasuraService.executeQuery.mock.calls[0];
      expect(query).toContain('status: { _neq: "failed" }');
      expect(query).toContain('order_by: { created_at: desc }');
      expect(query).toContain('entity_id: { _eq: $entityId }');
      expect(variables).toEqual({ entityId: 'ORDER-1001' });
    });

    it('returns null when no non-failed transaction exists', async () => {
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [],
      });

      await expect(
        service.getTransactionByEntityId('ORDER-1001')
      ).resolves.toBeNull();
    });

    it('selects the live payment when a newer pending retry is first', async () => {
      const pendingRetry = tx({ id: 'tx-pending', status: 'pending' });
      const authorized = tx({ id: 'tx-authorized', status: 'authorized' });
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [pendingRetry, authorized],
      });

      await expect(service.getTransactionByEntityId('ORDER-1001')).resolves.toEqual(
        authorized
      );
    });
  });
});
