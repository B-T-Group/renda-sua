import {
  preferLiveStripeTransaction,
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';

function tx(
  overrides: Partial<StripePaymentTransaction>
): StripePaymentTransaction {
  return {
    id: 'tx-1',
    reference: 'ST1',
    amount: 10,
    currency: 'CAD',
    status: 'pending',
    transaction_type: 'PAYMENT',
    created_at: '2026-08-13T10:00:00.000Z',
    updated_at: '2026-08-13T10:00:00.000Z',
    ...overrides,
  };
}

describe('preferLiveStripeTransaction', () => {
  it('prefers authorized over a newer pending retry', () => {
    const pendingRetry = tx({
      id: 'tx-pending',
      status: 'pending',
      created_at: '2026-08-13T11:00:00.000Z',
    });
    const authorized = tx({
      id: 'tx-authorized',
      status: 'authorized',
      created_at: '2026-08-13T10:00:00.000Z',
    });
    expect(preferLiveStripeTransaction([pendingRetry, authorized])?.id).toBe(
      'tx-authorized'
    );
  });

  it('prefers success over a newer cancelled session', () => {
    const cancelled = tx({
      id: 'tx-cancelled',
      status: 'cancelled',
      created_at: '2026-08-13T11:00:00.000Z',
    });
    const success = tx({
      id: 'tx-success',
      status: 'success',
      created_at: '2026-08-13T10:00:00.000Z',
    });
    expect(preferLiveStripeTransaction([cancelled, success])?.id).toBe(
      'tx-success'
    );
  });

  it('returns pending when no live payment exists', () => {
    const pending = tx({ id: 'tx-pending', status: 'pending' });
    const cancelled = tx({
      id: 'tx-cancelled',
      status: 'cancelled',
      created_at: '2026-08-13T09:00:00.000Z',
    });
    expect(preferLiveStripeTransaction([pending, cancelled])?.id).toBe(
      'tx-pending'
    );
  });

  it('returns null for an empty list', () => {
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
      const authorizedTx = tx({
        id: 'tx-authorized',
        entity_id: 'ORDER-1001',
        status: 'authorized',
      });
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
      expect(query).toContain('limit: 20');
      expect(variables).toEqual({ entityId: 'ORDER-1001' });
    });

    it('returns the authorized row when a newer pending retry exists', async () => {
      const pendingRetry = tx({
        id: 'tx-pending',
        entity_id: 'ORDER-1001',
        status: 'pending',
        created_at: '2026-08-13T11:00:00.000Z',
      });
      const authorized = tx({
        id: 'tx-authorized',
        entity_id: 'ORDER-1001',
        status: 'authorized',
        created_at: '2026-08-13T10:00:00.000Z',
      });
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [pendingRetry, authorized],
      });

      await expect(
        service.getTransactionByEntityId('ORDER-1001')
      ).resolves.toEqual(authorized);
    });

    it('returns null when no non-failed transaction exists', async () => {
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [],
      });

      await expect(
        service.getTransactionByEntityId('ORDER-1001')
      ).resolves.toBeNull();
    });
  });
});
