import { BadRequestException } from '@nestjs/common';
import { PurchaseCreditsService } from './purchase-credits.service';

function service(hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock }) {
  const notifications = { sendPaymentProgramNotice: jest.fn() };
  return {
    service: new PurchaseCreditsService(hasura as never, notifications as never),
    notifications,
  };
}

const anyStoreGrant = {
  userId: 'user-1',
  currency: 'XAF',
  amount: 5000,
  applicability: 'any_store' as const,
};

describe('PurchaseCreditsService.commit', () => {
  it('inserts a redemption then decrements remaining for each allocation', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({})),
    };
    const { service: credits } = service(hasura);

    await credits.commit('order-1', [
      { grantId: 'g1', amount: 400, applicability: 'any_store', businessId: null },
      { grantId: 'g2', amount: 200, applicability: 'specific_business', businessId: 'biz-1' },
    ]);

    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('InsertRedemption'),
      { grantId: 'g1', orderId: 'order-1', amount: 400 }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('remaining_amount'),
      { id: 'g1', delta: -400 }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('InsertRedemption'),
      { grantId: 'g2', orderId: 'order-1', amount: 200 }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('remaining_amount'),
      { id: 'g2', delta: -200 }
    );
  });

  it('stops on the first failed allocation without redeeming the rest', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('adjust failed')),
    };
    const { service: credits } = service(hasura);

    await expect(
      credits.commit('order-1', [
        { grantId: 'g1', amount: 400, applicability: 'any_store', businessId: null },
        { grantId: 'g2', amount: 200, applicability: 'any_store', businessId: null },
      ])
    ).rejects.toThrow('adjust failed');
    expect(hasura.executeMutation).toHaveBeenCalledTimes(2);
  });
});

describe('PurchaseCreditsService.grant', () => {
  it('rejects grant when the user is not a client', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ clients: [] })),
      executeMutation: jest.fn(),
    };
    const { service: credits } = service(hasura);

    await expect(credits.grant(anyStoreGrant)).rejects.toMatchObject({
      message: 'Purchase credits can only be granted to clients',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects specific_business grant when the partner is inactive', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('ClientByUser')) return { clients: [{ id: 'c1' }] };
        return { partner_businesses: [] };
      }),
      executeMutation: jest.fn(),
    };
    const { service: credits } = service(hasura);

    await expect(
      credits.grant({
        ...anyStoreGrant,
        applicability: 'specific_business',
        businessId: 'biz-1',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('allows any_store grant without a partner lookup', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ clients: [{ id: 'c1' }] })),
      executeMutation: jest.fn(async () => ({
        insert_purchase_credit_grants_one: { id: 'g1' },
      })),
    };
    const { service: credits, notifications } = service(hasura);

    await expect(credits.grant(anyStoreGrant)).resolves.toEqual({ id: 'g1' });
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertPurchaseCredit'),
      expect.objectContaining({
        object: expect.objectContaining({
          user_id: 'user-1',
          remaining_amount: 5000,
          applicability: 'any_store',
          business_id: null,
        }),
      })
    );
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({ messageType: 'PURCHASE_CREDIT', entityId: 'g1' })
    );
  });
});
