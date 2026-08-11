jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../business-contracts/business-contracts.service', () => ({
  BusinessContractsService: class BusinessContractsService {},
}));
jest.mock('../stripe-payments/payment-routing.service', () => ({
  PaymentRoutingService: class PaymentRoutingService {},
}));
jest.mock('../launch-promo/launch-promo.service', () => ({
  LaunchPromoService: class LaunchPromoService {},
}));

import { MerchantLifecycleService } from './merchant-lifecycle.service';

describe('MerchantLifecycleService storefront visibility persist', () => {
  const baseBiz = {
    id: 'biz-1',
    name: 'Acme Store',
    lifecycle_status: 'created' as const,
    can_accept_orders: false,
    is_storefront_visible: false,
    is_verified: false,
    merchant_agreement_version: null,
    merchant_agreement_accepted_at: null,
    user: {
      id: 'user-1',
      email: 'merchant@example.com',
      first_name: 'A',
      last_name: 'B',
    },
  };

  function createService(rail: 'stripe' | 'mobile_money' = 'stripe') {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const notifications = {
      sendMerchantActivatedEmail: jest.fn().mockResolvedValue(undefined),
      sendMerchantPaymentVerificationFailedEmail: jest
        .fn()
        .mockResolvedValue(undefined),
      sendMerchantPaymentReviewPendingEmail: jest
        .fn()
        .mockResolvedValue(undefined),
      sendAdminMerchantReviewPendingEmail: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const paymentRouting = {
      resolveRailForUser: jest.fn().mockResolvedValue(rail),
      resolveRailForBusiness: jest.fn().mockResolvedValue(rail),
    };
    const contracts = {
      hasValidSignedContract: jest.fn().mockResolvedValue(true),
    };
    const launchPromo = {
      confirmSlot: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MerchantLifecycleService(
      hasura as any,
      notifications as any,
      paymentRouting as any,
      contracts as any,
      launchPromo as any
    );
    return {
      service,
      hasura,
      notifications,
      paymentRouting,
      contracts,
      launchPromo,
    };
  }

  function mockLifecycleQueries(
    hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock },
    opts: {
      snapshot: typeof baseBiz;
      userId?: string | null;
      uploads?: Array<{ is_approved: boolean; note: string | null }>;
      paymentAccounts?: Array<{
        provider: string;
        capability_status: string;
      }>;
    }
  ) {
    let snapshot = { ...opts.snapshot };
    hasura.executeQuery.mockImplementation(async (query: string) => {
      const q = String(query);
      if (q.includes('BusinessLifecycle')) {
        return { businesses_by_pk: snapshot };
      }
      if (q.includes('BusinessUser')) {
        return {
          businesses_by_pk:
            opts.userId === null ? null : { user_id: opts.userId ?? 'user-1' },
        };
      }
      if (q.includes('MoMoIdCapability')) {
        return { user_uploads: opts.uploads ?? [] };
      }
      if (q.includes('PaymentAccounts')) {
        return { business_payment_accounts: opts.paymentAccounts ?? [] };
      }
      throw new Error(`Unexpected query: ${q.slice(0, 120)}`);
    });
    hasura.executeMutation.mockImplementation(
      async (mutation: string, vars: Record<string, unknown>) => {
        const m = String(mutation);
        if (m.includes('SetLifecycleAndVisibility')) {
          snapshot = {
            ...snapshot,
            lifecycle_status: vars.status as typeof snapshot.lifecycle_status,
            can_accept_orders: vars.status === 'active',
            is_storefront_visible: vars.visible === true,
            is_verified: vars.status === 'active',
          };
        }
        if (m.includes('SetStorefrontVisible')) {
          snapshot = {
            ...snapshot,
            is_storefront_visible: vars.visible === true,
          };
        }
        return {};
      }
    );
    return {
      getSnapshot: () => snapshot,
    };
  }

  function lifecycleAndVisibilityCalls(hasura: {
    executeMutation: jest.Mock;
  }) {
    return hasura.executeMutation.mock.calls.filter(([m]) =>
      String(m).includes('SetLifecycleAndVisibility')
    );
  }

  function storefrontOnlyCalls(hasura: { executeMutation: jest.Mock }) {
    return hasura.executeMutation.mock.calls.filter(([m]) =>
      String(m).includes('SetStorefrontVisible')
    );
  }

  it('persists Stripe catalog_ready with storefront visible in one mutation', async () => {
    const { service, hasura, paymentRouting, launchPromo } =
      createService('stripe');
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      paymentAccounts: [],
    });

    const result = await service.recompute('biz-1', 'agreement_signed');

    expect(paymentRouting.resolveRailForBusiness).toHaveBeenCalledWith(
      'biz-1'
    );
    expect(lifecycleAndVisibilityCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      status: 'catalog_ready',
      visible: true,
    });
    expect(storefrontOnlyCalls(hasura)).toHaveLength(0);
    expect(result?.lifecycle_status).toBe('catalog_ready');
    expect(result?.is_storefront_visible).toBe(true);
    expect(launchPromo.confirmSlot).not.toHaveBeenCalled();
  });

  it('keeps MoMo catalog_ready storefront hidden until active', async () => {
    const { service, hasura } = createService('mobile_money');
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      uploads: [],
    });

    const result = await service.recompute('biz-1', 'agreement_signed');

    expect(lifecycleAndVisibilityCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      status: 'catalog_ready',
      visible: false,
    });
    expect(result?.lifecycle_status).toBe('catalog_ready');
    expect(result?.is_storefront_visible).toBe(false);
  });

  it('shows MoMo storefront when activating and confirms launch promo slot', async () => {
    const { service, hasura, launchPromo, notifications } =
      createService('mobile_money');
    mockLifecycleQueries(hasura, {
      snapshot: {
        ...baseBiz,
        lifecycle_status: 'catalog_ready',
        is_storefront_visible: false,
      },
      uploads: [{ is_approved: true, note: null }],
    });

    const result = await service.recompute('biz-1', 'id_approved');

    expect(lifecycleAndVisibilityCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      status: 'active',
      visible: true,
    });
    expect(result?.lifecycle_status).toBe('active');
    expect(result?.is_storefront_visible).toBe(true);
    expect(launchPromo.confirmSlot).toHaveBeenCalledWith('biz-1');
    expect(notifications.sendMerchantActivatedEmail).toHaveBeenCalled();
  });

  it('syncs visibility only when lifecycle status is unchanged', async () => {
    const { service, hasura, launchPromo } = createService('stripe');
    mockLifecycleQueries(hasura, {
      snapshot: {
        ...baseBiz,
        lifecycle_status: 'catalog_ready',
        is_storefront_visible: false,
        can_accept_orders: false,
      },
      paymentAccounts: [],
    });

    const result = await service.recompute('biz-1', 'visibility_resync');

    expect(lifecycleAndVisibilityCalls(hasura)).toHaveLength(0);
    expect(storefrontOnlyCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      visible: true,
    });
    expect(result?.is_storefront_visible).toBe(true);
    expect(launchPromo.confirmSlot).not.toHaveBeenCalled();
    expect(
      hasura.executeMutation.mock.calls.some(([m]) =>
        String(m).includes('InsertLifecycleHistory')
      )
    ).toBe(false);
  });

  it('hides storefront for suspended merchants without rewriting status', async () => {
    const { service, hasura, launchPromo } = createService('stripe');
    mockLifecycleQueries(hasura, {
      snapshot: {
        ...baseBiz,
        lifecycle_status: 'suspended',
        can_accept_orders: false,
        is_storefront_visible: true,
      },
    });

    const result = await service.recompute('biz-1', 'system_recompute');

    expect(lifecycleAndVisibilityCalls(hasura)).toHaveLength(0);
    expect(storefrontOnlyCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      visible: false,
    });
    expect(result?.lifecycle_status).toBe('suspended');
    expect(result?.is_storefront_visible).toBe(false);
    expect(launchPromo.confirmSlot).not.toHaveBeenCalled();
  });

  it('reads is_storefront_visible from the DB row (not aliased from can_accept_orders)', async () => {
    const { service, hasura } = createService('stripe');
    hasura.executeQuery.mockResolvedValue({
      businesses_by_pk: {
        ...baseBiz,
        lifecycle_status: 'catalog_ready',
        can_accept_orders: false,
        is_storefront_visible: true,
      },
    });

    const snapshot = await service.getBusinessSnapshot('biz-1');

    expect(snapshot?.can_accept_orders).toBe(false);
    expect(snapshot?.is_storefront_visible).toBe(true);
  });
});
