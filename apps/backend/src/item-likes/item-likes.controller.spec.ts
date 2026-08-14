import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { emptyRequestContext } from '../auth/request-context';
import { ItemLikesController } from './item-likes.controller';

describe('ItemLikesController', () => {
  const itemLikesService = {
    setLike: jest.fn(),
    getUserLikes: jest.fn(),
  };
  const hasuraUserService = {
    getUserId: jest.fn(),
  };

  let controller: ItemLikesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ItemLikesController(
      itemLikesService as any,
      hasuraUserService as any
    );
  });

  it('rejects anonymous like updates', async () => {
    hasuraUserService.getUserId.mockReturnValue('anonymous');

    await expect(
      controller.setLike('item-1', { liked: true }, emptyRequestContext())
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(itemLikesService.setLike).not.toHaveBeenCalled();
  });

  it('rejects missing user ids', async () => {
    hasuraUserService.getUserId.mockReturnValue('');

    await expect(
      controller.listLikes(emptyRequestContext())
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(itemLikesService.getUserLikes).not.toHaveBeenCalled();
  });

  it('updates like state for an authenticated user', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    itemLikesService.setLike.mockResolvedValue({
      liked: true,
      likes_count: 3,
    });
    const ctx = emptyRequestContext({ userId: 'user-1' });

    await expect(
      controller.setLike('item-1', { liked: true }, ctx)
    ).resolves.toEqual({
      success: true,
      data: { liked: true, likes_count: 3 },
      message: 'Item liked',
    });
    expect(itemLikesService.setLike).toHaveBeenCalledWith(
      'user-1',
      'item-1',
      true
    );
  });

  it('rethrows service HttpExceptions', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    itemLikesService.setLike.mockRejectedValue(
      new HttpException('Item not found', HttpStatus.NOT_FOUND)
    );

    const error = await controller
      .setLike(
        'item-1',
        { liked: false },
        emptyRequestContext({ userId: 'user-1' })
      )
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('lists likes with parsed pagination', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    itemLikesService.getUserLikes.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });

    const result = await controller.listLikes(
      emptyRequestContext({ userId: 'user-1' }),
      '2',
      '10'
    );

    expect(itemLikesService.getUserLikes).toHaveBeenCalledWith(
      'user-1',
      2,
      10
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('Liked items retrieved successfully');
  });
});
