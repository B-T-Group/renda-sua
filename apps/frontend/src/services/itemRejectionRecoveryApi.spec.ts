import {
  ITEM_APPEALS_PATH,
  ITEM_REJECTION_RECOVERY_PATH,
  ITEM_RESUBMIT_PATH,
  createItemRejectionRecoveryApi,
  recoveryGraphqlFieldList,
} from './itemRejectionRecoveryApi';

function mockClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  };
}

describe('itemRejectionRecoveryApi', () => {
  it('loads recovery from the contract endpoint and unwraps data', async () => {
    const client = mockClient();
    client.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          item_id: 'item-1',
          moderation_status: 'rejected',
          rejection: {
            id: 'rej-1',
            item_id: 'item-1',
            category: 'pricing',
            reason: 'Price looks inconsistent',
            created_at: '2026-01-01T00:00:00.000Z',
          },
          allowed_actions: {
            aiFix: false,
            retake: false,
            condition: false,
            resubmit: true,
            appeal: true,
            editPrice: true,
          },
          appeal: null,
          appeal_history: [],
          appeal_allowance_remaining: 1,
          tokens_used_on_item: 0,
          ai_tokens: 8,
          cleanup_token_cost: 1,
          condition: 'new',
          wear_note: null,
          pending_resubmit: false,
        },
      },
    });
    const api = createItemRejectionRecoveryApi(client as never);
    const recovery = await api.getRecovery('item-1');
    expect(client.get).toHaveBeenCalledWith(ITEM_REJECTION_RECOVERY_PATH('item-1'));
    expect(recovery.allowed_actions.editPrice).toBe(true);
    expect(recovery.rejection?.category).toBe('pricing');
  });

  it('synthesizes recovery from the item snapshot when the endpoint 404s', async () => {
    const client = mockClient();
    client.get.mockRejectedValue({ response: { status: 404 } });
    const api = createItemRejectionRecoveryApi(client as never);
    const recovery = await api.getRecovery('item-1', {
      id: 'item-1',
      moderation_status: 'rejected',
      rejection_reason: 'Need daylight photos',
    });
    expect(recovery.rejection?.reason).toBe('Need daylight photos');
    expect(recovery.allowed_actions.appeal).toBe(true);
  });

  it('posts resubmit and appeal against the contract paths', async () => {
    const client = mockClient();
    client.post
      .mockResolvedValueOnce({
        data: { data: { moderation_status: 'pending', pending_resubmit: true } },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            appeal: {
              id: 'ap-1',
              rejection_id: 'rej-1',
              item_id: 'item-1',
              reason: 'The price matches the local market.',
              evidence_urls: [],
              status: 'pending',
            },
          },
        },
      });
    const api = createItemRejectionRecoveryApi(client as never);
    const resubmit = await api.resubmit('item-1', true);
    expect(client.post).toHaveBeenCalledWith(ITEM_RESUBMIT_PATH('item-1'), {
      confirmAppealWithdraw: true,
    });
    expect(resubmit.moderation_status).toBe('pending');
    const appeal = await api.createAppeal('item-1', {
      reason: 'The price matches the local market.',
    });
    expect(client.post).toHaveBeenCalledWith(ITEM_APPEALS_PATH('item-1'), {
      reason: 'The price matches the local market.',
    });
    expect(appeal.status).toBe('pending');
  });

  it('exports the GraphQL field list for a later rebase', () => {
    expect(recoveryGraphqlFieldList()).toContain('allowed_recovery_actions');
  });
});
