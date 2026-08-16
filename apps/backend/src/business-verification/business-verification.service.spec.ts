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
        lifecycle_status: 'created',
        is_storefront_visible: false,
        can_accept_orders: false,
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

  it('derives verified status from approved ID without writing generated is_verified', async () => {
    const status = await service.getStatus();

    expect(merchantLifecycle.upsertPaymentAccount).not.toHaveBeenCalled();
    expect(status.is_verified).toBe(true);
    expect(status.nextAction).toBe('complete');
  });

  it('includes phone and catalog steps while ID approval completes verification', async () => {
    const status = await service.getStatus();

    expect(status.steps.identity.status).toBe('approved');
    expect(status.steps.mobilePaymentPhone.status).toBe('verified');
    expect(status.steps.catalog.complete).toBe(true);
    expect(status.nextAction).toBe('complete');
  });
});
