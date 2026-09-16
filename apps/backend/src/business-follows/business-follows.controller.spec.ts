jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: jest.fn(),
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: jest.fn(),
}));

import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { emptyRequestContext } from '../auth/request-context';
import { BusinessFollowsController } from './business-follows.controller';

describe('BusinessFollowsController', () => {
  const businessFollowsService = {
    setFollow: jest.fn(),
    getUserFollows: jest.fn(),
  };
  const hasuraUserService = {
    getUserId: jest.fn(),
  };

  let controller: BusinessFollowsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BusinessFollowsController(
      businessFollowsService as any,
      hasuraUserService as any
    );
  });

  it('rejects anonymous follow updates', async () => {
    hasuraUserService.getUserId.mockReturnValue('anonymous');

    await expect(
      controller.setFollow(
        'biz-1',
        { following: true },
        emptyRequestContext()
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(businessFollowsService.setFollow).not.toHaveBeenCalled();
  });

  it('rejects missing user ids', async () => {
    hasuraUserService.getUserId.mockReturnValue('');

    await expect(
      controller.listFollows(emptyRequestContext())
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(businessFollowsService.getUserFollows).not.toHaveBeenCalled();
  });

  it('updates follow state for an authenticated user', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    businessFollowsService.setFollow.mockResolvedValue({
      following: true,
      followers_count: 3,
    });
    const ctx = emptyRequestContext({ userId: 'user-1' });

    await expect(
      controller.setFollow('biz-1', { following: true }, ctx)
    ).resolves.toEqual({
      success: true,
      data: { following: true, followers_count: 3 },
      message: 'Business followed',
    });
    expect(businessFollowsService.setFollow).toHaveBeenCalledWith(
      'user-1',
      'biz-1',
      true
    );
  });

  it('rethrows service HttpExceptions', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    businessFollowsService.setFollow.mockRejectedValue(
      new HttpException('Business not found', HttpStatus.NOT_FOUND)
    );

    const error = await controller
      .setFollow(
        'biz-1',
        { following: false },
        emptyRequestContext({ userId: 'user-1' })
      )
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('lists follows with parsed pagination', async () => {
    hasuraUserService.getUserId.mockReturnValue('user-1');
    businessFollowsService.getUserFollows.mockResolvedValue({
      businesses: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });

    const result = await controller.listFollows(
      emptyRequestContext({ userId: 'user-1' }),
      '2',
      '10'
    );

    expect(businessFollowsService.getUserFollows).toHaveBeenCalledWith(
      'user-1',
      2,
      10
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('Followed businesses retrieved successfully');
  });
});
