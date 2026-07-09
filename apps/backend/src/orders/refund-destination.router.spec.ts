import { RefundConfigService } from './refund-config.service';

describe('RefundConfigService destination routing', () => {
  const service = new RefundConfigService({
    get: () => ({ refundsV2Enabled: true }),
  } as never);

  it('routes credit_card to stripe', () => {
    expect(service.resolveDestination('credit_card')).toBe('stripe');
  });

  it('routes mobile_payment to wallet', () => {
    expect(service.resolveDestination('mobile_payment')).toBe('wallet');
  });

  it('routes wallet payment_source to wallet', () => {
    expect(service.resolveDestination('wallet')).toBe('wallet');
  });

  it('respects force destination override', () => {
    expect(service.resolveDestination('credit_card', 'wallet')).toBe('wallet');
  });
});
