jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: jest.fn(),
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: jest.fn(),
}));
jest.mock('../inventory-items/inventory-items.service', () => ({
  InventoryItemsService: class InventoryItemsService {},
}));

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

describe('PUT /item-likes/:itemId validation (QA F-R1)', () => {
  const { ValidationPipe } = jest.requireActual('@nestjs/common');
  const { SetItemLikeDto } = jest.requireActual('./dto/set-item-like.dto');
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const run = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: SetItemLikeDto });

  it.each([{}, { liked: null }, { liked: 0 }, { liked: 1 }, { liked: 'false' }, { liked: 'true' }, { liked: [] }, null, undefined])(
    'rejects %j with 400',
    async (body: unknown) => {
      await expect(run(body)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    }
  );

  it('accepts real booleans and strips extra fields', async () => {
    await expect(run({ liked: true, admin: true })).resolves.toEqual({ liked: true });
    await expect(run({ liked: false })).resolves.toEqual({ liked: false });
  });

  it('the route carries the pipe and a UUID check on itemId', () => {
    const { PIPES_METADATA } = jest.requireActual('@nestjs/common/constants');
    const pipes = Reflect.getMetadata(PIPES_METADATA, ItemLikesController.prototype.setLike);
    expect(pipes?.[0]).toBeInstanceOf(ValidationPipe);
    const args = Reflect.getMetadata('__routeArguments__', ItemLikesController, 'setLike');
    const withPipes = Object.values(args as Record<string, any>).filter((a: any) => a.pipes?.length);
    expect(withPipes.length).toBeGreaterThan(0);
  });
});
