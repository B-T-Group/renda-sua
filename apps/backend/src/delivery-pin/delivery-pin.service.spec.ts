import { DeliveryPinService } from './delivery-pin.service';

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
    service = new DeliveryPinService(storage as any);
  });

  it('generates a 4-digit PIN', () => {
    const pin = service.generatePin();
    expect(pin).toMatch(/^\d{4}$/);
  });

  it('verifies PIN against hash', () => {
    const orderId = 'order-1';
    const pin = '5678';
    const hash = service.hashPin(orderId, pin);
    expect(service.verifyPin(orderId, pin, hash)).toBe(true);
    expect(service.verifyPin(orderId, '0000', hash)).toBe(false);
  });

  it('delegates storage for client PIN', async () => {
    storage.getPin.mockResolvedValue('1234');
    await expect(service.getPinForClient('order-1')).resolves.toBe('1234');
    expect(storage.getPin).toHaveBeenCalledWith('order-1');
  });
});
