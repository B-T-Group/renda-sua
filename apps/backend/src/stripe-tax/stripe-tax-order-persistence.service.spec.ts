import { StripeTaxOrderPersistenceService } from './stripe-tax-order-persistence.service';

describe('StripeTaxOrderPersistenceService', () => {
  const hasura = {
    executeMutation: jest.fn(),
    executeQuery: jest.fn(),
  };
  const stripeService = {
    retrieveCheckoutSessionExpanded: jest.fn(),
  };
  const paymentsDb = {
    updateTransaction: jest.fn(),
  };
  const taxBuilder = {
    fromMinorUnits: jest.fn((amount: number) => amount / 100),
  };

  const service = new StripeTaxOrderPersistenceService(
    hasura as any,
    stripeService as any,
    paymentsDb as any,
    taxBuilder as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips finalize when order tax is already finalized', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders: [{ id: 'order-1', currency: 'CAD', tax_status: 'finalized' }],
    });

    await service.finalizeFromCheckoutSession(
      'ORD-1',
      { id: 'cs_1', amount_total: 11500 } as any,
      'tx-1'
    );

    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(paymentsDb.updateTransaction).not.toHaveBeenCalled();
  });

  it('persists tax snapshot from checkout session totals', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders: [{ id: 'order-1', currency: 'CAD', tax_status: 'estimated' }],
    });

    await service.finalizeFromCheckoutSession(
      'ORD-1',
      {
        id: 'cs_1',
        amount_total: 11500,
        amount_subtotal: 10000,
        total_details: {
          amount_tax: 1500,
          breakdown: { tax: [{ amount: 1500 }] },
        },
        customer_details: {
          address: { state: 'ON', country: 'CA' },
        },
      } as any,
      'tx-1'
    );

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_orders_by_pk'),
      expect.objectContaining({
        orderId: 'order-1',
        taxAmount: 15,
        totalAmount: 115,
        taxStatus: 'finalized',
      })
    );
    expect(paymentsDb.updateTransaction).toHaveBeenCalledWith('tx-1', {
      amount: 115,
      amount_subtotal: 100,
      amount_tax: 15,
    });
  });
});
