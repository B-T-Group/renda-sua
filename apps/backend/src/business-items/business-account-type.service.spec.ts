import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessAccountTypeService } from './business-account-type.service';

describe('BusinessAccountTypeService', () => {
  function buildService(business: Record<string, unknown> | null) {
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('GetBusinessAccountTypeById')) {
        return { businesses_by_pk: business };
      }
      return { businesses: business ? [business] : [] };
    });
    const executeMutation = jest.fn(async (_mutation: string, vars: any) => ({
      update_businesses_by_pk: {
        account_type: vars.accountType,
        account_type_locked_until: vars.lockedUntil,
      },
      insert_business_account_type_history_one: { id: 'hist-1' },
    }));

    const service = new BusinessAccountTypeService({
      executeQuery,
      executeMutation,
    } as never);

    return { service, executeQuery, executeMutation };
  }

  it('blocks self-serve changes while the plan lock is active', async () => {
    const lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { service, executeMutation } = buildService({
      id: 'biz-1',
      account_type: 'STANDARD',
      account_type_locked_until: lockedUntil,
    });

    try {
      await service.selfServeChange('user-1', 'PREMIUM');
      fail('Expected plan lock conflict');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ lockedUntil })
      );
    }

    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('applies a 30-day lock on self-serve plan changes', async () => {
    const { service, executeMutation } = buildService({
      id: 'biz-1',
      account_type: 'STANDARD',
      account_type_locked_until: null,
    });
    const before = Date.now();

    const result = await service.selfServeChange('user-1', 'ELITE');

    expect(result.accountType).toBe('ELITE');
    expect(result.commissionPercentage).toBe(20);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateBusinessAccountType'),
      expect.objectContaining({
        id: 'biz-1',
        accountType: 'ELITE',
        toType: 'ELITE',
        fromType: 'STANDARD',
        changedBy: 'user-1',
        source: 'self_serve',
      })
    );
    const lockedUntil = new Date(
      executeMutation.mock.calls[0][1].lockedUntil
    ).getTime();
    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(lockedUntil - expected)).toBeLessThan(5000);
  });

  it('returns the current plan without mutating when type is unchanged', async () => {
    const { service, executeMutation } = buildService({
      id: 'biz-1',
      account_type: 'PREMIUM',
      account_type_locked_until: null,
    });

    const result = await service.selfServeChange('user-1', 'PREMIUM');

    expect(result).toEqual({
      accountType: 'PREMIUM',
      commissionPercentage: 15,
      lockedUntil: null,
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('lets admins change plans without applying a lock window', async () => {
    const { service, executeMutation } = buildService({
      id: 'biz-1',
      account_type: 'STANDARD',
      account_type_locked_until: new Date().toISOString(),
    });

    const result = await service.adminChange(
      'biz-1',
      'PREMIUM',
      'admin-1',
      'manual upgrade'
    );

    expect(result).toEqual({
      accountType: 'PREMIUM',
      commissionPercentage: 15,
      lockedUntil: null,
    });
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateBusinessAccountType'),
      expect.objectContaining({
        source: 'admin',
        changedBy: 'admin-1',
        reason: 'manual upgrade',
        lockedUntil: null,
      })
    );
  });

  it('throws when the business cannot be found', async () => {
    const { service } = buildService(null);

    await expect(service.selfServeChange('user-missing', 'ELITE')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      service.adminChange('biz-missing', 'ELITE', 'admin-1')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
