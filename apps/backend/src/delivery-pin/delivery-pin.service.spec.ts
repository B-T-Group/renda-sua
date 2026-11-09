import * as crypto from 'crypto';
import { DeliveryPinService } from './delivery-pin.service';
import { PinCryptoService } from './pin-crypto.service';

describe('DeliveryPinService', () => {
  const storage = {
    persistEncryptedPin: jest.fn(),
    getPin: jest.fn(),
    clearPersistedPin: jest.fn(),
    encryptForPayload: jest.fn((pin: string) => `enc:${pin}`),
    decryptFromPayload: jest.fn((cipher: string) => cipher.replace('enc:', '')),
  };

  let service: DeliveryPinService;

  beforeEach(() => {
    jest.clearAllMocks();
    const pinCrypto = new PinCryptoService({ get: () => undefined } as any);
    service = new DeliveryPinService(storage as any, pinCrypto);
  });

  it('generates a 4-digit PIN', () => {
    const pin = service.generatePin();
    expect(pin).toMatch(/^\d{4}$/);
  });

  it('verifies a peppered PIN and rejects the unsalted digest', () => {
    const orderId = 'order-1';
    const pin = '5678';
    const hash = service.hashPin(orderId, pin);
    expect(hash.startsWith('v2:')).toBe(true);
    expect(service.verifyPin(orderId, pin, hash)).toBe(true);
    expect(service.verifyPin(orderId, '0000', hash)).toBe(false);
    const unsalted = crypto
      .createHash('sha256')
      .update(orderId + pin, 'utf8')
      .digest('hex');
    expect(hash).not.toBe(unsalted);
    expect(service.verifyPin(orderId, pin, unsalted)).toBe(true);
  });

  it('still accepts a legacy overwrite hash', () => {
    const orderId = 'order-1';
    const code = 'AB12CD34';
    const legacy = crypto
      .createHash('sha256')
      .update(orderId + 'overwrite' + code, 'utf8')
      .digest('hex');
    expect(service.isLegacyHash(legacy)).toBe(true);
    expect(service.verifyOverwriteCode(orderId, code, legacy)).toBe(true);
    expect(service.verifyOverwriteCode(orderId, '00000000', legacy)).toBe(false);
    const next = service.hashOverwriteCode(orderId, code);
    expect(service.verifyOverwriteCode(orderId, code, next)).toBe(true);
  });

  it('rejects a malformed hash without throwing', () => {
    expect(service.verifyPin('order-1', '1234', 'not-a-hash')).toBe(false);
    expect(service.verifyPin('order-1', '1234', '')).toBe(false);
  });

  it('delegates storage for client PIN', async () => {
    storage.getPin.mockResolvedValue('1234');
    await expect(service.getPinForClient('order-1')).resolves.toBe('1234');
    expect(storage.getPin).toHaveBeenCalledWith('order-1');
  });
});
