import { BusinessVerificationService } from './business-verification.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';

describe('BusinessVerificationService MoMo ID heal', () => {
  let service: BusinessVerificationService;
  let merchantLifecycle: {
    recompute: jest.Mock;
    getBusinessSnapshot: jest.Mock;
    getLatestSuspension: jest.Mock;
    upsertPaymentAccount: jest.Mock;
  };
  let hasuraUser: { executeQuery: jest.Mock; getUser: jest.Mock };
  let paymentRouting: { resolveRailForUser: jest.Mock };
  let mobilePhones: { getBusinessPhoneVerificationStep: jest.Mock };
  let contracts: { getContractStatus: jest.Mock };

  beforeEach(() => {
    merchantLifecycle = {
      recompute: jest.fn().mockResolvedValue(null),
      getBusinessSnapshot: jest.fn().mockResolvedValue({
        lifecycle_status: 'created',
        is_storefront_visible: false,
        can_accept_orders: false,
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
      {} as any
    );
  });

  it('heals via MoMo payment capability upsert, never writing generated is_verified', async () => {
    const status = await service.getStatus();

    expect(merchantLifecycle.upsertPaymentAccount).toHaveBeenCalledWith({
      businessId: 'biz-1',
      provider: 'mobile_money',
      capabilityStatus: 'verified',
    });
    expect(status.is_verified).toBe(true);
    expect(status.nextAction).toBe('complete');
  });

  it('still returns verification status when MoMo heal fails', async () => {
    merchantLifecycle.upsertPaymentAccount.mockRejectedValue(
      new Error('column "is_verified" can only be updated to DEFAULT')
    );

    const status = await service.getStatus();

    expect(status.steps.identity.status).toBe('approved');
    expect(status.nextAction).toBe('complete');
  });
});
