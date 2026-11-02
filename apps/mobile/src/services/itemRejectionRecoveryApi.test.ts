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

vi.mock('./auth0DirectService', () => ({
  default: { getAccessToken: vi.fn().mockResolvedValue('token') },
}));

vi.mock('../utils/activePersonaStorage', () => ({
  buildActivePersonaHeaders: vi.fn().mockResolvedValue({}),
}));

import {
  ITEM_APPEALS_PATH,
  ITEM_REJECTION_RECOVERY_PATH,
  itemRejectionRecoveryApi,
  recoveryGraphqlFieldList,
} from './itemRejectionRecoveryApi';

describe('itemRejectionRecoveryApi', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
  });

  it('reads the recovery contract endpoint', async () => {
    get.mockResolvedValue({
      data: {
        item_id: 'item-1',
        moderation_status: 'rejected',
        rejection: {
          id: 'rej-1',
          item_id: 'item-1',
          category: 'photo_quality',
          reason: 'Photos are dark',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        allowed_actions: {
          aiFix: true,
          retake: true,
          condition: false,
          resubmit: true,
          appeal: true,
        },
        appeal: null,
        appeal_history: [],
        appeal_allowance_remaining: 1,
        tokens_used_on_item: 1,
        ai_tokens: 3,
        cleanup_token_cost: 1,
        condition: 'new',
        wear_note: null,
        pending_resubmit: false,
      },
    });
    const recovery = await itemRejectionRecoveryApi.getRecovery('item-1');
    expect(get).toHaveBeenCalledWith(ITEM_REJECTION_RECOVERY_PATH('item-1'));
    expect(recovery.allowed_actions.aiFix).toBe(true);
    expect(recovery.tokens_used_on_item).toBe(1);
  });

  it('falls back to the item snapshot on 404', async () => {
    const err = new Error('missing') as Error & { status?: number };
    err.status = 404;
    get.mockRejectedValue(err);
    const recovery = await itemRejectionRecoveryApi.getRecovery('item-1', {
      id: 'item-1',
      moderation_status: 'rejected',
      rejection_category: 'counterfeit',
      rejection_reason: 'Looks branded',
    });
    expect(recovery.allowed_actions.resubmit).toBe(false);
    expect(recovery.allowed_actions.appeal).toBe(true);
  });

  it('creates an appeal with reason and evidence urls', async () => {
    post.mockResolvedValue({
      appeal: {
        id: 'ap-1',
        rejection_id: 'rej-1',
        item_id: 'item-1',
        reason: 'This is an authentic item with a receipt.',
        evidence_urls: ['https://cdn.test/receipt.pdf'],
        status: 'pending',
      },
    });
    const appeal = await itemRejectionRecoveryApi.createAppeal('item-1', {
      reason: 'This is an authentic item with a receipt.',
      evidence_urls: ['https://cdn.test/receipt.pdf'],
    });
    expect(post).toHaveBeenCalledWith(ITEM_APPEALS_PATH('item-1'), {
      reason: 'This is an authentic item with a receipt.',
      evidence_urls: ['https://cdn.test/receipt.pdf'],
    });
    expect(appeal.status).toBe('pending');
  });

  it('exports GraphQL fields for rebase', () => {
    expect(recoveryGraphqlFieldList()).toContain('current_rejection');
  });
});
