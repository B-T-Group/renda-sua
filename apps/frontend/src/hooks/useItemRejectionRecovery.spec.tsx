import { act, renderHook, waitFor } from '@testing-library/react';
import { useItemRejectionRecovery } from './useItemRejectionRecovery';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockApiClient = { get: mockGet, post: mockPost, patch: mockPatch };

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
          item: {
            id: 'item-1',
            name: 'Lamp',
            moderationStatus: 'approved',
            statusDisplay: 'approved',
            condition: 'new',
            wearNote: null,
          },
          rejection: null,
          actions: [],
          resubmitEditLink: null,
          appeal: null,
          appealsUsed: 0,
          appealLimit: 1,
          canAppeal: false,
          canResubmit: false,
          resubmitWithdrawsAppeal: false,
          aiCleanup: { costPerImage: 1, tokenBalance: 0, tokensSpentOnItem: 0 },
          reviewSlaHours: 24,
          appealSlaHours: 48,
        },
      },
    });
    const { result } = renderHook(() => useItemRejectionRecovery('item-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(false);
  });

  it('locks actions after resubmit and maps a pending appeal warning', async () => {
    mockGet.mockResolvedValue({
      data: {
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
            category: 'other',
            reason: 'Need a clearer photo of the label',
            source: 'admin',
            decidedBy: 'admin',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          actions: ['ai_fix', 'retake', 'condition', 'resubmit', 'appeal'],
          resubmitEditLink: null,
          appeal: {
            id: 'ap-1',
            rejectionId: 'rej-1',
            itemId: 'item-1',
            reason: 'Please reconsider this listing as it is accurate.',
            evidenceUrls: [],
            status: 'pending',
          },
          appealsUsed: 1,
          appealLimit: 1,
          canAppeal: false,
          canResubmit: true,
          resubmitWithdrawsAppeal: true,
          aiCleanup: { costPerImage: 1, tokenBalance: 2, tokensSpentOnItem: 0 },
          reviewSlaHours: 24,
          appealSlaHours: 48,
        },
      },
    });
    mockPost.mockResolvedValue({
      data: {
        data: {
          itemId: 'item-1',
          moderationStatus: 'pending',
          withdrewAppealId: 'ap-1',
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
    expect(result.current.recovery?.item.moderationStatus).toBe('pending');
  });
});
