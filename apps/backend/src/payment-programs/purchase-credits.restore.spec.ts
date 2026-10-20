import { BadRequestException } from '@nestjs/common';
import { PurchaseCreditsService } from './purchase-credits.service';

describe('PurchaseCreditsService.restore', () => {
  it('restores each redemption with ONE atomic function call (delete + re-credit together)', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        purchase_credit_redemptions: [
          { id: 'r1', grant_id: 'g1', amount: 500 },
          { id: 'r2', grant_id: 'g2', amount: 200 },
        ],
      })),
      executeMutation: jest.fn(async () => ({ restore_purchase_credit_redemption: [{ id: 'x' }] })),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await service.restore('order-1');
    expect(hasura.executeMutation.mock.calls.map((c: any[]) => c[1])).toEqual([{ id: 'r1' }, { id: 'r2' }]);
    for (const [q] of hasura.executeMutation.mock.calls as any[]) {
      expect(q).toContain('restore_purchase_credit_redemption(args: { p_redemption_id: $id })');
      expect(q).not.toContain('delete_purchase_credit_redemptions');
      expect(q).not.toContain('remaining_amount');
    }
  });
});

describe('PurchaseCreditsService.commit', () => {
  const allocation = {
    grantId: 'g1',
    amount: 50,
    applicability: 'any_store' as const,
    businessId: null,
  };

  it('debits remaining before inserting a redemption', async () => {
    const hasura = {
      executeMutation: jest.fn(async (mutation: string) => {
        if (mutation.includes('DebitCreditRemaining')) {
          return { update_purchase_credit_grants: { affected_rows: 1 } };
        }
        return { insert_purchase_credit_redemptions_one: { id: 'r1' } };
      }),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await service.commit('order-1', [allocation]);
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('remaining_amount: { _gte: $amount }'),
      { id: 'g1', amount: 50, delta: -50 }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('insert_purchase_credit_redemptions_one'),
      { grantId: 'g1', orderId: 'order-1', amount: 50 }
    );
  });

  it('does not insert a redemption when the grant has insufficient remaining', async () => {
    const hasura = {
      executeMutation: jest.fn(async () => ({
        update_purchase_credit_grants: { affected_rows: 0 },
      })),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await expect(service.commit('order-2', [allocation])).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    expect(hasura.executeMutation.mock.calls[0][0]).toContain('DebitCreditRemaining');
  });

  it('puts remaining back when redemption insert fails after a successful debit', async () => {
    const hasura = {
      executeMutation: jest.fn(async (mutation: string) => {
        if (mutation.includes('DebitCreditRemaining')) {
          return { update_purchase_credit_grants: { affected_rows: 1 } };
        }
        if (mutation.includes('insert_purchase_credit_redemptions_one')) {
          throw new Error('insert failed');
        }
        return { update_purchase_credit_grants: { affected_rows: 1 } };
      }),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await expect(service.commit('order-3', [allocation])).rejects.toThrow('insert failed');
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('CreditCreditRemaining'),
      { id: 'g1', delta: 50 }
    );
  });
});
