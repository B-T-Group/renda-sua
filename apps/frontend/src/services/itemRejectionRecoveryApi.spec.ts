import {
  ITEM_AI_CLEANUP_QUOTE_PATH,
  ITEM_APPEAL_EVIDENCE_UPLOAD_PATH,
  ITEM_APPEALS_PATH,
  ITEM_RECOVERY_PATH,
  ITEM_RESUBMIT_PATH,
  createItemRejectionRecoveryApi,
} from './itemRejectionRecoveryApi';

function mockClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  };
}

const recoveryPayload = {
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
    category: 'pricing',
    reason: 'Price looks inconsistent',
    source: 'admin',
    decidedBy: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  actions: ['resubmit', 'appeal'],
  resubmitEditLink: 'price',
  appeal: null,
  appealsUsed: 0,
  appealLimit: 1,
  canAppeal: true,
  canResubmit: true,
  resubmitWithdrawsAppeal: false,
  aiCleanup: { costPerImage: 1, tokenBalance: 8, tokensSpentOnItem: 0 },
  reviewSlaHours: 24,
  appealSlaHours: 48,
};

describe('itemRejectionRecoveryApi', () => {
  it('loads recovery from GET /recovery and unwraps data', async () => {
    const client = mockClient();
    client.get.mockResolvedValue({ data: { success: true, data: recoveryPayload } });
    const api = createItemRejectionRecoveryApi(client as never);
    const recovery = await api.getRecovery('item-1');
    expect(client.get).toHaveBeenCalledWith(ITEM_RECOVERY_PATH('item-1'));
    expect(recovery.resubmitEditLink).toBe('price');
    expect(recovery.actions).toEqual(['resubmit', 'appeal']);
  });

  it('does not synthesize a payload when GET recovery fails', async () => {
    const client = mockClient();
    client.get.mockRejectedValue({ response: { status: 404 } });
    const api = createItemRejectionRecoveryApi(client as never);
    await expect(api.getRecovery('item-1')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('posts resubmit with confirmWithdrawAppeal and createAppeal with evidenceKeys', async () => {
    const client = mockClient();
    const evidenceKey = 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
    client.post
      .mockResolvedValueOnce({
        data: {
          data: {
            itemId: 'item-1',
            moderationStatus: 'pending',
            withdrewAppealId: 'ap-1',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            appeal: {
              id: 'ap-1',
              rejectionId: 'rej-1',
              itemId: 'item-1',
              reason: 'The price matches the local market.',
              evidence: [],
              status: 'pending',
            },
          },
        },
      });
    const api = createItemRejectionRecoveryApi(client as never);
    const resubmit = await api.resubmit('item-1', true);
    expect(client.post).toHaveBeenCalledWith(ITEM_RESUBMIT_PATH('item-1'), {
      confirmWithdrawAppeal: true,
    });
    expect(resubmit.moderationStatus).toBe('pending');
    const appeal = await api.createAppeal('item-1', {
      reason: 'The price matches the local market.',
      evidenceKeys: [evidenceKey],
    });
    expect(client.post).toHaveBeenCalledWith(ITEM_APPEALS_PATH('item-1'), {
      reason: 'The price matches the local market.',
      evidenceKeys: [evidenceKey],
    });
    expect(appeal.status).toBe('pending');
    expect(appeal.evidence).toEqual([]);
  });

  it('uploads evidence with the returned method and headers and returns the key', async () => {
    const client = mockClient();
    const method = 'PUT';
    const headers = { 'Content-Type': 'image/jpeg', 'Content-Length': '12' };
    const key = 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
    client.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          uploadUrl: 'https://s3.test/upload',
          method,
          headers,
          key,
          expiresAt: '2026-11-02T00:00:00.000Z',
          maxBytes: 5 * 1024 * 1024,
        },
      },
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const file = new File([new Uint8Array(12)], 'photo.jpg', { type: 'image/jpeg' });
    const api = createItemRejectionRecoveryApi(client as never);
    const uploaded = await api.uploadEvidence('item-1', file);
    expect(client.post).toHaveBeenCalledWith(ITEM_APPEAL_EVIDENCE_UPLOAD_PATH('item-1'), {
      contentType: 'image/jpeg',
      fileSize: 12,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://s3.test/upload', {
      method,
      headers,
      body: file,
    });
    expect(uploaded).toBe(key);
  });

  it('uses ticket maxBytes and does not upload an oversized file', async () => {
    const client = mockClient();
    client.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          uploadUrl: 'https://s3.test/upload',
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '12' },
          key: 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg',
          expiresAt: '2026-11-02T00:00:00.000Z',
          maxBytes: 10,
        },
      },
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const file = new File([new Uint8Array(12)], 'photo.jpg', { type: 'image/jpeg' });
    const api = createItemRejectionRecoveryApi(client as never);
    await expect(api.uploadEvidence('item-1', file)).rejects.toThrow(
      'Use a JPEG, PNG or WebP photo'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('quotes AI cleanup on /ai-cleanup-quote', async () => {
    const client = mockClient();
    client.get.mockResolvedValue({
      data: {
        data: {
          imageCount: 2,
          costPerImage: 1,
          totalCost: 2,
          tokenBalance: 1,
          sufficient: false,
          shortfall: 1,
          code: 'INSUFFICIENT_AI_TOKENS',
        },
      },
    });
    const api = createItemRejectionRecoveryApi(client as never);
    const quote = await api.getCleanupQuote('item-1', 2);
    expect(client.get).toHaveBeenCalledWith(ITEM_AI_CLEANUP_QUOTE_PATH('item-1'), {
      params: { imageCount: 2 },
    });
    expect(quote.sufficient).toBe(false);
    expect(quote.code).toBe('INSUFFICIENT_AI_TOKENS');
  });
});
