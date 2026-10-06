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
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 1 },
    });
  }

  function claimCalls() {
    return hasuraSystemService.executeMutation.mock.calls.filter(([q]) =>
      String(q).includes('ClaimDepositTransition')
    );
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

  it('rejects refund when the deposit is not yet captured', async () => {
    mockPaidOrder({ deposit_status: 'pending' });

    const result = await service.refundDeposit(orderId);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('DEPOSIT_NOT_CAPTURED');
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
    // The claim is handed back so a retry / forfeit / settlement can still act.
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('RevertDepositRefundClaim'),
      { orderId }
    );
  });

  it('claims paid -> refunded before releasing, and only then marks it complete', async () => {
    mockPaidOrder();
    const order: string[] = [];
    hasuraSystemService.executeMutation.mockImplementation(async (q: string) => {
      order.push(String(q).match(/mutation (\w+)/)?.[1] ?? '?');
      return { update_orders: { affected_rows: 1 } } as any;
    });
    depositLedgerService.releaseDepositToAvailable.mockImplementation(async () => {
      order.push('release');
    });

    const result = await service.refundDeposit(orderId);

    expect(result.success).toBe(true);
    expect(order).toEqual(['ClaimDepositTransition', 'release', 'CompleteDepositRefund']);
    expect(claimCalls()[0][0]).toContain('deposit_status: { _eq: paid }');
    expect(claimCalls()[0][1]).toEqual({
      orderId,
      set: { deposit_status: 'refunded', deposit_refund_status: 'pending' },
    });
  });

  it('moves no money when the refund or forfeit claim is lost', async () => {
    mockPaidOrder();
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 0 },
    });
    hasuraSystemService.executeQuery.mockImplementation(async (q: string) => {
      if (String(q).includes('ReadDepositStatus')) {
        return { orders_by_pk: { deposit_status: 'forfeited' } };
      }
      return {
        orders_by_pk: {
          id: orderId,
          order_number: '12345',
          current_status: 'cancelled',
          fulfillment_method: 'pickup',
          currency: 'XAF',
          deposit_amount: 500,
          deposit_mobile_payment_transaction_id: txnId,
          deposit_status: 'paid',
          deposit_refund_status: 'none',
          client: { user_id: 'client-1' },
        },
      };
    });

    const refund = await service.refundDeposit(orderId, { allowAfterLock: true });
    const forfeit = await service.forfeitDeposit(orderId, 'customer_no_show_pickup');

    expect(refund).toMatchObject({ success: false, errorCode: 'DEPOSIT_FORFEITED' });
    expect(forfeit).toMatchObject({ success: false, errorCode: 'DEPOSIT_FORFEITED' });
    expect(depositLedgerService.releaseDepositToAvailable).not.toHaveBeenCalled();
    expect(depositLedgerService.forfeitDepositToHq).not.toHaveBeenCalled();
  });

  it('refuses refund and forfeit for an applied deposit', async () => {
    mockPaidOrder({ deposit_status: 'applied' });

    const refund = await service.refundDeposit(orderId, { allowAfterLock: true });
    const forfeit = await service.forfeitDeposit(orderId, 'customer_no_show_pickup');

    expect(refund.errorCode).toBe('DEPOSIT_APPLIED');
    expect(forfeit.errorCode).toBe('DEPOSIT_APPLIED');
    expect(claimCalls()).toHaveLength(0);
    expect(depositLedgerService.releaseDepositToAvailable).not.toHaveBeenCalled();
    expect(depositLedgerService.forfeitDepositToHq).not.toHaveBeenCalled();
  });

  it('refuses a legacy paid deposit whose item settlement already ran and relabels it applied', async () => {
    mockPaidOrder({
      current_status: 'ready_for_pickup',
      order_holds: [{ item_settlement_completed_at: '2026-10-06T10:00:00Z' }],
    });

    const forfeit = await service.forfeitDeposit(orderId, 'customer_no_show_pickup');
    const refund = await service.refundDeposit(orderId, { allowAfterLock: true });

    expect(forfeit.errorCode).toBe('DEPOSIT_APPLIED');
    expect(refund.errorCode).toBe('DEPOSIT_APPLIED');
    expect(depositLedgerService.forfeitDepositToHq).not.toHaveBeenCalled();
    expect(depositLedgerService.releaseDepositToAvailable).not.toHaveBeenCalled();
    expect(claimCalls().map(([, vars]) => vars.set)).toEqual([
      { deposit_status: 'applied' },
      { deposit_status: 'applied' },
    ]);
  });

  it('claims paid -> forfeited with reason and store user before moving the ledger', async () => {
    mockPaidOrder({ current_status: 'cancelled', fulfillment_method: 'pickup' });

    const result = await service.forfeitDeposit(orderId, 'customer_no_show_pickup', {
      forfeitedByUserId: 'store-user-1',
    });

    expect(result.success).toBe(true);
    expect(claimCalls()).toHaveLength(1);
    expect(claimCalls()[0][1].set).toMatchObject({
      deposit_status: 'forfeited',
      deposit_forfeit_reason: 'customer_no_show_pickup',
      deposit_forfeited_by_user_id: 'store-user-1',
    });
    const claimOrder =
      hasuraSystemService.executeMutation.mock.invocationCallOrder[0];
    const ledgerOrder =
      depositLedgerService.forfeitDepositToHq.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(ledgerOrder);
  });

  it('keeps a claimed forfeit whose ledger failed and resumes it on the next call', async () => {
    mockPaidOrder({ current_status: 'cancelled' });
    depositLedgerService.forfeitDepositToHq.mockRejectedValueOnce(new Error('hq down'));

    const first = await service.forfeitDeposit(orderId, 'customer_no_show_pickup');
    expect(first).toMatchObject({ success: false, errorCode: 'FORFEIT_LEDGER_INCOMPLETE' });

    mockPaidOrder({
      current_status: 'cancelled',
      deposit_status: 'forfeited',
      deposit_forfeit_reason: 'customer_no_show_pickup',
    });
    const resumed = await service.forfeitDeposit(orderId, 'customer_no_show_pickup');

    expect(resumed).toMatchObject({ success: true, errorCode: 'ALREADY_FORFEITED' });
    expect(depositLedgerService.forfeitDepositToHq).toHaveBeenCalledTimes(2);
    expect(claimCalls()).toHaveLength(1); // only the first call claimed; the resume never re-claims
  });

  it('claimDepositApplied returns applied on a win, else the current status', async () => {
    mockPaidOrder();
    await expect(service.claimDepositApplied(orderId)).resolves.toBe('applied');

    hasuraSystemService.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 0 },
    });
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders_by_pk: { deposit_status: 'forfeited' },
    });
    await expect(service.claimDepositApplied(orderId)).resolves.toBe('forfeited');
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
