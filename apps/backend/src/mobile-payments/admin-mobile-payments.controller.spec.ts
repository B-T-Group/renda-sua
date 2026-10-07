import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminMobilePaymentsController } from './admin-mobile-payments.controller';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MobileTransactionStatus } from './mobile-payments.service';

function baseTx(
  overrides: Partial<MobilePaymentTransaction> = {}
): MobilePaymentTransaction {
  return {
    id: 'tx-1',
    reference: 'P123',
    amount: 1500,
    currency: 'XAF',
    description: 'Order payment',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'PAYTEST001',
    customer_phone: '+24166123456',
    transaction_type: 'PAYMENT',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function liveStatus(
  overrides: Partial<MobileTransactionStatus> = {}
): MobileTransactionStatus {
  return {
    transactionId: 'PAYTEST001',
    status: 'success',
    amount: 1500,
    currency: 'XAF',
    reference: 'P123',
    provider: 'mypvit',
    ...overrides,
  };
}

describe('AdminMobilePaymentsController', () => {
  const databaseService = {
    getTransactionById: jest.fn(),
    getPendingIntegrationTransactions: jest.fn(),
  };
  const mobilePaymentsService = {
    resolveAdminIntegrationProvider: jest.fn(),
    checkTransactionStatus: jest.fn(),
    nationalCustomerIdForMypvit: jest.fn().mockReturnValue('66123456'),
  };
  const callbackProcessor = {
    processMypvitCallback: jest.fn(),
    processFreemopayCallback: jest.fn(),
  };

  let controller: AdminMobilePaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminMobilePaymentsController(
      databaseService as never,
      mobilePaymentsService as never,
      callbackProcessor as never
    );
    mobilePaymentsService.resolveAdminIntegrationProvider.mockReturnValue(
      'mypvit'
    );
    callbackProcessor.processMypvitCallback.mockResolvedValue({
      skipped: false,
    });
    callbackProcessor.processFreemopayCallback.mockResolvedValue({
      skipped: false,
    });
  });

  describe('getProviderStatus', () => {
    it('passes the stored customer phone to the live status check', async () => {
      const tx = baseTx();
      databaseService.getTransactionById.mockResolvedValue(tx);
      mobilePaymentsService.checkTransactionStatus.mockResolvedValue(
        liveStatus({ status: 'pending' })
      );

      const result = await controller.getProviderStatus('tx-1');

      expect(mobilePaymentsService.checkTransactionStatus).toHaveBeenCalledWith(
        'PAYTEST001',
        'mypvit',
        '+24166123456'
      );
      expect(result.data.providerStatus.status).toBe('pending');
    });

    it('returns an ambiguous snapshot when the provider check throws', async () => {
      databaseService.getTransactionById.mockResolvedValue(baseTx());
      mobilePaymentsService.checkTransactionStatus.mockRejectedValue(
        new Error('provider timeout')
      );

      const result = await controller.getProviderStatus('tx-1');

      expect(result.success).toBe(true);
      expect(result.data.providerStatus).toMatchObject({
        status: 'ambiguous',
        transactionId: 'PAYTEST001',
        message: 'provider timeout',
        provider: 'mypvit',
      });
    });
  });

  describe('resolve', () => {
    it('passes the stored customer phone to the live status check', async () => {
      databaseService.getTransactionById.mockResolvedValue(baseTx());
      mobilePaymentsService.checkTransactionStatus.mockResolvedValue(
        liveStatus()
      );

      await controller.resolve('tx-1', {} as never);

      expect(mobilePaymentsService.checkTransactionStatus).toHaveBeenCalledWith(
        'PAYTEST001',
        'mypvit',
        '+24166123456'
      );
    });

    it('returns still-pending instead of 502 when the provider check throws', async () => {
      databaseService.getTransactionById.mockResolvedValue(baseTx());
      mobilePaymentsService.checkTransactionStatus.mockRejectedValue(
        new Error('Request failed with status code 503')
      );

      const result = await controller.resolve('tx-1', {} as never);

      expect(result).toMatchObject({
        success: true,
        replayed: false,
        message: 'Provider status uncertain; try again later',
        data: {
          provider: 'mypvit',
          providerStatus: expect.objectContaining({
            status: 'ambiguous',
            message: 'Request failed with status code 503',
          }),
        },
      });
      expect(callbackProcessor.processMypvitCallback).not.toHaveBeenCalled();
      expect(callbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();
    });

    it('replays a MyPVit callback when the provider reports success', async () => {
      databaseService.getTransactionById.mockResolvedValue(baseTx());
      mobilePaymentsService.checkTransactionStatus.mockResolvedValue(
        liveStatus()
      );

      const result = await controller.resolve('tx-1', { ip: '1.1.1.1' } as never);

      expect(result).toMatchObject({
        success: true,
        replayed: true,
        data: { provider: 'mypvit' },
      });
      expect(callbackProcessor.processMypvitCallback).toHaveBeenCalledTimes(1);
    });

    it('does not replay when the provider is still pending', async () => {
      databaseService.getTransactionById.mockResolvedValue(baseTx());
      mobilePaymentsService.checkTransactionStatus.mockResolvedValue(
        liveStatus({ status: 'pending' })
      );

      const result = await controller.resolve('tx-1', {} as never);

      expect(result).toMatchObject({
        success: true,
        replayed: false,
        message: 'Provider still pending',
      });
      expect(callbackProcessor.processMypvitCallback).not.toHaveBeenCalled();
    });

    it('rejects a non-pending row before calling the provider', async () => {
      databaseService.getTransactionById.mockResolvedValue(
        baseTx({ status: 'success' })
      );

      await expect(controller.resolve('tx-1', {} as never)).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(mobilePaymentsService.checkTransactionStatus).not.toHaveBeenCalled();
    });

    it('rejects a row with no provider transaction id', async () => {
      databaseService.getTransactionById.mockResolvedValue(
        baseTx({ transaction_id: '   ' })
      );

      await expect(controller.resolve('tx-1', {} as never)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(mobilePaymentsService.checkTransactionStatus).not.toHaveBeenCalled();
    });
  });
});
