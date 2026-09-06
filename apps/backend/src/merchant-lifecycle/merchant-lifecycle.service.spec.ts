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
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let launchPromo: { confirmSlot: jest.Mock };
  let stripeAccounts: Array<{
    provider: string;
    capability_status: string;
  }>;
  let service: MerchantLifecycleService;

  const upsertAccountCalls = () =>
    hasuraSystemService.executeMutation.mock.calls.filter(([mutation]) =>
      mutation.includes('UpsertPaymentAccount')
    );

  const mutationVars = (name: string) =>
    hasuraSystemService.executeMutation.mock.calls.find(([mutation]) =>
      mutation.includes(name)
    )?.[1];

  const queriedCatalog = () =>
    hasuraSystemService.executeQuery.mock.calls.some(([query]) =>
      query.includes('CatalogInventory')
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
    stripeAccounts = [];
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
        if (query.includes('query PaymentAccounts')) {
          return { business_payment_accounts: stripeAccounts };
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
    paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    launchPromo = { confirmSlot: jest.fn() };
    service = new MerchantLifecycleService(
      hasuraSystemService as any,
      notificationsService as any,
      paymentRouting as any,
      contractsService as any,
      launchPromo as any
    );
  });

  it('persists pending MoMo capability and emails admin when activating', async () => {
    uploads = [{ is_approved: false, note: null }];

    await service.recompute('biz-1');

    expect(upsertAccountCalls()).toHaveLength(1);
    expect(upsertAccountCalls()[0][1].row).toMatchObject({
      business_id: 'biz-1',
      provider: 'mobile_money',
      capability_status: 'verification_pending',
    });
    // Merchant review-pending is skipped during activation to avoid conflicting
    // with the store-activated email; admins still get notified.
    expect(
      notificationsService.sendMerchantPaymentReviewPendingEmail
    ).not.toHaveBeenCalled();
    expect(
      notificationsService.sendAdminMerchantReviewPendingEmail
    ).toHaveBeenCalledTimes(1);
  });

  it('emails the merchant when ID review starts after the store is already active', async () => {
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
    uploads = [{ is_approved: false, note: null }];

    await service.recompute('biz-1');

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
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
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

  it('still sends rejection email when clearing a previously verified badge', async () => {
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
    businessSnapshot.is_verified = true;
    uploads = [{ is_approved: false, note: '[REJECTED] Name mismatch' }];
    momoAccounts = [{ capability_status: 'verified' }];

    await service.recompute('biz-1');

    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationsService.sendMerchantPaymentVerificationFailedEmail
    ).toHaveBeenCalledWith({
      to: 'merchant@example.com',
      businessName: 'Test Biz',
      reason: 'Name mismatch',
    });
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

  it('persists is_verified independently of lifecycle when ID is approved', async () => {
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
    uploads = [{ is_approved: true, note: null }];

    await service.recompute('biz-1');

    const verifiedCalls = hasuraSystemService.executeMutation.mock.calls.filter(
      ([mutation]) =>
        mutation.includes('SetVerifiedAndVisibility') ||
        mutation.includes('SetLifecycleVisibilityAndVerified')
    );
    expect(verifiedCalls.length).toBeGreaterThan(0);
    const vars = verifiedCalls[0][1];
    expect(vars.verified).toBe(true);
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

  it('promotes created to active without a verified badge after the contract is signed', async () => {
    businessSnapshot.lifecycle_status = 'created';
    businessSnapshot.is_storefront_visible = false;

    await service.recompute('biz-1');

    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toMatchObject({
      status: 'active',
      visible: true,
      verified: false,
    });
    expect(queriedCatalog()).toBe(false);
    expect(launchPromo.confirmSlot).toHaveBeenCalledWith('biz-1');
    expect(notificationsService.sendMerchantActivatedEmail).toHaveBeenCalled();
  });

  it('grants the verified badge without activating when ID is approved but unsigned', async () => {
    businessSnapshot.lifecycle_status = 'created';
    contractsService.hasValidSignedContract.mockResolvedValue(false);
    uploads = [{ is_approved: true, note: null }];

    await service.recompute('biz-1');

    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toBeUndefined();
    expect(mutationVars('SetVerifiedAndVisibility')).toMatchObject({
      visible: false,
      verified: true,
    });
    expect(launchPromo.confirmSlot).not.toHaveBeenCalled();
    expect(
      notificationsService.sendMerchantActivatedEmail
    ).not.toHaveBeenCalled();
  });

  it('activates Stripe merchants without Connect and keeps the badge off', async () => {
    paymentRouting.resolveRailForUser.mockResolvedValue('stripe');
    businessSnapshot.lifecycle_status = 'created';

    await service.recompute('biz-1');

    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toMatchObject({
      status: 'active',
      visible: true,
      verified: false,
    });
  });

  it('sets the Stripe verified badge only when Connect is verified', async () => {
    paymentRouting.resolveRailForUser.mockResolvedValue('stripe');
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
    stripeAccounts = [
      { provider: 'stripe', capability_status: 'verified' },
      { provider: 'mobile_money', capability_status: 'not_started' },
    ];

    await service.recompute('biz-1');

    expect(mutationVars('SetVerifiedAndVisibility')).toMatchObject({
      visible: true,
      verified: true,
    });
  });

  it('does not promote a suspended merchant even with a signed contract', async () => {
    businessSnapshot.lifecycle_status = 'suspended';

    await service.recompute('biz-1');

    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toBeUndefined();
    expect(mutationVars('SetStorefrontVisible')).toMatchObject({
      visible: false,
    });
    expect(launchPromo.confirmSlot).not.toHaveBeenCalled();
  });

  it('reinstates a signed merchant to active and an unsigned one to created', async () => {
    businessSnapshot.lifecycle_status = 'suspended';
    await service.reinstate('biz-1', 'admin-1');
    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toMatchObject({
      status: 'active',
      visible: true,
      verified: false,
    });

    hasuraSystemService.executeMutation.mockClear();
    contractsService.hasValidSignedContract.mockResolvedValue(false);
    await service.reinstate('biz-1', 'admin-1');
    expect(mutationVars('SetLifecycleVisibilityAndVerified')).toMatchObject({
      status: 'created',
      visible: false,
      verified: false,
    });
  });

  it('upsertPaymentAccount recomputes once without recursion or double emails', async () => {
    businessSnapshot.lifecycle_status = 'active';
    businessSnapshot.can_accept_orders = true;
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
