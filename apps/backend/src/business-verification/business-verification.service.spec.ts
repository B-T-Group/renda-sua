jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
import { BusinessVerificationService } from './business-verification.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';

describe('BusinessVerificationService MoMo ID status', () => {
  let service: BusinessVerificationService;
  let merchantLifecycle: {
    recompute: jest.Mock;
    getBusinessSnapshot: jest.Mock;
    getCatalogStep: jest.Mock;
    getLatestSuspension: jest.Mock;
    upsertPaymentAccount: jest.Mock;
  };
  let hasuraUser: { executeQuery: jest.Mock; getUser: jest.Mock };
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let mobilePhones: { getBusinessPhoneVerificationStep: jest.Mock };
  let contracts: { getContractStatus: jest.Mock };
  let launchPromo: { getSlotForBusiness: jest.Mock };

  beforeEach(() => {
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue({
        lifecycle_status: 'active',
        is_storefront_visible: true,
        can_accept_orders: true,
        is_verified: true,
      }),
      getCatalogStep: jest.fn().mockResolvedValue({
        complete: true,
        hasLocation: true,
        hasActiveInventory: true,
      }),
      getLatestSuspension: jest.fn().mockResolvedValue(null),
      upsertPaymentAccount: jest.fn().mockResolvedValue(undefined),
    };
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        business: {
          id: 'biz-1',
          is_verified: false,
          name: 'Ada Shop',
          merchant_agreement_version: 'v2',
          merchant_agreement_accepted_at: '2026-08-01T00:00:00Z',
        },
      }),
      executeQuery: jest.fn().mockResolvedValue({
        user_uploads: [
          {
            id: 'upload-1',
            is_approved: true,
            note: null,
            document_type: { name: 'id_card' },
          },
        ],
      }),
    };
    paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    mobilePhones = {
      getBusinessPhoneVerificationStep: jest.fn().mockResolvedValue({
        complete: true,
        status: 'verified',
      }),
    };
    contracts = {
      getContractStatus: jest.fn().mockResolvedValue({
        complete: true,
        boldSignEnabled: false,
        version: 'v2',
        acceptedAt: '2026-08-01T00:00:00Z',
        status: 'accepted',
        contractId: null,
      }),
    };
    launchPromo = {
      getSlotForBusiness: jest.fn().mockResolvedValue(null),
    };

    service = new BusinessVerificationService(
      hasuraUser as unknown as HasuraUserService,
      {} as HasuraSystemService,
      {} as any,
      {} as any,
      paymentRouting as unknown as PaymentRoutingService,
      {} as any,
      merchantLifecycle as unknown as MerchantLifecycleService,
      contracts as unknown as BusinessContractsService,
      mobilePhones as unknown as MobilePaymentPhonesService,
      {} as any,
      launchPromo as any
    );
  });

  it('returns DB is_verified from lifecycle snapshot after agreement', async () => {
    const status = await service.getStatus();

    expect(merchantLifecycle.upsertPaymentAccount).not.toHaveBeenCalled();
    expect(status.is_verified).toBe(true);
    expect(status.nextAction).toBe('complete');
    expect(status.isOnboarding).toBe(false);
  });

  it('includes phone and catalog steps while ID is optional for the badge', async () => {
    const status = await service.getStatus();

    expect(status.steps.identity.status).toBe('approved');
    expect(status.steps.mobilePaymentPhone.status).toBe('verified');
    expect(status.steps.catalog.complete).toBe(true);
    expect(status.nextAction).toBe('complete');
  });

  it('ends onboarding after agreement even without approved ID', async () => {
    merchantLifecycle.getBusinessSnapshot.mockResolvedValue({
      lifecycle_status: 'active',
      is_storefront_visible: true,
      can_accept_orders: true,
      is_verified: false,
    });
    hasuraUser.executeQuery.mockResolvedValue({ user_uploads: [] });

    const status = await service.getStatus();

    expect(status.is_verified).toBe(false);
    expect(status.nextAction).toBe('complete');
    expect(status.isOnboarding).toBe(false);
    expect(status.requiresMerchantAction).toBe(false);
  });
});

describe('BusinessVerificationService Stripe Connect next action', () => {
  let service: BusinessVerificationService;
  let merchantLifecycle: {
    recompute: jest.Mock;
    getBusinessSnapshot: jest.Mock;
    getLatestSuspension: jest.Mock;
  };
  let hasuraUser: { getUser: jest.Mock };
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let stripeConnect: { getByUserId: jest.Mock };
  let contracts: { getContractStatus: jest.Mock };
  let launchPromo: { getSlotForBusiness: jest.Mock };

  beforeEach(() => {
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue({
        lifecycle_status: 'active',
        is_storefront_visible: true,
        can_accept_orders: true,
        is_verified: true,
      }),
      getLatestSuspension: jest.fn().mockResolvedValue(null),
    };
    hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        first_name: 'Stripe',
        last_name: 'Merchant',
        email: 'stripe@example.com',
        business: {
          id: 'biz-stripe',
          name: 'Stripe Shop',
          merchant_agreement_version: 'v2',
          merchant_agreement_accepted_at: '2026-08-01T00:00:00Z',
        },
      }),
    };
    paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue('stripe'),
    };
    stripeConnect = {
      getByUserId: jest.fn(),
    };
    contracts = {
      getContractStatus: jest.fn().mockResolvedValue({
        complete: true,
        boldSignEnabled: false,
        version: 'v2',
        acceptedAt: '2026-08-01T00:00:00Z',
        status: 'accepted',
        contractId: null,
      }),
    };
    launchPromo = {
      getSlotForBusiness: jest.fn().mockResolvedValue(null),
    };

    service = new BusinessVerificationService(
      hasuraUser as unknown as HasuraUserService,
      {} as HasuraSystemService,
      {} as any,
      {} as any,
      paymentRouting as unknown as PaymentRoutingService,
      stripeConnect as any,
      merchantLifecycle as unknown as MerchantLifecycleService,
      contracts as unknown as BusinessContractsService,
      {} as any,
      {} as any,
      launchPromo as any
    );
  });

  it('returns sign_agreement when agreement is not complete', async () => {
    contracts.getContractStatus.mockResolvedValue({
      complete: false,
      boldSignEnabled: false,
      version: null,
      acceptedAt: null,
      status: null,
      contractId: null,
    });
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      first_name: 'Stripe',
      last_name: 'Merchant',
      email: 'stripe@example.com',
      business: {
        id: 'biz-stripe',
        name: 'Stripe Shop',
        merchant_agreement_version: null,
        merchant_agreement_accepted_at: null,
      },
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('sign_agreement');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.paymentRail).toBe('stripe');
  });

  it('returns setup_stripe_connect when agreement is complete but Connect is not', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: false,
      payouts_enabled: false,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.paymentRail).toBe('stripe');
    expect(status.steps.stripeConnect.complete).toBe(false);
    expect(status.steps.stripeConnect.connected).toBe(true);
  });

  it('returns setup_stripe_connect when charges enabled but payouts disabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: true,
      payouts_enabled: false,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
  });

  it('returns setup_stripe_connect when payouts enabled but charges disabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'pending',
      charges_enabled: false,
      payouts_enabled: true,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
  });

  it('returns complete when both charges and payouts are enabled', async () => {
    stripeConnect.getByUserId.mockResolvedValue({
      id: 'acct_123',
      status: 'active',
      charges_enabled: true,
      payouts_enabled: true,
    });

    const status = await service.getStatus();

    expect(status.nextAction).toBe('complete');
    expect(status.requiresMerchantAction).toBe(false);
    expect(status.steps.stripeConnect.complete).toBe(true);
  });

  it('returns setup_stripe_connect when Connect account does not exist', async () => {
    stripeConnect.getByUserId.mockResolvedValue(null);

    const status = await service.getStatus();

    expect(status.nextAction).toBe('setup_stripe_connect');
    expect(status.requiresMerchantAction).toBe(true);
    expect(status.steps.stripeConnect.complete).toBe(false);
    expect(status.steps.stripeConnect.connected).toBe(false);
    expect(status.steps.stripeConnect.status).toBe('not_started');
  });
});
