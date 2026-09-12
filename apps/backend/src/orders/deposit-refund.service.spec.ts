import { Test, TestingModule } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositLedgerService } from './deposit-ledger.service';
import { DepositRefundService } from './deposit-refund.service';

describe('DepositRefundService', () => {
  let service: DepositRefundService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let depositLedgerService: jest.Mocked<DepositLedgerService>;
  let depositCalculationService: jest.Mocked<DepositCalculationService>;

  const orderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const txnId = '99a3bd0d-262c-4d4c-80da-5071b4bfbfa2';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositRefundService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn(),
            executeMutation: jest.fn(),
            getAccount: jest.fn(),
          },
        },
        {
          provide: DepositCalculationService,
          useValue: {
            isAfterRefundLockPoint: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: DepositLedgerService,
          useValue: {
            releaseDepositToAvailable: jest.fn().mockResolvedValue(undefined),
            forfeitDepositToHq: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(DepositRefundService);
    hasuraSystemService = module.get(HasuraSystemService);
    depositLedgerService = module.get(DepositLedgerService);
    depositCalculationService = module.get(DepositCalculationService);
  });

  function mockPaidOrder(overrides: Record<string, unknown> = {}) {
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: orderId,
        order_number: '12345',
        current_status: 'pending',
        fulfillment_method: 'delivery',
        currency: 'XAF',
        deposit_amount: 500,
        deposit_mobile_payment_transaction_id: txnId,
        deposit_status: 'paid',
        deposit_refund_status: 'none',
        client: { user_id: 'client-1' },
        ...overrides,
      },
    });
    hasuraSystemService.getAccount.mockResolvedValue({ id: 'acct-1' } as any);
    hasuraSystemService.executeMutation.mockResolvedValue({});
  }

  it('refunds by releasing hold to available (no MoMo withdraw)', async () => {
    mockPaidOrder();

    const result = await service.refundDeposit(orderId);

    expect(result.success).toBe(true);
    expect(depositLedgerService.releaseDepositToAvailable).toHaveBeenCalledWith({
      clientAccountId: 'acct-1',
      amount: 500,
      orderNumber: '12345',
      depositTransactionId: txnId,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalled();
  });

  it('allows business refund after lock when allowAfterLock is true', async () => {
    mockPaidOrder({ current_status: 'out_for_delivery' });
    depositCalculationService.isAfterRefundLockPoint.mockReturnValue(true);

    const blocked = await service.refundDeposit(orderId);
    expect(blocked.success).toBe(false);
    expect(blocked.errorCode).toBe('AFTER_LOCK_POINT');

    const allowed = await service.refundDeposit(orderId, {
      allowAfterLock: true,
    });
    expect(allowed.success).toBe(true);
  });

  it('forfeits deposit to HQ wallet', async () => {
    mockPaidOrder({ current_status: 'out_for_delivery' });

    const result = await service.forfeitDeposit(
      orderId,
      'customer_cancel_after_lock'
    );

    expect(result.success).toBe(true);
    expect(depositLedgerService.forfeitDepositToHq).toHaveBeenCalledWith({
      clientAccountId: 'acct-1',
      amount: 500,
      currency: 'XAF',
      orderNumber: '12345',
      depositTransactionId: txnId,
    });
  });

  it('rejects refund when deposit was already refunded or forfeited', async () => {
    mockPaidOrder({ deposit_status: 'refunded' });
    const refunded = await service.refundDeposit(orderId);
    expect(refunded.errorCode).toBe('ALREADY_REFUNDED');

    mockPaidOrder({ deposit_status: 'forfeited' });
    const forfeited = await service.refundDeposit(orderId);
    expect(forfeited.errorCode).toBe('DEPOSIT_FORFEITED');
    expect(depositLedgerService.releaseDepositToAvailable).not.toHaveBeenCalled();
  });

  it('rejects refund when the deposit transaction or account is missing', async () => {
    mockPaidOrder({ deposit_mobile_payment_transaction_id: null });
    const noTx = await service.refundDeposit(orderId);
    expect(noTx.errorCode).toBe('NO_DEPOSIT_TX');

    mockPaidOrder();
    hasuraSystemService.getAccount.mockResolvedValue(null as any);
    const noAccount = await service.refundDeposit(orderId);
    expect(noAccount.errorCode).toBe('ACCOUNT_NOT_FOUND');
  });

  it('marks refund failed when ledger release throws', async () => {
    mockPaidOrder();
    depositLedgerService.releaseDepositToAvailable.mockRejectedValue(
      new Error('hold missing')
    );

    const result = await service.refundDeposit(orderId);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('REFUND_ERROR');
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkDepositRefundFailed'),
      { orderId }
    );
  });

  it('does not forfeit a deposit that is unpaid or already forfeited', async () => {
    mockPaidOrder({ deposit_status: 'pending' });
    const unpaid = await service.forfeitDeposit(
      orderId,
      'customer_cancel_after_lock'
    );
    expect(unpaid.success).toBe(false);

    mockPaidOrder({ deposit_forfeited_at: '2026-09-10T00:00:00.000Z' });
    const already = await service.forfeitDeposit(
      orderId,
      'customer_cancel_after_lock'
    );
    expect(already.success).toBe(false);
    expect(depositLedgerService.forfeitDepositToHq).not.toHaveBeenCalled();
  });
});
