import { PlatformPermissions } from '../rbac/platform-permissions';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';

describe('MobileTransactionAccessService.canView', () => {
  let executeQuery: jest.Mock;
  let hasPermission: jest.Mock;
  let service: MobileTransactionAccessService;

  beforeEach(() => {
    executeQuery = jest.fn().mockResolvedValue({
      accounts_by_pk: { id: 'acct-1', user_id: 'owner-1' },
    });
    hasPermission = jest.fn().mockResolvedValue(false);
    service = new MobileTransactionAccessService(
      { executeQuery } as never,
      { hasPermission } as never
    );
  });

  it('allows the owner of the linked account without an admin lookup', async () => {
    await expect(
      service.canView({ account_id: 'acct-1' }, 'owner-1')
    ).resolves.toBe(true);
    expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
      accountId: 'acct-1',
    });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('denies another user who is not a mobile payments admin', async () => {
    await expect(
      service.canView({ account_id: 'acct-1' }, 'other-user')
    ).resolves.toBe(false);
    expect(hasPermission).toHaveBeenCalledWith(
      'other-user',
      PlatformPermissions.FINANCIAL_MOBILE_PAYMENTS
    );
  });

  it('allows a mobile payments admin who does not own the account', async () => {
    hasPermission.mockResolvedValue(true);
    await expect(
      service.canView({ account_id: 'acct-1' }, 'admin-1')
    ).resolves.toBe(true);
  });

  it('treats a transaction without an account as admin-only', async () => {
    await expect(
      service.canView({ account_id: null }, 'owner-1')
    ).resolves.toBe(false);
    expect(executeQuery).not.toHaveBeenCalled();

    hasPermission.mockResolvedValue(true);
    await expect(
      service.canView({ account_id: null }, 'admin-1')
    ).resolves.toBe(true);
  });

  it('denies when the linked account no longer exists', async () => {
    executeQuery.mockResolvedValue({ accounts_by_pk: null });
    await expect(
      service.canView({ account_id: 'acct-gone' }, 'owner-1')
    ).resolves.toBe(false);
  });

  it('denies a request without a user id', async () => {
    await expect(service.canView({ account_id: 'acct-1' }, undefined)).resolves.toBe(
      false
    );
    expect(executeQuery).not.toHaveBeenCalled();
    expect(hasPermission).not.toHaveBeenCalled();
  });
});
