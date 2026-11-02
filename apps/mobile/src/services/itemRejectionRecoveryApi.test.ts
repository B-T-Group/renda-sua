import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('./apiClient', () => ({
  api: { get, post, patch },
  resolveApiUrl: (path: string) => `https://api.test${path}`,
}));

import {
  ITEM_APPEAL_EVIDENCE_UPLOAD_PATH,
  ITEM_APPEALS_PATH,
  ITEM_RECOVERY_PATH,
  itemRejectionRecoveryApi,
} from './itemRejectionRecoveryApi';

describe('itemRejectionRecoveryApi', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
  });

  it('reads GET /recovery', async () => {
    get.mockResolvedValue({
      data: {
        item: {
          id: 'item-1',
          name: 'Lamp',
          moderationStatus: 'rejected',
          statusDisplay: 'needs_changes',
          condition: 'new',
          wearNote: null,
        },
        rejection: {
          id: 'rej-1',
          category: 'photo_quality',
          reason: 'Photos are dark',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        actions: ['ai_fix', 'retake', 'resubmit', 'appeal'],
        resubmitEditLink: null,
        appeal: null,
        appealsUsed: 0,
        appealLimit: 1,
        canAppeal: true,
        canResubmit: true,
        resubmitWithdrawsAppeal: false,
        aiCleanup: { costPerImage: 1, tokenBalance: 3, tokensSpentOnItem: 1 },
        reviewSlaHours: 24,
        appealSlaHours: 48,
      },
    });
    const recovery = await itemRejectionRecoveryApi.getRecovery('item-1');
    expect(get).toHaveBeenCalledWith(ITEM_RECOVERY_PATH('item-1'));
    expect(recovery.actions).toContain('ai_fix');
    expect(recovery.aiCleanup.tokensSpentOnItem).toBe(1);
  });

  it('does not synthesize a payload on 404', async () => {
    const err = new Error('missing') as Error & { status?: number };
    err.status = 404;
    get.mockRejectedValue(err);
    await expect(itemRejectionRecoveryApi.getRecovery('item-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('creates an appeal with evidenceKeys', async () => {
    const evidenceKey = 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
    post.mockResolvedValue({
      appeal: {
        id: 'ap-1',
        rejectionId: 'rej-1',
        itemId: 'item-1',
        reason: 'This is an authentic item with a receipt.',
        evidence: [],
        status: 'pending',
      },
    });
    const appeal = await itemRejectionRecoveryApi.createAppeal('item-1', {
      reason: 'This is an authentic item with a receipt.',
      evidenceKeys: [evidenceKey],
    });
    expect(post).toHaveBeenCalledWith(ITEM_APPEALS_PATH('item-1'), {
      reason: 'This is an authentic item with a receipt.',
      evidenceKeys: [evidenceKey],
    });
    expect(appeal.status).toBe('pending');
    expect(appeal.evidence).toEqual([]);
  });

  it('uploads evidence with the returned method and headers and returns the key', async () => {
    const method = 'PUT';
    const headers = { 'Content-Type': 'image/jpeg', 'Content-Length': '12' };
    const key = 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
    post.mockResolvedValue({
      data: {
        uploadUrl: 'https://s3.test/upload',
        method,
        headers,
        key,
        expiresAt: '2026-11-02T00:00:00.000Z',
        maxBytes: 5 * 1024 * 1024,
      },
    });
    const blob = new Blob([new Uint8Array(12)], { type: 'image/jpeg' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ blob: async () => blob })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const uploaded = await itemRejectionRecoveryApi.uploadEvidence('item-1', {
      uri: 'file://photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      fileSize: 12,
    });
    expect(post).toHaveBeenCalledWith(ITEM_APPEAL_EVIDENCE_UPLOAD_PATH('item-1'), {
      contentType: 'image/jpeg',
      fileSize: 12,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://s3.test/upload', {
      method,
      headers,
      body: blob,
    });
    expect(uploaded).toBe(key);
    vi.unstubAllGlobals();
  });
});
