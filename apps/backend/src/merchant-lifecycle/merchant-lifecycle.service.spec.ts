import { MerchantLifecycleService } from './merchant-lifecycle.service';

// These modules form circular import chains (notifications <-> orchestration);
// mock them so the service module can load in isolation.
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
jest.mock('../business-contracts/business-contracts.service', () => ({
  BusinessContractsService: jest.fn(),
}));
jest.mock('../launch-promo/launch-promo.service', () => ({
  LaunchPromoService: jest.fn(),
}));

describe('MerchantLifecycleService (MoMo capability sync)', () => {
  let businessSnapshot: {
    id: string;
    name: string;
    lifecycle_status: string;
    can_accept_orders: boolean;
    is_storefront_visible: boolean;
    is_verified: boolean;
    merchant_agreement_version: string | null;
    merchant_agreement_accepted_at: string | null;
    user: { id: string; email: string };
  };

  let uploads: Array<{ is_approved: boolean; note: string | null }>;
  let momoAccounts: Array<{ capability_status: string }>;
  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let notificationsService: {
    sendMerchantPaymentReviewPendingEmail: jest.Mock;
    sendAdminMerchantReviewPendingEmail: jest.Mock;
    sendMerchantPaymentVerificationFailedEmail: jest.Mock;
    sendMerchantActivatedEmail: jest.Mock;
  };
  let contractsService: { hasValidSignedContract: jest.Mock };
  let service: MerchantLifecycleService;

  const upsertAccountCalls = () =>
    hasuraSystemService.executeMutation.mock.calls.filter(([mutation]) =>
      mutation.includes('UpsertPaymentAccount')
    );

  beforeEach(() => {
    businessSnapshot = {
      id: 'biz-1',
      name: 'Test Biz',
      lifecycle_status: 'contract_signed',
      can_accept_orders: false,
      is_storefront_visible: true,
      is_verified: false,
      merchant_agreement_version: 'v1',
      merchant_agreement_accepted_at: '2026-01-01T00:00:00Z',
      user: { id: 'user-1', email: 'merchant@example.com' },
    };
    uploads = [];
    momoAccounts = [];
    hasuraSystemService = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('BusinessLifecycle')) {
          return { businesses_by_pk: businessSnapshot };
        }
        if (query.includes('BusinessUser')) {
          return { businesses_by_pk: { user_id: 'user-1' } };
        }
        if (query.includes('MoMoIdCapability')) {
          return { user_uploads: uploads };
        }
        if (query.includes('PaymentAccountStatus')) {
          return { business_payment_accounts: momoAccounts };
        }
        return {};
      }),
      // Mirror the persisted capability so subsequent status reads see it.
      executeMutation: jest.fn(async (mutation: string, variables: any) => {
        if (mutation.includes('UpsertPaymentAccount')) {
          momoAccounts = [
            { capability_status: variables.row.capability_status },
          ];
        }
        return {};
      }),
    };
    notificationsService = {
      sendMerchantPaymentReviewPendingEmail: jest.fn(),
      sendAdminMerchantReviewPendingEmail: jest.fn(),
      sendMerchantPaymentVerificationFailedEmail: jest.fn(),
      sendMerchantActivatedEmail: jest.fn(),
    };
    contractsService = {
      hasValidSignedContract: jest.fn().mockResolvedValue(true),
    };
    service = new MerchantLifecycleService(
      hasuraSystemService as any,
      notificationsService as any,
      { resolveRailForUser: jest.fn().mockResolvedValue('mobile_money') } as any,
      contractsService as any,
      { confirmSlot: jest.fn() } as any
    );
  });

  it('persists pending MoMo capability and emails once when the contract is signed', async () => {
    uploads = [{ is_approved: false, note: null }];

    await service.recompute('biz-1');

    expect(upsertAccountCalls()).toHaveLength(1);
    expect(upsertAccountCalls()[0][1].row).toMatchObject({
      business_id: 'biz-1',
      provider: 'mobile_money',
      capability_status: 'verification_pending',
    });
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).toHaveBeenCalledWith({
      to: 'merchant@example.com',
      businessName: 'Test Biz',
    });
    expect(
      notificationsService.sendAdminMerchantReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
  });

  it('does not re-send emails when the MoMo state is unchanged', async () => {
    uploads = [{ is_approved: false, note: null }];

    await service.recompute('biz-1');
    await service.recompute('biz-1');

    expect(upsertAccountCalls()).toHaveLength(1);
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationsService.sendAdminMerchantReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
  });

  it('sends the verification failed email with the rejection reason', async () => {
    uploads = [{ is_approved: false, note: '[REJECTED] Blurry ID photo' }];
    momoAccounts = [{ capability_status: 'verification_pending' }];

    await service.recompute('biz-1');

    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).toHaveBeenCalledWith({
      to: 'merchant@example.com',
      businessName: 'Test Biz',
      reason: 'Blurry ID photo',
    });
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
  });

  it('does not send review emails when MoMo identity is verified', async () => {
    uploads = [{ is_approved: true, note: null }];
    momoAccounts = [{ capability_status: 'verification_pending' }];

    await service.recompute('biz-1');

    expect(upsertAccountCalls()[0][1].row).toMatchObject({
      capability_status: 'verified',
    });
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).not.toHaveBeenCalled();
  });

  it('does not create a payment account row for not-started merchants', async () => {
    uploads = [];

    await service.recompute('biz-1');

    expect(upsertAccountCalls()).toHaveLength(0);
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
  });

  it('persists capability but sends no emails while in created status (no signed contract)', async () => {
    businessSnapshot.lifecycle_status = 'created';
    contractsService.hasValidSignedContract.mockResolvedValue(false);
    uploads = [{ is_approved: false, note: null }];

    await service.recompute('biz-1');

    expect(upsertAccountCalls()).toHaveLength(1);
    expect(upsertAccountCalls()[0][1].row).toMatchObject({
      capability_status: 'verification_pending',
    });
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
    expect(
      notificationsService.sendAdminMerchantReviewPendingEmail
    ).not.toHaveBeenCalled();
    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).not.toHaveBeenCalled();
  });

  it('upsertPaymentAccount sends no emails while in created status', async () => {
    businessSnapshot.lifecycle_status = 'created';
    contractsService.hasValidSignedContract.mockResolvedValue(false);
    uploads = [{ is_approved: false, note: null }];

    await service.upsertPaymentAccount({
      businessId: 'biz-1',
      provider: 'mobile_money',
      capabilityStatus: 'verification_pending',
    });

    expect(upsertAccountCalls()).toHaveLength(1);
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).not.toHaveBeenCalled();
  });

  it('upsertPaymentAccount recomputes once without recursion or double emails', async () => {
    uploads = [{ is_approved: false, note: null }];
    const recomputeSpy = jest.spyOn(service, 'recompute');

    await service.upsertPaymentAccount({
      businessId: 'biz-1',
      provider: 'mobile_money',
      capabilityStatus: 'verification_pending',
    });

    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(upsertAccountCalls()).toHaveLength(1);
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
  });
});
