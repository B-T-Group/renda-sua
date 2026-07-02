import { ConfigService } from '@nestjs/config';
import { PinCryptoService } from './pin-crypto.service';

describe('PinCryptoService', () => {
  const config = {
    get: (key: string) => (key === 'jwt.secret' ? 'test-secret-key-for-pin-crypto' : undefined),
  } as unknown as ConfigService;

  let service: PinCryptoService;

  beforeEach(() => {
    service = new PinCryptoService(config);
  });

  it('encrypts and decrypts a PIN round-trip', () => {
    const encrypted = service.encrypt('4821');
    expect(encrypted).not.toBe('4821');
    expect(service.decrypt(encrypted)).toBe('4821');
  });

  it('returns null for tampered ciphertext', () => {
    const encrypted = service.encrypt('1234');
    const tampered = encrypted.slice(0, -2) + 'xx';
    expect(service.decrypt(tampered)).toBeNull();
  });
});
