import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));
const publicPost = vi.hoisted(() => vi.fn());

vi.mock('./apiClient', () => ({ api: { get, put, patch } }));
vi.mock('./publicApiClient', () => ({ publicApiPost: publicPost }));

import {
  findLikedRestockItem,
  getLikesWithAlerts,
  getRestockPreferences,
  isRestockDisabledError,
  patchRestockPreferences,
  setItemAlert,
  stopRestockAlertsFromMessage,
} from './restockAlertsApi';

const ITEM = '11111111-2222-4333-8444-555555555555';

function likesPage(items: Array<{ id: string; item_id: string }>, page: number, totalPages: number) {
  return { success: true, data: { items, total: items.length, page, limit: 50, totalPages } };
}

describe('restockAlertsApi (real backend routes and shapes)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads preferences incl. availability flags', async () => {
    const data = { push: true, whatsapp: false, sms: false, whatsapp_available: false, sms_available: true };
    get.mockResolvedValue({ success: true, data });
    await expect(getRestockPreferences()).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith('/restock-alerts/preferences');
  });

  it('patches only the given channels', async () => {
    const data = { push: false, whatsapp: false, sms: false, whatsapp_available: false, sms_available: false };
    patch.mockResolvedValue({ success: true, data });
    await patchRestockPreferences({ push: false });
    expect(patch).toHaveBeenCalledWith('/restock-alerts/preferences', { push: false });
  });

  it('PUTs the bell with the catalog item id and returns state/expires_at', async () => {
    const data = { item_id: ITEM, enabled: false, state: 'disarmed', expires_at: null };
    put.mockResolvedValue({ success: true, data });
    await expect(setItemAlert(ITEM, false)).resolves.toEqual(data);
    expect(put).toHaveBeenCalledWith(`/restock-alerts/items/${ITEM}`, { enabled: false });
  });

  it('requests likes with filter, page and limit and uses totalPages', async () => {
    get.mockResolvedValue(likesPage([], 2, 3));
    const res = await getLikesWithAlerts('back_in_stock', 2, 20);
    expect(get).toHaveBeenCalledWith('/restock-alerts/likes?filter=back_in_stock&page=2&limit=20');
    expect(res.totalPages).toBe(3);
  });

  it('findLikedRestockItem pages until the catalog item id matches', async () => {
    get
      .mockResolvedValueOnce(likesPage([{ id: 'l1', item_id: 'x' }], 1, 2))
      .mockResolvedValueOnce(likesPage([{ id: 'l2', item_id: ITEM }], 2, 2));
    const hit = await findLikedRestockItem(ITEM);
    expect(hit?.id).toBe('l2');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('findLikedRestockItem returns null when not liked', async () => {
    get.mockResolvedValue(likesPage([{ id: 'l1', item_id: 'x' }], 1, 1));
    await expect(findLikedRestockItem(ITEM)).resolves.toBeNull();
  });

  it('stop uses the public route with the token', async () => {
    publicPost.mockResolvedValue({ success: true, data: { channel: 'push', stopped: true } });
    await expect(stopRestockAlertsFromMessage('tok')).resolves.toEqual({
      channel: 'push',
      stopped: true,
    });
    expect(publicPost).toHaveBeenCalledWith('/restock-alerts/stop', { token: 'tok' });
  });

  it('detects the server-disabled error code', () => {
    expect(isRestockDisabledError(Object.assign(new Error('x'), { code: 'restock_alerts_disabled' }))).toBe(true);
    expect(isRestockDisabledError(new Error('x'))).toBe(false);
  });
});
