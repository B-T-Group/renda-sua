import { MerchantLifecycleService } from './merchant-lifecycle.service';

describe('MerchantLifecycleService MoMo activation', () => {
  const baseBiz = {
    id: 'biz-1',
    name: 'Acme MoMo',
    lifecycle_status: 'created',
    can_accept_orders: false,
    is_verified: false,
    user: { id: 'user-1', email: 'merchant@example.com' },
  };

  function createService() {
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
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    const contracts = {
      hasValidSignedContract: jest.fn().mockResolvedValue(true),
    };
    const service = new MerchantLifecycleService(
      hasura as any,
      notifications as any,
      paymentRouting as any,
      contracts as any
    );
    return { service, hasura, notifications, paymentRouting, contracts };
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
        rejection_reason?: string | null;
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
      throw new Error(`Unexpected query: ${q.slice(0, 100)}`);
    });
    hasura.executeMutation.mockImplementation(async (mutation: string, vars) => {
      if (String(mutation).includes('SetLifecycle')) {
        snapshot = {
          ...snapshot,
          lifecycle_status: vars.status,
          can_accept_orders: vars.status === 'active',
          is_verified: vars.status === 'active',
        };
      }
      return {};
    });
  }

  function setLifecycleCalls(hasura: { executeMutation: jest.Mock }) {
    return hasura.executeMutation.mock.calls.filter(([m]) =>
      String(m).includes('SetLifecycle')
    );
  }

  it('activates MoMo merchants with signed agreement + approved ID (no payment accounts)', async () => {
    const { service, hasura, notifications, contracts } = createService();
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      uploads: [
        { is_approved: false, note: '[REJECTED] blurry' },
        { is_approved: true, note: null },
      ],
      paymentAccounts: [],
    });

    const result = await service.recompute('biz-1', 'id_document_change');

    expect(contracts.hasValidSignedContract).toHaveBeenCalledWith('biz-1');
    expect(result?.lifecycle_status).toBe('active');
    expect(setLifecycleCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      status: 'active',
    });
    expect(
      hasura.executeQuery.mock.calls.some(([q]) =>
        String(q).includes('PaymentAccounts')
      )
    ).toBe(false);
    expect(
      hasura.executeQuery.mock.calls.some(([q]) =>
        String(q).includes('CatalogInventory')
      )
    ).toBe(false);
    expect(notifications.sendMerchantActivatedEmail).toHaveBeenCalledWith({
      to: 'merchant@example.com',
      businessName: 'Acme MoMo',
    });
  });

  it('stays created when agreement is missing even with approved ID', async () => {
    const { service, hasura, contracts } = createService();
    contracts.hasValidSignedContract.mockResolvedValue(false);
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      uploads: [{ is_approved: true, note: null }],
    });

    const result = await service.recompute('biz-1');

    expect(result?.lifecycle_status).toBe('created');
    expect(setLifecycleCalls(hasura)).toHaveLength(0);
  });

  it('moves to catalog_ready when agreement exists but no ID uploaded', async () => {
    const { service, hasura } = createService();
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      uploads: [],
    });

    const result = await service.recompute('biz-1');

    expect(result?.lifecycle_status).toBe('catalog_ready');
    expect(setLifecycleCalls(hasura)[0]?.[1]).toEqual({
      id: 'biz-1',
      status: 'catalog_ready',
    });
  });

  it('maps pending ID review to payment_verification_pending', async () => {
    const { service, hasura } = createService();
    mockLifecycleQueries(hasura, {
      snapshot: { ...baseBiz, lifecycle_status: 'catalog_ready' },
      uploads: [{ is_approved: false, note: null }],
    });

    const result = await service.recompute('biz-1');

    expect(result?.lifecycle_status).toBe('payment_verification_pending');
  });

  it('maps rejected ID notes to payment_verification_pending', async () => {
    const { service, hasura } = createService();
    mockLifecycleQueries(hasura, {
      snapshot: { ...baseBiz, lifecycle_status: 'catalog_ready' },
      uploads: [{ is_approved: false, note: '[REJECTED] name mismatch' }],
    });

    const result = await service.recompute('biz-1');

    expect(result?.lifecycle_status).toBe('payment_verification_pending');
  });

  it('uses Stripe payment accounts instead of ID uploads for Stripe rail', async () => {
    const { service, hasura, paymentRouting } = createService();
    paymentRouting.resolveRailForUser.mockResolvedValue('stripe');
    mockLifecycleQueries(hasura, {
      snapshot: baseBiz,
      uploads: [{ is_approved: true, note: null }],
      paymentAccounts: [
        { provider: 'stripe', capability_status: 'verified' },
      ],
    });

    const result = await service.recompute('biz-1');

    expect(result?.lifecycle_status).toBe('active');
    expect(
      hasura.executeQuery.mock.calls.some(([q]) =>
        String(q).includes('MoMoIdCapability')
      )
    ).toBe(false);
    expect(
      hasura.executeQuery.mock.calls.some(([q]) =>
        String(q).includes('PaymentAccounts')
      )
    ).toBe(true);
  });

  it('aliases is_storefront_visible from can_accept_orders on snapshots', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockResolvedValue({
      businesses_by_pk: {
        ...baseBiz,
        lifecycle_status: 'active',
        can_accept_orders: true,
      },
    });

    const snap = await service.getBusinessSnapshot('biz-1');

    expect(snap?.is_storefront_visible).toBe(true);
  });
});
