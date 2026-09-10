import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { GiveChangePayoutService } from '../mobile-payments/give-change-payout.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositRefundService } from './deposit-refund.service';

describe('DepositRefundService', () => {
  let service: DepositRefundService;
  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
    getAccount: jest.Mock;
  };
  let giveChangePayoutService: { executeGiveChangePayout: jest.Mock };
  let accountsService: { registerWithdrawalIfNotExists: jest.Mock };

  const paidOrder = {
    id: 'order-1',
    order_number: '49520979',
    current_status: 'pending',
    fulfillment_method: 'delivery',
    currency: 'XAF',
    deposit_amount: 2000,
    deposit_mobile_payment_transaction_id: 'dep-txn-1',
    deposit_status: 'paid',
    deposit_refund_status: 'none',
    recipient_phone: '+237600000001',
    payer_phone: '+237600000002',
    client: { user_id: 'client-user-1' },
    business_location: { address: { country: 'CM' } },
  };

  beforeEach(async () => {
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({ orders_by_pk: paidOrder }),
      executeMutation: jest.fn().mockResolvedValue({
        update_orders: { affected_rows: 1 },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-client' }),
    };
    giveChangePayoutService = {
      executeGiveChangePayout: jest.fn().mockResolvedValue({
        success: true,
        data: { transactionId: 'give-change-txn-1' },
      }),
    };
    accountsService = {
      registerWithdrawalIfNotExists: jest.fn().mockResolvedValue({
        success: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositRefundService,
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        { provide: GiveChangePayoutService, useValue: giveChangePayoutService },
        { provide: AccountsService, useValue: accountsService },
        DepositCalculationService,
      ],
    }).compile();

    service = module.get(DepositRefundService);
  });

  describe('refundDeposit', () => {
    it('holds and pays out via tracked GIVE_CHANGE, not a bare initiatePayment', async () => {
      const result = await service.refundDeposit('order-1');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('give-change-txn-1');
      expect(giveChangePayoutService.executeGiveChangePayout).toHaveBeenCalledWith(
        {
          amount: 2000,
          currency: 'XAF',
          description: 'Deposit refund for order 49520979',
          customerPhone: '+237600000001',
          accountId: 'acct-client',
          entityId: 'order-1',
          paymentEntity: 'order_deposit_refund',
        },
        { throwOnWithdrawalFailure: false }
      );
    });

    it('does not start a second payout when refund is already pending', async () => {
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 0 },
      });

      const result = await service.refundDeposit('order-1');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('REFUND_IN_PROGRESS');
      expect(giveChangePayoutService.executeGiveChangePayout).not.toHaveBeenCalled();
    });

    it('marks refund failed when give-change initiation fails', async () => {
      giveChangePayoutService.executeGiveChangePayout.mockResolvedValue({
        success: false,
        data: { message: 'Insufficient funds' },
      });

      const result = await service.refundDeposit('order-1');

      expect(result.success).toBe(false);
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('MarkDepositRefundAttempted'),
        expect.objectContaining({ orderId: 'order-1', status: 'failed' })
      );
    });
  });

  describe('forfeitDeposit', () => {
    it('claws back the client wallet credit before marking forfeited', async () => {
      const result = await service.forfeitDeposit(
        'order-1',
        'customer_cancel_after_lock'
      );

      expect(result.success).toBe(true);
      expect(accountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith({
        accountId: 'acct-client',
        amount: 2000,
        referenceId: 'dep-txn-1',
        memo: 'Deposit forfeited for order 49520979',
      });
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('ForfeitDeposit'),
        expect.objectContaining({
          orderId: 'order-1',
          reason: 'customer_cancel_after_lock',
        })
      );
    });

    it('does not mark forfeited when wallet clawback fails', async () => {
      accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      });

      const result = await service.forfeitDeposit(
        'order-1',
        'customer_cancel_after_lock'
      );

      expect(result.success).toBe(false);
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
        expect.stringContaining('ForfeitDeposit'),
        expect.anything()
      );
    });
  });
});
