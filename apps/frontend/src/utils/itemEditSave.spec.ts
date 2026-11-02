import { patchItemWithAppealConfirm } from './itemEditSave';

function withdrawRequired() {
  const error = new Error('confirm required') as Error & {
    response?: { data?: { code?: string } };
  };
  error.response = { data: { code: 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED' } };
  return error;
}

describe('patchItemWithAppealConfirm', () => {
  it('retries the same PATCH with confirmWithdrawAppeal after 409 confirm', async () => {
    const updateItem = jest
      .fn()
      .mockRejectedValueOnce(withdrawRequired())
      .mockResolvedValueOnce({ id: 'item-1' });
    const result = await patchItemWithAppealConfirm(
      updateItem,
      'item-1',
      { name: 'Lamp v2' },
      async () => true
    );
    expect(result).toEqual({ ok: true, data: { id: 'item-1' } });
    expect(updateItem).toHaveBeenNthCalledWith(1, 'item-1', { name: 'Lamp v2' });
    expect(updateItem).toHaveBeenNthCalledWith(2, 'item-1', {
      name: 'Lamp v2',
      confirmWithdrawAppeal: true,
    });
  });

  it('does not retry when the user cancels the 409 confirm', async () => {
    const updateItem = jest.fn().mockRejectedValue(withdrawRequired());
    const result = await patchItemWithAppealConfirm(
      updateItem,
      'item-1',
      { name: 'Lamp v2' },
      async () => false
    );
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(updateItem).toHaveBeenCalledWith('item-1', { name: 'Lamp v2' });
  });
});
