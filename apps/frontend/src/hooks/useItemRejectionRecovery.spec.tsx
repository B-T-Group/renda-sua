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
            evidence: [],
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

  it('shows In review from server statusDisplay after resubmit', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          item: {
            id: 'item-1',
            name: 'Lamp',
            moderationStatus: 'pending',
            statusDisplay: 'in_review',
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
          aiCleanup: { costPerImage: 1, tokenBalance: 4, tokensSpentOnItem: 0 },
          reviewSlaHours: 24,
          appealSlaHours: 48,
        },
      },
    });
    const { result } = renderHook(() => useItemRejectionRecovery('item-1'));
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    expect(result.current.visible).toBe(true);
    expect(result.current.recovery?.item.statusDisplay).toBe('in_review');
    expect(result.current.canResubmit).toBe(false);
  });

  it('refetches recovery when appeal evidence has expired', async () => {
    const expired = recoveryWithEvidence(
      '2020-01-01T00:00:00.000Z',
      'https://signed.test/expired.jpg'
    );
    const fresh = recoveryWithEvidence(
      '2099-01-01T00:00:00.000Z',
      'https://signed.test/fresh.jpg'
    );
    mockGet
      .mockResolvedValueOnce({ data: { data: expired } })
      .mockResolvedValueOnce({ data: { data: fresh } });
    const { result } = renderHook(() => useItemRejectionRecovery('item-1'));
    await waitFor(() =>
      expect(result.current.recovery?.appeal?.evidence[0].url).toBe(
        'https://signed.test/fresh.jpg'
      )
    );
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

function recoveryWithEvidence(expiresAt: string, url: string) {
  return {
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
    actions: ['appeal'],
    resubmitEditLink: null,
    appeal: {
      id: 'ap-1',
      rejectionId: 'rej-1',
      itemId: 'item-1',
      reason: 'Please reconsider this listing as it is accurate.',
      evidence: [
        {
          key: 'item-appeal-evidence/item-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg',
          url,
          expiresAt,
        },
      ],
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
  };
}
