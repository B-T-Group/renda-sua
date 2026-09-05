import {
  deriveFollowUpStatus,
  isPaymentCapabilityVerified,
  mapReferredBusinesses,
  mapReferredBusinessRow,
} from './referred-business-followup.util';

describe('referred-business-followup', () => {
  it('derives contract pending for created', () => {
    expect(deriveFollowUpStatus('created', false)).toBe('contract_pending');
  });

  it('derives payment setup pending when signed and not verified', () => {
    expect(deriveFollowUpStatus('contract_signed', false)).toBe(
      'payment_setup_pending'
    );
    expect(deriveFollowUpStatus('active', false)).toBe('payment_setup_pending');
  });

  it('treats signed/active + verified as active follow-up', () => {
    expect(deriveFollowUpStatus('contract_signed', true)).toBe('active');
    expect(deriveFollowUpStatus('active', true)).toBe('active');
  });

  it('detects verified payment accounts', () => {
    expect(
      isPaymentCapabilityVerified([
        { provider: 'mobile_money', capability_status: 'in_progress' },
        { provider: 'mobile_money', capability_status: 'verified' },
      ])
    ).toBe(true);
    expect(
      isPaymentCapabilityVerified([
        { provider: 'mobile_money', capability_status: 'rejected' },
      ])
    ).toBe(false);
  });

  it('treats any verified provider as setup complete', () => {
    expect(
      isPaymentCapabilityVerified([
        { provider: 'stripe', capability_status: 'verified' },
        { provider: 'mobile_money', capability_status: 'not_started' },
      ])
    ).toBe(true);
  });

  it('maps a GraphQL row', () => {
    const item = mapReferredBusinessRow({
      id: 'b1',
      name: ' Shop ',
      lifecycle_status: 'contract_signed',
      created_at: '2026-01-01T00:00:00Z',
      user: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+237600000000',
        email: 'ada@example.com',
      },
      items_approved: { aggregate: { count: 4 } },
      items_rejected: { aggregate: { count: 1 } },
      items_pending: { aggregate: { count: 2 } },
      payment_accounts: [
        { provider: 'mobile_money', capability_status: 'not_started' },
      ],
    });
    expect(item.businessName).toBe('Shop');
    expect(item.followUpStatus).toBe('payment_setup_pending');
    expect(item.itemsApproved).toBe(4);
    expect(item.itemsPending).toBe(2);
    expect(item.commission.status).toBe('window_expired');
  });

  it('marks agent commission paid when a credited onboarding event exists', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        lifecycle_status: 'active',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 12 } },
        representative_compensation_events: [
          {
            rule_code: 'onboarding_10_first_sale',
            amount: 7500,
            currency: 'XAF',
            status: 'credited',
            created_at: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
      'agent'
    );
    expect(item.commission.status).toBe('paid');
    expect(item.commission.paidAmount).toBe(7500);
    expect(item.commission.currency).toBe('XAF');
  });

  it('does not treat a pending compensation event as paid', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 12 } },
        representative_compensation_events: [
          {
            rule_code: 'onboarding_10_first_sale',
            amount: 7500,
            currency: 'XAF',
            status: 'pending',
            created_at: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
      'agent'
    );
    expect(item.commission.status).toBe('pending');
  });

  it('ignores agent legacy payouts for a B2B referrer', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_business_id: 'biz-ref',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 12 } },
        business_referral_payouts: [
          { amount: 7500, currency: 'XAF', created_at: '2026-08-15T00:00:00.000Z' },
        ],
      },
      'business'
    );
    expect(item.commission.status).toBe('pending');
    expect(item.commission.paidAmount).toBeNull();
  });

  it('treats a legacy referral payout as paid', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 10 } },
        business_referral_payouts: [
          { amount: 7500, currency: 'XAF', created_at: '2026-08-15T00:00:00.000Z' },
        ],
      },
      'agent'
    );
    expect(item.commission.status).toBe('paid');
    expect(item.commission.paidAmount).toBe(7500);
  });

  it('uses a configured min sales total when provided', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 10 } },
        completed_orders: [
          { subtotal: 3000, currency: 'XAF', completed_at: '2026-08-12T00:00:00.000Z' },
        ],
      },
      'agent',
      4000
    );
    expect(item.commission.requirements.minSalesTotal).toBe(4000);
    expect(item.commission.status).toBe('pending');
  });

  it('shows partial agent progress toward 10 items and 2500 XAF', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 6 } },
        completed_orders: [
          { subtotal: 1200, currency: 'XAF', completed_at: '2026-08-12T00:00:00.000Z' },
        ],
      },
      'agent'
    );
    expect(item.commission.status).toBe('pending');
    expect(item.commission.requirements.itemsApproved).toBe(6);
    expect(item.commission.requirements.minItems).toBe(10);
    expect(item.commission.requirements.salesTotal).toBe(1200);
    expect(item.commission.requirements.minSalesTotal).toBe(2500);
    expect(item.commission.requirements.requiresSale).toBe(true);
  });

  it('expires the agent bonus window after 30 days if unpaid', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-05-01T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 12 } },
        completed_orders: [
          { subtotal: 5000, currency: 'XAF', completed_at: '2026-05-10T00:00:00.000Z' },
        ],
      },
      'agent'
    );
    expect(item.commission.status).toBe('window_expired');
  });

  it('requires only 10 items for a B2B referrer', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-05-01T00:00:00.000Z',
        referred_by_business_id: 'biz-ref',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 6 } },
      },
      'business'
    );
    expect(item.commission.status).toBe('pending');
    expect(item.commission.requirements.requiresSale).toBe(false);
    expect(item.commission.requirements.minSalesTotal).toBe(0);
    expect(item.commission.requirements.windowEndsAt).toBeNull();
  });

  it('keeps a null created_at pending instead of expiring the window', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: null,
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        items_approved: { aggregate: { count: 12 } },
      },
      'agent'
    );
    expect(item.createdAt).toBe('');
    expect(item.commission.requirements.windowEndsAt).toBeNull();
    expect(item.commission.status).toBe('pending');
  });

  it('excludes foreign-currency and out-of-window sales from progress', () => {
    const item = mapReferredBusinessRow(
      {
        id: 'b1',
        name: 'Shop',
        created_at: '2026-08-10T00:00:00.000Z',
        referred_by_agent_id: 'agent-1',
        user: { country: 'CM' },
        completed_orders: [
          { subtotal: 1200, currency: 'XAF', completed_at: '2026-08-12T00:00:00.000Z' },
          { subtotal: 800, currency: 'CAD', completed_at: '2026-08-12T00:00:00.000Z' },
          { subtotal: 4000, currency: 'XAF', completed_at: '2026-10-01T00:00:00.000Z' },
        ],
      },
      'agent'
    );
    expect(item.commission.requirements.salesTotal).toBe(1200);
  });

  it('reads min sale totals once per country and falls back when config is missing', async () => {
    const readMinSaleTotal = jest.fn(async (country: string) => {
      if (country === 'CM') return 4000;
      return null;
    });
    const items = await mapReferredBusinesses(
      [
        {
          id: 'cm-1',
          name: 'A',
          created_at: '2026-08-10T00:00:00.000Z',
          referred_by_agent_id: 'a1',
          user: { country: 'CM' },
        },
        {
          id: 'cm-2',
          name: 'B',
          created_at: '2026-08-10T00:00:00.000Z',
          referred_by_agent_id: 'a1',
          user: { country: 'cm' },
        },
        {
          id: 'ca-1',
          name: 'C',
          created_at: '2026-08-10T00:00:00.000Z',
          referred_by_agent_id: 'a1',
          user: { country: 'CA' },
        },
        {
          id: 'xx',
          name: 'D',
          created_at: '2026-08-10T00:00:00.000Z',
          referred_by_agent_id: 'a1',
          user: {},
        },
      ],
      'agent',
      readMinSaleTotal
    );

    expect(readMinSaleTotal).toHaveBeenCalledTimes(2);
    expect(readMinSaleTotal).toHaveBeenCalledWith('CM');
    expect(readMinSaleTotal).toHaveBeenCalledWith('CA');
    expect(items.map((row) => row.commission.requirements.minSalesTotal)).toEqual([
      4000, 4000, 0, 2500,
    ]);
  });

  it('honors a configured zero min sale total', async () => {
    const items = await mapReferredBusinesses(
      [
        {
          id: 'cm-1',
          created_at: '2026-08-10T00:00:00.000Z',
          referred_by_agent_id: 'a1',
          user: { country: 'CM' },
        },
      ],
      'agent',
      async () => 0
    );
    expect(items[0].commission.requirements.minSalesTotal).toBe(0);
  });
});
