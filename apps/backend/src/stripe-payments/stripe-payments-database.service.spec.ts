import {
  preferLiveStripeTransaction,
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';

function tx(
  id: string,
  status: StripePaymentTransaction['status']
): StripePaymentTransaction {
  return {
    id,
    reference: id,
    amount: 1000,
    currency: 'CAD',
    status,
    transaction_type: 'PAYMENT',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
  };
}

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
      expect(query).toContain('limit: 20');
      expect(query).toContain('entity_id: { _eq: $entityId }');
      expect(variables).toEqual({ entityId: 'ORDER-1001' });
    });

    it('prefers an older authorized payment over a newer pending retry', async () => {
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [
          tx('tx-pending-retry', 'pending'),
          tx('tx-authorized', 'authorized'),
        ],
      });

      await expect(
        service.getTransactionByEntityId('ORDER-1001')
      ).resolves.toEqual(expect.objectContaining({ id: 'tx-authorized' }));
    });

    it('falls back to pending when no live payment exists', async () => {
      hasuraService.executeQuery.mockResolvedValue({
        stripe_payment_transactions: [
          tx('tx-cancelled', 'cancelled'),
          tx('tx-pending', 'pending'),
        ],
      });

      await expect(
        service.getTransactionByEntityId('ORDER-1001')
      ).resolves.toEqual(expect.objectContaining({ id: 'tx-pending' }));
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

  describe('preferLiveStripeTransaction', () => {
    it('selects the first live status in created_at desc order', () => {
      expect(
        preferLiveStripeTransaction([
          tx('pending', 'pending'),
          tx('capture', 'capture_pending'),
          tx('authorized', 'authorized'),
        ])?.id
      ).toBe('capture');
    });

    it('returns null for an empty list', () => {
      expect(preferLiveStripeTransaction([])).toBeNull();
    });
  });
});
