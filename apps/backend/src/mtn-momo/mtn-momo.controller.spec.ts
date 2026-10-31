import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { PERMISSIONS_KEY } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { MtnMomoController } from './mtn-momo.controller';

const ADMIN_ONLY_HANDLERS = [
  'requestToPay',
  'getCollectionStatus',
  'transfer',
  'getDisbursementStatus',
  'remittance',
  'getAccountBalance',
  'validateAccountHolder',
  'getUserPaymentRequests',
  'getPaymentRequestByTransactionId',
  'healthCheck',
] as const;

describe('MtnMomoController admin gate', () => {
  it.each(ADMIN_ONLY_HANDLERS)(
    '%s requires AdminAuthGuard + platform.financial.mobile_payments',
    (method) => {
      const handler = MtnMomoController.prototype[method];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
        AdminAuthGuard
      );
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PlatformPermissions.FINANCIAL_MOBILE_PAYMENTS,
      ]);
    }
  );

  it.each(['handleWebhookPost', 'handleWebhookPut'] as const)(
    '%s stays public (no admin guard) so MTN callbacks still land',
    (method) => {
      const handler = MtnMomoController.prototype[method];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []).not.toContain(
        AdminAuthGuard
      );
    }
  );

  it('a signed-in shopper without financial.mobile_payments cannot disburse', async () => {
    const guard = new AdminAuthGuard(
      new Reflector(),
      { getUser: async () => ({ id: 'shopper-1' }) } as never,
      { isBusinessAdmin: async () => false } as never,
      {
        getEffectiveAccess: async () => ({
          isSuperuser: false,
          roles: [],
          permissions: [],
        }),
      } as never
    );
    const ctx = {
      getHandler: () => MtnMomoController.prototype.transfer,
      getClass: () => MtnMomoController,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

describe('MtnMomoController webhook', () => {
  const REF = '3f1c6a52-8f0e-4c0a-9a53-0e1c8f7a2b11';
  let service: { verifyWebhookToken: jest.Mock; handleCallback: jest.Mock };
  let controller: MtnMomoController;

  beforeEach(() => {
    service = {
      verifyWebhookToken: jest.fn(),
      handleCallback: jest.fn().mockResolvedValue('updated'),
    };
    controller = new MtnMomoController(
      service as never,
      {} as never,
      {} as never
    );
  });

  it.each(['handleWebhookPost', 'handleWebhookPut'] as const)(
    '%s rejects a bad token without touching payments',
    async (method) => {
      service.verifyWebhookToken.mockReturnValue(false);
      await expect(
        controller[method]({ status: 'SUCCESSFUL' }, REF, 'bad')
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(service.handleCallback).not.toHaveBeenCalled();
    }
  );

  it.each(['handleWebhookPost', 'handleWebhookPut'] as const)(
    '%s processes a valid call',
    async (method) => {
      service.verifyWebhookToken.mockReturnValue(true);
      const body = { status: 'SUCCESSFUL' };
      const res = await controller[method](body, REF, 'good');
      expect(service.handleCallback).toHaveBeenCalledWith(body, REF);
      expect(res).toMatchObject({ success: true, outcome: 'updated' });
    }
  );

  it('does not put the token in any log line', async () => {
    const spy = jest.spyOn(controller['logger'], 'warn').mockImplementation();
    service.verifyWebhookToken.mockReturnValue(false);
    await controller
      .handleWebhookPost({}, REF, 'super-secret-token')
      .catch(() => undefined);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('super-secret-token');
  });

  it('rethrows a reconcile failure instead of acknowledging it', async () => {
    service.verifyWebhookToken.mockReturnValue(true);
    service.handleCallback.mockRejectedValue(new Error('mtn down'));
    await expect(
      controller.handleWebhookPost({ status: 'SUCCESSFUL' }, REF, 'good')
    ).rejects.toThrow('mtn down');
  });
});

describe('MtnMomoController currency is optional', () => {
  const payer = { partyIdType: 'MSISDN', partyId: '237600000000' };
  let requestToPay: jest.Mock;
  let transfer: jest.Mock;
  let remittance: jest.Mock;
  let controller: MtnMomoController;

  beforeEach(() => {
    requestToPay = jest.fn().mockResolvedValue({ status: true });
    transfer = jest.fn().mockResolvedValue({ status: true });
    remittance = jest.fn().mockResolvedValue({ status: true });
    controller = new MtnMomoController(
      { requestToPay, transfer, remittance } as never,
      {} as never,
      { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) } as never
    );
  });

  it('forwards a collection, transfer, and remittance that omit currency', async () => {
    const collection = { amount: '1500', externalId: 'order-1', payer };
    await controller.requestToPay({} as never, collection as never);
    expect(requestToPay).toHaveBeenCalledWith(collection, 'user-1');

    const payout = { amount: '1500', externalId: 'order-2', payee: payer };
    await controller.transfer(payout as never);
    await controller.remittance(payout as never);
    expect(transfer).toHaveBeenCalledWith(payout);
    expect(remittance).toHaveBeenCalledWith(payout);
  });

  it('still rejects a request that has no amount', async () => {
    await expect(
      controller.requestToPay(
        {} as never,
        { externalId: 'order-1', payer, currency: 'XAF' } as never
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(requestToPay).not.toHaveBeenCalled();
  });
});
