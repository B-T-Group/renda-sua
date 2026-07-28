import { WithdrawalPinService } from './withdrawal-pin.service';

describe('WithdrawalPinService', () => {
  const service = new WithdrawalPinService();
  const businessId = 'business-1';
  const pin = '482913';

  it('hashes the PIN with a business-scoped salt', () => {
    const hash = service.hashPin(businessId, pin);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(service.hashPin(businessId, pin));
    expect(hash).not.toBe(service.hashPin('business-2', pin));
    expect(hash).not.toBe(service.hashPin(businessId, '000000'));
  });

  it('verifies a correct PIN against the stored hash', () => {
    const hash = service.hashPin(businessId, pin);
    expect(service.verifyPin(businessId, pin, hash)).toBe(true);
  });

  it('rejects wrong PINs, empty values, and other business salts', () => {
    const hash = service.hashPin(businessId, pin);
    expect(service.verifyPin(businessId, '000000', hash)).toBe(false);
    expect(service.verifyPin(businessId, '', hash)).toBe(false);
    expect(service.verifyPin(businessId, pin, '')).toBe(false);
    expect(service.verifyPin('business-2', pin, hash)).toBe(false);
  });
});
