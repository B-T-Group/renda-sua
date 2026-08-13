import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));
jest.mock('../business-contracts/business-contracts.service', () => ({
  BusinessContractsService: class BusinessContractsService {},
}));
jest.mock('../threads/threads.service', () => ({
  ThreadsService: class ThreadsService {},
}));

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminService.setUserInternal', () => {
  const hasuraSystemService = { executeMutation: jest.fn() };
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      hasuraSystemService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  });

  it('persists users.internal via SetUserInternal', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_users_by_pk: { id: 'user-1', internal: true },
    });

    const user = await service.setUserInternal('user-1', true);

    expect(user).toEqual({ id: 'user-1', internal: true });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetUserInternal'),
      { userId: 'user-1', internal: true }
    );
  });

  it('throws when the user row is missing', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_users_by_pk: null,
    });

    await expect(service.setUserInternal('missing', false)).rejects.toThrow(
      'User not found'
    );
  });
});

describe('AdminController.setUserInternal', () => {
  const adminService = { setUserInternal: jest.fn() };
  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminController(
      {} as never,
      adminService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  });

  it('rejects a non-boolean internal body without mutating', async () => {
    await expect(
      controller.setUserInternal('user-1', { internal: 'yes' as never })
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      controller.setUserInternal('user-1', { internal: 'yes' as never })
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(adminService.setUserInternal).not.toHaveBeenCalled();
  });

  it('marks a user as an internal employee', async () => {
    adminService.setUserInternal.mockResolvedValue({
      id: 'user-1',
      internal: true,
    });

    const result = await controller.setUserInternal('user-1', {
      internal: true,
    });

    expect(result).toEqual({
      success: true,
      user: { id: 'user-1', internal: true },
      message: 'User marked as internal employee',
    });
  });

  it('unmarks a user as an internal employee', async () => {
    adminService.setUserInternal.mockResolvedValue({
      id: 'user-1',
      internal: false,
    });

    const result = await controller.setUserInternal('user-1', {
      internal: false,
    });

    expect(result.message).toBe('User unmarked as internal employee');
    expect(adminService.setUserInternal).toHaveBeenCalledWith('user-1', false);
  });
});
