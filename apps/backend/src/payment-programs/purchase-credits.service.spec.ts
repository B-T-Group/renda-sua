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

describe('PurchaseCreditsService.grantCampaign', () => {
  it('skips a specific_business grant when the partner is inactive', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ partner_businesses: [] })),
      executeMutation: jest.fn(),
    };
    const { service: credits, notifications } = service(hasura);

    await expect(
      credits.grantCampaign({
        ...anyStoreGrant,
        applicability: 'specific_business',
        businessId: 'biz-1',
      })
    ).resolves.toEqual({ skipped: 'partner_inactive' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });

  it('inserts campaign grants with source campaign and no client check', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({
        insert_purchase_credit_grants_one: { id: 'g-camp' },
      })),
    };
    const { service: credits, notifications } = service(hasura);

    await expect(credits.grantCampaign(anyStoreGrant)).resolves.toEqual({
      id: 'g-camp',
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertPurchaseCredit'),
      expect.objectContaining({
        object: expect.objectContaining({
          user_id: 'user-1',
          source: 'campaign',
          applicability: 'any_store',
          business_id: null,
        }),
      })
    );
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'PURCHASE_CREDIT',
        entityId: 'g-camp',
      })
    );
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
