import { HttpException } from '@nestjs/common';
import { BusinessItemsService } from './business-items.service';

/** Editing a rejected item: appeal-withdraw confirmation and not-allowed categories (spec §3 edge cases). */
function build(gate: { resubmit: boolean; withdrawsAppealId: string | null } | Error) {
  const itemsService = { updateItem: jest.fn().mockResolvedValue({ id: 'i1' }), adminUpdateItem: jest.fn() };
  const rejections = {
    assertResubmitAllowed: gate instanceof Error ? jest.fn().mockRejectedValue(gate) : jest.fn().mockResolvedValue({ ...gate, category: 'x', rejectedAt: null }),
    noteResubmitted: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BusinessItemsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    itemsService as any,
    {} as any,
    {} as any,
    { recompute: jest.fn().mockResolvedValue(undefined) } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { incrementGeneration: jest.fn() } as any,
    rejections as any
  );
  const s = service as any;
  jest.spyOn(s, 'assertOfflinePaymentAllowed').mockResolvedValue(undefined);
  jest.spyOn(s, 'loadItemModerationRow').mockResolvedValue({ id: 'i1', business_id: 'b1', moderation_status: 'rejected' });
  jest.spyOn(s, 'buildUpdatePayload').mockImplementation(async (_b: unknown, u: unknown) => u);
  const reset = jest.spyOn(s, 'resetRejectedItemToPendingModeration').mockResolvedValue(undefined);
  return { service, itemsService, rejections, reset };
}

describe('BusinessItemsService editing a rejected item', () => {
  it('resubmits and passes the confirmation flag; the flag never reaches the item payload', async () => {
    const { service, itemsService, rejections, reset } = build({ resubmit: true, withdrawsAppealId: 'a1' });
    await service.updateItem('b1', 'i1', { name: 'Lamp v2', confirmWithdrawAppeal: true });
    expect(rejections.assertResubmitAllowed).toHaveBeenCalledWith('i1', { confirmWithdrawAppeal: true });
    expect(itemsService.updateItem).toHaveBeenCalledWith('b1', 'i1', { name: 'Lamp v2' });
    expect(reset).toHaveBeenCalledWith('i1');
    expect(rejections.noteResubmitted).toHaveBeenCalled();
  });

  it('pending appeal without confirmation: 409 and nothing is saved', async () => {
    const err = new HttpException({ code: 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED' }, 409);
    const { service, itemsService, reset } = build(err);
    await expect(service.updateItem('b1', 'i1', { name: 'Lamp v2' })).rejects.toBe(err);
    expect(itemsService.updateItem).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('prohibited/counterfeit: the edit is saved but the item stays rejected', async () => {
    const { service, itemsService, reset } = build({ resubmit: false, withdrawsAppealId: null });
    await service.updateItem('b1', 'i1', { description: 'Updated' });
    expect(itemsService.updateItem).toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('toggling is_active alone does not resubmit or consult the gate', async () => {
    const { service, rejections, reset } = build({ resubmit: true, withdrawsAppealId: null });
    await service.updateItem('b1', 'i1', { is_active: false });
    expect(rejections.assertResubmitAllowed).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });
});
