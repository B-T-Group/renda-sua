import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateItem } = vi.hoisted(() => ({
  updateItem: vi.fn(),
}));

vi.mock('./businessApi', () => ({
  businessApi: { catalog: { updateItem } },
}));

vi.mock('./apolloClient', () => ({
  client: { query: vi.fn(), mutate: vi.fn() },
}));

vi.mock('./apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { updateBusinessItemWithAppealConfirm } from './businessItemFormService';

function withdrawRequired() {
  const error = new Error('confirm required') as Error & { code?: string };
  error.code = 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED';
  return error;
}

describe('updateBusinessItemWithAppealConfirm', () => {
  beforeEach(() => {
    updateItem.mockReset();
  });

  it('retries the same PATCH with confirmWithdrawAppeal after 409 confirm', async () => {
    updateItem
      .mockRejectedValueOnce(withdrawRequired())
      .mockResolvedValueOnce({ success: true, data: { item: { id: 'item-1' } } });
    const result = await updateBusinessItemWithAppealConfirm(
      'item-1',
      { name: 'Lamp v2' },
      async () => true
    );
    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateItem).toHaveBeenNthCalledWith(1, 'item-1', { name: 'Lamp v2' });
    expect(updateItem).toHaveBeenNthCalledWith(2, 'item-1', {
      name: 'Lamp v2',
      confirmWithdrawAppeal: true,
    });
  });

  it('does not retry when the user cancels the 409 confirm', async () => {
    updateItem.mockRejectedValue(withdrawRequired());
    const result = await updateBusinessItemWithAppealConfirm(
      'item-1',
      { name: 'Lamp v2' },
      async () => false
    );
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(updateItem).toHaveBeenCalledWith('item-1', { name: 'Lamp v2' });
  });
});
