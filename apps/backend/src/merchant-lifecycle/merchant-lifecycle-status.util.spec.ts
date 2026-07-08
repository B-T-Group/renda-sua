import {
  aggregatePaymentCapability,
  aggregatePaymentCapabilityForProvider,
  deriveLifecycleStatus,
} from './merchant-lifecycle-status.util';

describe('deriveLifecycleStatus', () => {
  it('returns created when catalog is not ready', () => {
    expect(deriveLifecycleStatus(false, 'NOT_STARTED')).toBe('created');
    expect(deriveLifecycleStatus(false, 'VERIFIED')).toBe('created');
  });

  it('returns catalog_ready when catalog ready and payment not started', () => {
    expect(deriveLifecycleStatus(true, 'NOT_STARTED')).toBe('catalog_ready');
  });

  it('returns payment_setup_pending when payment is in progress', () => {
    expect(deriveLifecycleStatus(true, 'IN_PROGRESS')).toBe(
      'payment_setup_pending'
    );
  });

  it('returns payment_verification_pending when verification pending or rejected', () => {
    expect(deriveLifecycleStatus(true, 'VERIFICATION_PENDING')).toBe(
      'payment_verification_pending'
    );
    expect(deriveLifecycleStatus(true, 'REJECTED')).toBe(
      'payment_verification_pending'
    );
  });

  it('returns active when payment is verified', () => {
    expect(deriveLifecycleStatus(true, 'VERIFIED')).toBe('active');
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
