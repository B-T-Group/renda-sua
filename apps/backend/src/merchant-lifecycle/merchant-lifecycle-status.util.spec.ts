import {
  aggregatePaymentCapability,
  aggregatePaymentCapabilityForProvider,
  deriveLifecycleStatus,
  deriveStorefrontVisibility,
  mapCapabilityStatusToDb,
} from './merchant-lifecycle-status.util';

describe('mapCapabilityStatusToDb', () => {
  it('maps every capability status to its DB enum value', () => {
    expect(mapCapabilityStatusToDb('VERIFIED')).toBe('verified');
    expect(mapCapabilityStatusToDb('VERIFICATION_PENDING')).toBe(
      'verification_pending'
    );
    expect(mapCapabilityStatusToDb('REJECTED')).toBe('rejected');
    expect(mapCapabilityStatusToDb('IN_PROGRESS')).toBe('in_progress');
    expect(mapCapabilityStatusToDb('NOT_STARTED')).toBe('not_started');
  });
});

describe('deriveLifecycleStatus', () => {
  it('returns created when the contract is not signed', () => {
    expect(deriveLifecycleStatus(false, 'NOT_STARTED')).toBe('created');
    expect(deriveLifecycleStatus(false, 'VERIFIED')).toBe('created');
  });

  it('returns contract_signed until payment capability is verified', () => {
    expect(deriveLifecycleStatus(true, 'NOT_STARTED')).toBe('contract_signed');
    expect(deriveLifecycleStatus(true, 'IN_PROGRESS')).toBe('contract_signed');
    expect(deriveLifecycleStatus(true, 'VERIFICATION_PENDING')).toBe(
      'contract_signed'
    );
    expect(deriveLifecycleStatus(true, 'REJECTED')).toBe('contract_signed');
  });

  it('returns active when payment is verified', () => {
    expect(deriveLifecycleStatus(true, 'VERIFIED')).toBe('active');
  });
});

describe('deriveStorefrontVisibility', () => {
  it('hides created and suspended merchants', () => {
    expect(deriveStorefrontVisibility('created')).toBe(false);
    expect(deriveStorefrontVisibility('suspended')).toBe(false);
  });

  it('shows merchants once the agreement is signed', () => {
    expect(deriveStorefrontVisibility('contract_signed')).toBe(true);
    expect(deriveStorefrontVisibility('active')).toBe(true);
  });
});

describe('aggregatePaymentCapability', () => {
  it('prefers verified over other statuses', () => {
    expect(
      aggregatePaymentCapability(['in_progress', 'verified', 'rejected'])
    ).toBe('VERIFIED');
  });

  it('returns NOT_STARTED when no accounts', () => {
    expect(aggregatePaymentCapability([])).toBe('NOT_STARTED');
  });
});

describe('aggregatePaymentCapabilityForProvider', () => {
  it('ignores verified accounts for other providers', () => {
    expect(
      aggregatePaymentCapabilityForProvider(
        [
          { provider: 'mobile_money', capability_status: 'verified' },
          { provider: 'stripe', capability_status: 'in_progress' },
        ],
        'stripe'
      )
    ).toBe('IN_PROGRESS');
  });

  it('uses verified status for the required provider', () => {
    expect(
      aggregatePaymentCapabilityForProvider(
        [
          { provider: 'mobile_money', capability_status: 'verified' },
          { provider: 'stripe', capability_status: 'verified' },
        ],
        'stripe'
      )
    ).toBe('VERIFIED');
  });
});
