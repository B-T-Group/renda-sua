import { ConflictException } from '@nestjs/common';
import { MobilePaymentPhonesService } from './mobile-payment-phones.service';

describe('MobilePaymentPhonesService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const mobilePaymentsDatabaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    getTransactionById: jest.fn(),
  };
  const mobilePaymentsService = {
    getProvider: jest.fn(),
    initiatePayment: jest.fn(),
  };
  const giveChangePayoutService = {
    executeGiveChangePayout: jest.fn(),
  };
  const merchantLifecycleService = {
    getBusinessIdForUser: jest.fn(),
    upsertPaymentAccount: jest.fn(),
  };
  const paymentRoutingService = {
    resolveRailForUser: jest.fn(),
  };

  let service: MobilePaymentPhonesService;

  const phoneRow = {
    id: 'phone-1',
    user_id: 'user-1',
    phone_e164: '+237600000001',
    is_verified: false,
    verified_at: null,
    last_verification_transaction_id: 'tx-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobilePaymentPhonesService(
      hasuraSystemService as never,
      mobilePaymentsDatabaseService as never,
      mobilePaymentsService as never,
      giveChangePayoutService as never,
      merchantLifecycleService as never,
      paymentRoutingService as never
    );
    paymentRoutingService.resolveRailForUser.mockResolvedValue('mobile_money');
  });

  describe('updateForUser', () => {
    it('clears verification when E164 changes', async () => {
      jest.spyOn(service, 'getByIdForUser').mockResolvedValue(phoneRow);
      jest.spyOn(service as any, 'findByUserAndE164').mockResolvedValue(null);
      jest.spyOn(service as any, 'syncLocationPhonesFromRegistry').mockResolvedValue(undefined);
      jest.spyOn(service, 'onVerificationLost').mockResolvedValue(undefined);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_user_mobile_payment_phones_by_pk: {
          ...phoneRow,
          phone_e164: '+237600000002',
          is_verified: false,
        },
      });

      const updated = await service.updateForUser(
        'user-1',
        'phone-1',
        '237',
        '600000002'
      );

      expect(updated.is_verified).toBe(false);
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('is_verified: false'),
        expect.objectContaining({ id: 'phone-1', phone: '+237600000002' })
      );
      expect(service.onVerificationLost).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteForUser', () => {
    it('unlinks locations and agent then deletes', async () => {
      jest.spyOn(service, 'getByIdForUser').mockResolvedValue(phoneRow);
      jest.spyOn(service as any, 'maybeUnverifyAgent').mockResolvedValue(undefined);
      hasuraSystemService.executeMutation.mockResolvedValue({});

      await service.deleteForUser('user-1', 'phone-1');

      const mutations = hasuraSystemService.executeMutation.mock.calls.map(
        (c) => c[0] as string
      );
      expect(mutations.some((q) => q.includes('UnlinkLocPhones'))).toBe(true);
      expect(mutations.some((q) => q.includes('UnlinkAgentPhone'))).toBe(true);
      expect(mutations.some((q) => q.includes('DeletePhone'))).toBe(true);
      expect(service['maybeUnverifyAgent']).toHaveBeenCalledWith('user-1');
    });
  });

  describe('completeVerificationFromTransaction', () => {
    const paymentTx = {
      id: 'tx-1',
      payment_entity: 'phone_verification',
      customer_phone: '+237600000001',
    };

    it('replays refund and activation when phone is already verified', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue({
        ...phoneRow,
        is_verified: true,
        last_verification_transaction_id: 'tx-1',
      });
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue(paymentTx);
      jest.spyOn(service as any, 'refundVerificationIfNeeded').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'markVerified').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'activateAfterVerification').mockResolvedValue(undefined);

      await service.completeVerificationFromTransaction('phone-1', 'tx-1');

      expect(service['markVerified']).not.toHaveBeenCalled();
      expect(service['refundVerificationIfNeeded']).toHaveBeenCalled();
      expect(service['activateAfterVerification']).toHaveBeenCalledWith('user-1');
    });

    it('activates even when the refund fails, and surfaces the failure', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue(phoneRow);
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue(paymentTx);
      jest.spyOn(service as any, 'markVerified').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'refundVerificationIfNeeded')
        .mockRejectedValue(new Error('payout unavailable'));
      jest.spyOn(service as any, 'activateAfterVerification').mockResolvedValue(undefined);

      await expect(
        service.completeVerificationFromTransaction('phone-1', 'tx-1')
      ).rejects.toThrow(/refund: payout unavailable/);

      expect(service['markVerified']).toHaveBeenCalledWith('phone-1', 'tx-1');
      expect(service['activateAfterVerification']).toHaveBeenCalledWith('user-1');
    });

    it('refunds even when activation fails, and surfaces the failure', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue(phoneRow);
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue(paymentTx);
      jest.spyOn(service as any, 'markVerified').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'refundVerificationIfNeeded').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'activateAfterVerification')
        .mockRejectedValue(new Error('agent lookup failed'));

      await expect(
        service.completeVerificationFromTransaction('phone-1', 'tx-1')
      ).rejects.toThrow(/activation: agent lookup failed/);

      expect(service['refundVerificationIfNeeded']).toHaveBeenCalled();
    });

    it('marks verified and activates on first success', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue(phoneRow);
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue(paymentTx);
      jest.spyOn(service as any, 'markVerified').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'refundVerificationIfNeeded').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'activateAfterVerification').mockResolvedValue(undefined);

      await service.completeVerificationFromTransaction('phone-1', 'tx-1');

      expect(service['markVerified']).toHaveBeenCalledWith('phone-1', 'tx-1');
      expect(service['activateAfterVerification']).toHaveBeenCalledWith('user-1');
    });

    it('ignores stale callbacks for a superseded verification tx', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue({
        ...phoneRow,
        last_verification_transaction_id: 'tx-new',
      });
      jest.spyOn(service as any, 'markVerified').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'refundSupersededVerificationIfSuccessful')
        .mockResolvedValue(undefined);

      await service.completeVerificationFromTransaction('phone-1', 'tx-1');

      expect(service['markVerified']).not.toHaveBeenCalled();
      expect(
        service['refundSupersededVerificationIfSuccessful']
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'phone-1' }),
        'tx-1'
      );
    });

    it('refunds superseded successful verification charges', async () => {
      jest.spyOn(service as any, 'fetchPhoneById').mockResolvedValue({
        ...phoneRow,
        last_verification_transaction_id: 'tx-new',
      });
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'tx-1',
        payment_entity: 'phone_verification',
        status: 'success',
        customer_phone: '+237600000001',
      });
      jest
        .spyOn(service as any, 'refundVerificationTransaction')
        .mockResolvedValue(undefined);

      await service.completeVerificationFromTransaction('phone-1', 'tx-1');

      expect(service['refundVerificationTransaction']).toHaveBeenCalledWith(
        '+237600000001',
        'tx-1'
      );
    });
  });

  describe('findRefundForVerification', () => {
    it('types entity_id and status as text, not enums', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        mobile_payment_transactions: [],
      });

      await (service as any).findRefundForVerification(
        'tx-1',
        '+237600000001'
      );

      const [query, variables] =
        hasuraSystemService.executeQuery.mock.calls[0];
      expect(query).toContain('$entityId: String!');
      expect(query).not.toContain('uuid!');
      expect(query).toContain('_in: ["success", "pending"]');
      expect(variables).toEqual({
        entityId: 'tx-1',
        desc: 'Phone verification refund +237600000001',
      });
    });
  });
});
