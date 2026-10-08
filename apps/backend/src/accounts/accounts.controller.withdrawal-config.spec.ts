/** QA L3: GET /accounts/:accountId/withdrawal-config must not answer for other users' accounts. */
import {
  ArgumentMetadata,
  BadRequestException,
  HttpException,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AccountsController } from './accounts.controller';

const ACCOUNT = '33333333-3333-4333-8333-333333333333';

describe('AccountsController.getWithdrawalConfig ownership (L3)', () => {
  const ctx = {} as never;
  let hasuraUserService: { getUser: jest.Mock };
  let hasuraSystemService: { executeQuery: jest.Mock };
  let accountsService: { getWithdrawalConfig: jest.Mock };
  let rbacService: { hasPermission: jest.Mock };
  let controller: AccountsController;

  beforeEach(() => {
    hasuraUserService = { getUser: jest.fn().mockResolvedValue({ id: 'caller' }) };
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        accounts_by_pk: { id: ACCOUNT, user_id: 'owner' },
      }),
    };
    accountsService = {
      getWithdrawalConfig: jest.fn().mockResolvedValue({ requirePin: true }),
    };
    rbacService = { hasPermission: jest.fn().mockResolvedValue(false) };
    controller = new AccountsController(
      hasuraUserService as never,
      hasuraSystemService as never,
      accountsService as never,
      rbacService as never
    );
  });

  async function httpError(run: () => Promise<unknown>): Promise<HttpException> {
    try {
      await run();
    } catch (caught) {
      expect(caught).toBeInstanceOf(HttpException);
      return caught as HttpException;
    }
    throw new Error('expected HttpException');
  }

  it("404s another user's account without revealing its PIN state", async () => {
    const error = await httpError(() => controller.getWithdrawalConfig(ctx, ACCOUNT));

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(accountsService.getWithdrawalConfig).not.toHaveBeenCalled();
    expect(rbacService.hasPermission).toHaveBeenCalledWith(
      'caller',
      PlatformPermissions.FINANCIAL_MOBILE_PAYMENTS
    );
  });

  it('404s a non-existent account the same way (no existence oracle)', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({ accounts_by_pk: null });
    rbacService.hasPermission.mockResolvedValue(true);

    const error = await httpError(() => controller.getWithdrawalConfig(ctx, ACCOUNT));

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(accountsService.getWithdrawalConfig).not.toHaveBeenCalled();
  });

  it('serves the owner', async () => {
    hasuraUserService.getUser.mockResolvedValue({ id: 'owner' });

    await expect(controller.getWithdrawalConfig(ctx, ACCOUNT)).resolves.toEqual({
      success: true,
      data: { requirePin: true },
    });
    expect(rbacService.hasPermission).not.toHaveBeenCalled();
  });

  it('serves a mobile-payments admin (commission accounts page)', async () => {
    rbacService.hasPermission.mockResolvedValue(true);

    await expect(controller.getWithdrawalConfig(ctx, ACCOUNT)).resolves.toEqual(
      expect.objectContaining({ success: true })
    );
  });

  it('401s when the caller cannot be resolved', async () => {
    hasuraUserService.getUser.mockRejectedValue(new Error('no user'));

    const error = await httpError(() => controller.getWithdrawalConfig(ctx, ACCOUNT));

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("rejects a non-uuid id with a 400 at the param pipe ('abc')", async () => {
    const meta: ArgumentMetadata = { type: 'param', data: 'accountId', metatype: String };
    await expect(new ParseUUIDPipe().transform('abc', meta)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
