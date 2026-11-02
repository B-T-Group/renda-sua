import { act, renderHook, waitFor } from '@testing-library/react';
import { useItemRejectionRecovery } from './useItemRejectionRecovery';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
let mockApiClient = { get: mockGet, post: mockPost, patch: mockPatch };

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

describe('useItemRejectionRecovery', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
  });

  it('exposes server-allowed actions and hides the card when not rejected', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          item_id: 'item-1',
          moderation_status: 'approved',
          rejection: null,
          allowed_actions: {
            aiFix: false,
            retake: false,
            condition: false,
            resubmit: false,
            appeal: false,
          },
          appeal: null,
          appeal_history: [],
          appeal_allowance_remaining: 1,
          tokens_used_on_item: 0,
          ai_tokens: 0,
          cleanup_token_cost: 1,
          condition: 'new',
          wear_note: null,
          pending_resubmit: false,
        },
      },
    });
    const { result } = renderHook(() =>
      useItemRejectionRecovery('item-1', { id: 'item-1', moderation_status: 'approved' })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(false);
  });

  it('locks actions after resubmit and maps a pending appeal warning', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          item_id: 'item-1',
          moderation_status: 'rejected',
          rejection: {
            id: 'rej-1',
            item_id: 'item-1',
            category: 'other',
            reason: 'Need a clearer photo of the label',
            created_at: '2026-01-01T00:00:00.000Z',
          },
          allowed_actions: {
            aiFix: true,
            retake: true,
            condition: true,
            resubmit: true,
            appeal: true,
          },
          appeal: {
            id: 'ap-1',
            rejection_id: 'rej-1',
            item_id: 'item-1',
            reason: 'Please reconsider this listing as it is accurate.',
            evidence_urls: [],
            status: 'pending',
          },
          appeal_history: [],
          appeal_allowance_remaining: 0,
          tokens_used_on_item: 0,
          ai_tokens: 2,
          cleanup_token_cost: 1,
          condition: 'new',
          wear_note: null,
          pending_resubmit: false,
        },
      },
    });
    mockPost.mockResolvedValue({
      data: {
        data: {
          moderation_status: 'pending',
          pending_resubmit: true,
          withdrawn_appeal_id: 'ap-1',
        },
      },
    });
    const { result } = renderHook(() => useItemRejectionRecovery('item-1'));
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    expect(result.current.visible).toBe(true);
    expect(result.current.warnAppealWithdraw).toBe(true);
    expect(result.current.appealDisabledReason).toBe('in_review');
    await act(async () => {
      await result.current.submitResubmit(true);
    });
    expect(result.current.locked).toBe(true);
    expect(result.current.recovery?.pending_resubmit).toBe(true);
  });
});
