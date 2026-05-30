import { HttpException, HttpStatus } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessItemsAccessService } from './business-items-access.service';

describe('BusinessItemsAccessService', () => {
  let service: BusinessItemsAccessService;
  let hasuraUserService: jest.Mocked<Pick<HasuraUserService, 'getUser'>>;
  let permissionService: jest.Mocked<
    Pick<PermissionService, 'canAccessBusinessData'>
  >;

  const ownBusinessUser = {
    id: 'user-1',
    business: { id: 'business-1', is_admin: false },
  };

  beforeEach(() => {
    hasuraUserService = { getUser: jest.fn() };
    permissionService = { canAccessBusinessData: jest.fn() };
    service = new BusinessItemsAccessService(
      hasuraUserService as unknown as HasuraUserService,
      permissionService as unknown as PermissionService
    );
  });

  it('rejects users without a business persona', async () => {
    hasuraUserService.getUser.mockResolvedValue({ id: 'user-1' } as any);

    await expect(service.resolveAccess()).rejects.toThrow(
      new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      )
    );
    expect(permissionService.canAccessBusinessData).not.toHaveBeenCalled();
  });

  it('uses the current user business when no target business is requested', async () => {
    hasuraUserService.getUser.mockResolvedValue(ownBusinessUser as any);

    await expect(service.resolveAccess()).resolves.toEqual({
      targetBusinessId: 'business-1',
      isPlatformAdmin: false,
      isOwnBusiness: true,
      ownBusinessId: 'business-1',
    });
    expect(permissionService.canAccessBusinessData).not.toHaveBeenCalled();
  });

  it('rejects cross-business access for non-admin users', async () => {
    hasuraUserService.getUser.mockResolvedValue(ownBusinessUser as any);

    await expect(service.resolveAccess('business-2')).rejects.toThrow(
      new HttpException(
        { success: false, error: 'Forbidden' },
        HttpStatus.FORBIDDEN
      )
    );
    expect(permissionService.canAccessBusinessData).not.toHaveBeenCalled();
  });

  it('rejects platform admins when business-data permission denies the target', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'admin-1',
      business: { id: 'admin-business', is_admin: true },
    } as any);
    permissionService.canAccessBusinessData.mockResolvedValue(false);

    await expect(service.resolveAccess('business-2')).rejects.toThrow(
      new HttpException(
        { success: false, error: 'Forbidden' },
        HttpStatus.FORBIDDEN
      )
    );
    expect(permissionService.canAccessBusinessData).toHaveBeenCalledWith(
      'admin-1',
      'business-2'
    );
  });

  it('allows platform admins with business-data permission to target another business', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'admin-1',
      business: { id: 'admin-business', is_admin: true },
    } as any);
    permissionService.canAccessBusinessData.mockResolvedValue(true);

    await expect(service.resolveAccess('business-2')).resolves.toEqual({
      targetBusinessId: 'business-2',
      isPlatformAdmin: true,
      isOwnBusiness: false,
      ownBusinessId: 'admin-business',
    });
  });

  it('prevents admins from deleting items for another business', () => {
    expect(() =>
      service.assertCanDelete({
        targetBusinessId: 'business-2',
        isPlatformAdmin: true,
        isOwnBusiness: false,
        ownBusinessId: 'admin-business',
      })
    ).toThrow(
      new HttpException(
        {
          success: false,
          error: 'Admins cannot delete items for other businesses',
        },
        HttpStatus.FORBIDDEN
      )
    );
  });

  it('requires platform admin context for admin-only operations', () => {
    expect(() =>
      service.assertPlatformAdmin({
        targetBusinessId: 'business-1',
        isPlatformAdmin: false,
        isOwnBusiness: true,
        ownBusinessId: 'business-1',
      })
    ).toThrow(
      new HttpException(
        { success: false, error: 'Platform admin required' },
        HttpStatus.FORBIDDEN
      )
    );
  });
});
