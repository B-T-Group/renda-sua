import {
  buildFreemopayReplayDto,
  buildMypvitReplayDto,
} from './callback-replay.util';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MobileTransactionStatus } from './mobile-payments.service';

function tx(
  overrides: Partial<MobilePaymentTransaction> = {}
): MobilePaymentTransaction {
  return {
    id: 'tx-1',
    reference: 'P-REF-1',
    amount: 2500,
    currency: 'XAF',
    description: 'Withdrawal',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_type: 'GIVE_CHANGE',
    transaction_id: 'prov-abc',
    account_id: 'acct-1',
    customer_phone: '+237690000000',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function live(
  overrides: Partial<MobileTransactionStatus> = {}
): MobileTransactionStatus {
  return {
    transactionId: 'live-1',
    status: 'success',
    amount: 2500,
    currency: 'XAF',
    reference: 'P-REF-1',
    ...overrides,
  };
}

describe('callback-replay.util', () => {
  describe('buildMypvitReplayDto', () => {
    it('maps success onto the stored merchant reference', () => {
      const dto = buildMypvitReplayDto(tx(), live(), '690000000');

      expect(dto).toEqual(
        expect.objectContaining({
          transactionId: 'live-1',
          merchantReferenceId: 'P-REF-1',
          status: 'SUCCESS',
          amount: 2500,
          customerID: '690000000',
          code: 200,
        })
      );
    });

    it('maps failure and falls back to stored amount and provider id', () => {
      const dto = buildMypvitReplayDto(
        tx(),
        live({
          status: 'failed',
          transactionId: '',
          amount: undefined as unknown as number,
          message: 'Rejected',
        }),
        '690000000'
      );

      expect(dto.status).toBe('FAILED');
      expect(dto.code).toBe(400);
      expect(dto.transactionId).toBe('prov-abc');
      expect(dto.amount).toBe(2500);
    });
  });

  describe('buildFreemopayReplayDto', () => {
    it('uses stored provider reference as Freemopay callback reference', () => {
      const dto = buildFreemopayReplayDto(tx(), live());

      expect(dto).toEqual(
        expect.objectContaining({
          reference: 'prov-abc',
          externalId: 'P-REF-1',
          status: 'SUCCESS',
          amount: 2500,
          reason: undefined,
        })
      );
    });

    it('includes the live failure reason for replayed FAILED callbacks', () => {
      const dto = buildFreemopayReplayDto(
        tx({ transaction_id: undefined }),
        live({ status: 'failed', message: 'Insufficient balance' })
      );

      expect(dto.status).toBe('FAILED');
      expect(dto.reference).toBe('');
      expect(dto.reason).toBe('Insufficient balance');
      expect(dto.message).toBe('Insufficient balance');
    });
  });
});
