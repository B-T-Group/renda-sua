import { BusinessVerificationService } from './business-verification.service';

describe('BusinessVerificationService onboarding gates', () => {
  function createService(overrides: {
    rail?: 'mobile_money' | 'stripe';
    identityUploads?: Array<{
      id: string;
      is_approved: boolean;
      note: string | null;
      document_type: { name: string };
    }>;
    phoneStep?: { complete: boolean };
    catalogStep?: { complete: boolean };
    stripeAccount?: {
      charges_enabled: boolean;
      payouts_enabled: boolean;
      status: string;
    } | null;
    lifecycle?: {
      lifecycle_status: string;
      can_accept_orders: boolean;
    } | null;
    agreementComplete?: boolean;
  } = {}) {
    const hasuraUser = {
      executeQuery: jest.fn().mockResolvedValue({
        user_uploads: overrides.identityUploads ?? [],
      }),
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        preferred_language: 'en',
        business: {
          id: 'biz-1',
          name: 'Ada Shop',
          is_verified: false,
          merchant_agreement_version: overrides.agreementComplete === false
            ? null
            : 'v1',
          merchant_agreement_accepted_at:
            overrides.agreementComplete === false
              ? null
              : '2026-08-01T00:00:00Z',
        },
      }),
    };
    const hasuraSystem = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const paymentRouting = {
      resolveRailForUser: jest
        .fn()
        .mockResolvedValue(overrides.rail ?? 'mobile_money'),
    };
    const stripeConnect = {
      getByUserId: jest.fn().mockResolvedValue(overrides.stripeAccount ?? null),
    };
    const merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue(
        overrides.lifecycle ?? {
          lifecycle_status: 'catalog_ready',
          can_accept_orders: false,
          is_storefront_visible: false,
        }
      ),
      getLatestSuspension: jest.fn().mockResolvedValue(null),
      getCatalogStep: jest.fn().mockResolvedValue(
        overrides.catalogStep ?? {
          complete: false,
          hasLocation: true,
          hasApprovedItem: false,
          hasPendingItem: false,
          hasApprovedRental: false,
          hasPendingRental: false,
        }
      ),
      upsertPaymentAccount: jest.fn(),
    };
    const businessContracts = {
      getContractStatus: jest.fn().mockResolvedValue({
        complete: overrides.agreementComplete !== false,
        version: 'v1',
        acceptedAt: '2026-08-01T00:00:00Z',
        status: 'signed',
        boldSignEnabled: false,
        contractId: null,
      }),
      isBoldSignEnabledForBusiness: jest.fn().mockResolvedValue(false),
    };
    const mobilePaymentPhones = {
      getBusinessPhoneVerificationStep: jest.fn().mockResolvedValue(
        overrides.phoneStep ?? {
          complete: false,
          hasVerifiedPhone: false,
          locationCount: 1,
          locationCountNeedingPhone: 1,
        }
      ),
    };
    const agreementProvider = {
      getBusinessCountryCode: jest.fn().mockResolvedValue('CM'),
    };

    const service = new BusinessVerificationService(
      hasuraUser as any,
      hasuraSystem as any,
      {} as any,
      {} as any,
      paymentRouting as any,
      stripeConnect as any,
      merchantLifecycle as any,
      businessContracts as any,
      mobilePaymentPhones as any,
      agreementProvider as any
    );

    return {
      service,
      hasuraUser,
      merchantLifecycle,
      mobilePaymentPhones,
      businessContracts,
    };
  }

  describe('resolveIsOnboarding / resolveNextAction helpers', () => {
    it('ends MoMo focused onboarding after agreement + ID upload', () => {
      const { service } = createService();
      const resolveIsOnboarding = (service as any).resolveIsOnboarding.bind(
        service
      );

      expect(
        resolveIsOnboarding('payment_verification_pending', {
          paymentRail: 'mobile_money',
          steps: {
            agreement: { complete: true },
            identity: { status: 'pending' },
          },
        })
      ).toBe(false);

      expect(
        resolveIsOnboarding('catalog_ready', {
          paymentRail: 'mobile_money',
          steps: {
            agreement: { complete: true },
            identity: { status: 'missing' },
          },
        })
      ).toBe(true);

      expect(
        resolveIsOnboarding('catalog_ready', {
          paymentRail: 'mobile_money',
          steps: {
            agreement: { complete: false },
            identity: { status: 'pending' },
          },
        })
      ).toBe(true);
    });

    it('keeps Stripe merchants in onboarding until active/suspended', () => {
      const { service } = createService();
      const resolveIsOnboarding = (service as any).resolveIsOnboarding.bind(
        service
      );

      expect(
        resolveIsOnboarding('payment_setup_pending', {
          paymentRail: 'stripe',
          steps: { agreement: { complete: true } },
        })
      ).toBe(true);
      expect(
        resolveIsOnboarding('active', { paymentRail: 'stripe' })
      ).toBe(false);
      expect(
        resolveIsOnboarding('suspended', { paymentRail: 'stripe' })
      ).toBe(false);
    });

    it('does not require phone verification for MoMo nextAction', () => {
      const { service } = createService();
      const resolveNextAction = (service as any).resolveNextAction.bind(
        service
      );

      expect(
        resolveNextAction(true, { complete: true }, {
          complete: true,
          status: 'approved',
        })
      ).toBe('complete');
      expect(
        resolveNextAction(false, { complete: true }, {
          complete: true,
          status: 'pending',
        })
      ).toBe('pending_review');
      expect(
        resolveNextAction(false, { complete: true }, {
          complete: false,
          status: 'rejected',
        })
      ).toBe('upload_id');
    });

    it('completes Stripe setup without publish_catalog', () => {
      const { service } = createService();
      const resolveStripeNextAction = (
        service as any
      ).resolveStripeNextAction.bind(service);

      expect(
        resolveStripeNextAction(
          { complete: true },
          { complete: true },
          false
        )
      ).toBe('complete');
      expect(
        resolveStripeNextAction(
          { complete: true },
          { complete: false },
          false
        )
      ).toBe('setup_stripe_connect');
    });

    it('treats phone/catalog next actions as non-blocking for merchant action', () => {
      const { service } = createService();
      const requiresMerchantAction = (
        service as any
      ).requiresMerchantAction.bind(service);

      expect(requiresMerchantAction('sign_agreement')).toBe(true);
      expect(requiresMerchantAction('upload_id')).toBe(true);
      expect(requiresMerchantAction('setup_stripe_connect')).toBe(true);
      expect(requiresMerchantAction('verify_mobile_payment_phone')).toBe(false);
      expect(requiresMerchantAction('publish_catalog')).toBe(false);
      expect(requiresMerchantAction('pending_review')).toBe(false);
      expect(requiresMerchantAction('complete')).toBe(false);
    });
  });

  describe('getStatus / build status integration', () => {
    it('returns complete MoMo status with approved ID even when phone incomplete', async () => {
      const { service, mobilePaymentPhones, merchantLifecycle } = createService({
        rail: 'mobile_money',
        agreementComplete: true,
        identityUploads: [
          {
            id: 'up-1',
            is_approved: true,
            note: null,
            document_type: { name: 'id_card' },
          },
        ],
        phoneStep: {
          complete: false,
        },
        lifecycle: {
          lifecycle_status: 'active',
          can_accept_orders: true,
        },
      });

      const status = await service.getStatus();

      expect(status.nextAction).toBe('complete');
      expect(status.requiresMerchantAction).toBe(false);
      expect(status.is_verified).toBe(true);
      expect(status.isOnboarding).toBe(false);
      expect(status.is_storefront_visible).toBe(true);
      expect(status.can_accept_orders).toBe(true);
      expect(status.steps.catalog).toBeDefined();
      expect(mobilePaymentPhones.getBusinessPhoneVerificationStep).toHaveBeenCalled();
      expect(merchantLifecycle.getCatalogStep).toHaveBeenCalledWith('biz-1');
      expect(merchantLifecycle.upsertPaymentAccount).not.toHaveBeenCalled();
    });

    it('ends MoMo isOnboarding once ID is uploaded pending review', async () => {
      const { service } = createService({
        rail: 'mobile_money',
        agreementComplete: true,
        identityUploads: [
          {
            id: 'up-pending',
            is_approved: false,
            note: null,
            document_type: { name: 'passport' },
          },
        ],
        lifecycle: {
          lifecycle_status: 'payment_verification_pending',
          can_accept_orders: false,
        },
      });

      const status = await service.getStatus();

      expect(status.nextAction).toBe('pending_review');
      expect(status.requiresMerchantAction).toBe(false);
      expect(status.isOnboarding).toBe(false);
      expect(status.is_storefront_visible).toBe(false);
    });

    it('completes Stripe status from Connect readiness without catalog step', async () => {
      const { service, merchantLifecycle } = createService({
        rail: 'stripe',
        agreementComplete: true,
        stripeAccount: {
          charges_enabled: true,
          payouts_enabled: true,
          status: 'complete',
        },
        lifecycle: {
          lifecycle_status: 'payment_setup_pending',
          can_accept_orders: false,
        },
      });

      const status = await service.getStatus();

      expect(status.paymentRail).toBe('stripe');
      expect(status.nextAction).toBe('complete');
      expect(status.is_verified).toBe(true);
      expect(status.requiresMerchantAction).toBe(false);
      expect(status.steps).not.toHaveProperty('catalog');
      expect(status.steps).toHaveProperty('stripeConnect');
      expect(merchantLifecycle.getCatalogStep).not.toHaveBeenCalled();
    });
  });
});
