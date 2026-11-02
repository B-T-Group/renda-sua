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
              evidenceUrls: [],
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
});
