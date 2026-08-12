import { StripePaymentsDatabaseService } from './stripe-payments-database.service';

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
  });
});
