import {
  deriveFollowUpStatus,
  isPaymentCapabilityVerified,
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
  });

  it('treats signed + verified as active follow-up', () => {
    expect(deriveFollowUpStatus('contract_signed', true)).toBe('active');
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
  });
});
