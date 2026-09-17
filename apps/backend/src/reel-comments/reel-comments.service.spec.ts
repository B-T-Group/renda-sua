import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { ReelCommentsService } from './reel-comments.service';

describe('ReelCommentsService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  let service: ReelCommentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelCommentsService(hasura as never);
  });

  it('strips contact info from comments', () => {
    const body = 'Call me at +237 699 000 000 or email test@example.com';
    expect(service.stripContactInfo(body)).not.toMatch(/699|example\.com/i);
  });

  it('lists only visible comments and returns [] when Hasura omits rows', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ reel_comments: null });

    await expect(service.list('reel-1')).resolves.toEqual([]);
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_hidden:{_eq:false}'),
      { reelId: 'reel-1' }
    );
  });

  it('rejects a comment that is empty after sanitizing', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_comments_aggregate: { aggregate: { count: 0 } },
    });

    await expect(service.create('user-1', 'reel-1', '   \n  ')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a 31st comment in an hour', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_comments_aggregate: { aggregate: { count: 30 } },
    });

    const error = await service
      .create('user-1', 'reel-1', 'Nice product')
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores the sanitized body and increments comment_count', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_comments_aggregate: { aggregate: { count: 1 } },
    });
    hasura.executeMutation
      .mockResolvedValueOnce({
        insert_reel_comments_one: {
          id: 'c1',
          reel_id: 'reel-1',
          user_id: 'user-1',
          parent_comment_id: null,
          body: 'Nice product',
          is_hidden: false,
          is_pinned: false,
          created_at: '2026-09-17T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({});

    await service.create('user-1', 'reel-1', 'Nice product wa.me/123');

    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('insert_reel_comments_one'),
      {
        object: {
          reel_id: 'reel-1',
          user_id: 'user-1',
          body: 'Nice product [removed]/123',
        },
      }
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('_inc:{comment_count:1}'),
      { id: 'reel-1' }
    );
  });

  it('hides comments only for the owning merchant', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        reel_comments_by_pk: { reel: { business_id: 'biz-1' } },
      })
      .mockResolvedValueOnce({ businesses_by_pk: { user_id: 'owner-1' } });

    await expect(service.hideForMerchant('other-1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects hiding a missing comment', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ reel_comments_by_pk: null });

    await expect(service.hideForMerchant('owner-1', 'missing')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
