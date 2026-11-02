import { act, renderHook, waitFor } from '@testing-library/react';
import { useItemAppealsAdmin } from './useItemAppealsAdmin';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockApiClient = { get: mockGet, post: mockPost };

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

describe('useItemAppealsAdmin', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('loads the pending queue and can decide', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          total: 1,
          appeals: [
            {
              id: 'ap-1',
              rejectionId: 'rej-1',
              itemId: 'item-1',
              reason: 'Please reconsider this listing as it is accurate.',
              evidence: [],
              status: 'pending',
              slaState: 'ok',
              item: { id: 'item-1', name: 'Lamp', moderationStatus: 'rejected', imageUrl: null },
              business: { id: 'biz-1', name: 'Shop' },
              rejection: null,
            },
          ],
        },
      },
    });
    mockPost.mockResolvedValue({
      data: {
        data: {
          appealId: 'ap-1',
          status: 'overturned',
          itemModerationStatus: 'pending',
          warnings: ['SELF_REVIEW_NO_OTHER_ADMIN'],
        },
      },
    });
    const { result } = renderHook(() => useItemAppealsAdmin());
    await act(async () => {
      await result.current.fetchQueue({ status: 'pending' });
    });
    await waitFor(() => expect(result.current.queue?.total).toBe(1));
    const decided = await result.current.decide('ap-1', {
      decision: 'overturn',
      overturnTo: 're_review',
    });
    expect(decided.warnings).toContain('SELF_REVIEW_NO_OTHER_ADMIN');
  });

  it('refetches appeal detail when evidence has expired', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: appealDetail('https://signed.test/expired.jpg', '2020-01-01T00:00:00.000Z') } })
      .mockResolvedValueOnce({ data: { data: appealDetail('https://signed.test/fresh.jpg', '2099-01-01T00:00:00.000Z') } });
    const { result } = renderHook(() => useItemAppealsAdmin());
    await act(async () => {
      await result.current.fetchDetail('ap-1');
    });
    await waitFor(() =>
      expect(result.current.detail?.appeal.evidence[0].url).toBe(
        'https://signed.test/fresh.jpg'
      )
    );
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

function appealDetail(url: string, expiresAt: string) {
  return {
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
    rejection: null,
    item: { name: 'Lamp' },
    business: { id: 'biz-1', name: 'Shop' },
    editedSinceRejection: false,
    selfReview: false,
    history: { audit: [], rejections: [] },
  };
}
