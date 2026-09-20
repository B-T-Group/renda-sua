import { PurchaseCreditsService } from './purchase-credits.service';

describe('PurchaseCreditsService.restore', () => {
  it('puts the redeemed amount back on the grant and deletes the redemption', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        purchase_credit_redemptions: [{ id: 'r1', grant_id: 'g1', amount: 500 }],
      })),
      executeMutation: jest.fn(async () => ({})),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await service.restore('order-1');
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('remaining_amount'),
      { id: 'g1', delta: 500 }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('delete_purchase_credit_redemptions_by_pk'),
      { id: 'r1' }
    );
  });
});
