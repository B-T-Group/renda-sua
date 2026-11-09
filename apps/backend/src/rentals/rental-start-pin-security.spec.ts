import { HttpException, HttpStatus } from '@nestjs/common';
import { DeliveryPinService } from '../delivery-pin/delivery-pin.service';
import { PinCryptoService } from '../delivery-pin/pin-crypto.service';
import {
  RENTAL_OVERWRITE_BUSINESS_FORBIDDEN,
  RentalsService,
} from './rentals.service';

function pinService(): DeliveryPinService {
  const pinCrypto = new PinCryptoService({ get: () => undefined } as any);
  return new DeliveryPinService({} as any, pinCrypto);
}

describe('rental start PIN security', () => {
  const hasura = { executeMutation: jest.fn(), executeQuery: jest.fn() };
  const svc = Object.create(RentalsService.prototype) as RentalsService;
  const pins = pinService();

  beforeEach(() => {
    jest.clearAllMocks();
    (svc as any).hasuraSystemService = hasura;
    (svc as any).deliveryPinService = pins;
    (svc as any).patchBooking = jest.fn().mockResolvedValue(undefined);
    (svc as any).logHistory = jest.fn().mockResolvedValue(undefined);
    (svc as any).fetchBooking = jest.fn();
  });

  it('rejects a correct PIN when the attempt claim loses', async () => {
    const pin = '1234';
    const hash = pins.hashPin('booking-1', pin);
    hasura.executeMutation.mockResolvedValue({
      update_rental_bookings: { affected_rows: 0, returning: [] },
    });
    await expect(
      (svc as any).verifyPinAttempt(
        'booking-1',
        { rental_start_pin_hash: hash, rental_start_pin_attempts: 0 },
        pin
      )
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect((svc as any).patchBooking).not.toHaveBeenCalled();
  });

  it('still accepts a legacy hash and rewrites it as a peppered hash', async () => {
    const crypto = await import('crypto');
    const pin = '4321';
    const legacy = crypto
      .createHash('sha256')
      .update('booking-1' + pin, 'utf8')
      .digest('hex');
    hasura.executeMutation.mockResolvedValue({
      update_rental_bookings: {
        affected_rows: 1,
        returning: [{ rental_start_pin_attempts: 3 }],
      },
    });
    await (svc as any).verifyPinAttempt(
      'booking-1',
      { rental_start_pin_hash: legacy, rental_start_pin_attempts: 2 },
      pin
    );
    expect((svc as any).patchBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        rental_start_pin_hash: expect.stringMatching(/^v2:/),
      })
    );
  });

  it('gives the attempt back when a correct PIN cannot start the rental', async () => {
    const pin = '1234';
    const hash = pins.hashPin('booking-1', pin);
    hasura.executeMutation.mockResolvedValue({
      update_rental_bookings: {
        affected_rows: 1,
        returning: [{ rental_start_pin_attempts: 3 }],
      },
    });
    (svc as any).hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'biz-user',
        active_persona: 'business',
        business: { id: 'biz' },
      }),
    };
    (svc as any).fetchBooking.mockResolvedValue({
      id: 'booking-1',
      business_id: 'biz',
      status: 'confirmed',
      rental_start_pin_hash: hash,
      rental_start_pin_attempts: 2,
    });
    (svc as any).casBooking = jest.fn().mockResolvedValue(false);
    (svc as any).logger = { error: jest.fn(), warn: jest.fn() };
    await expect(
      svc.verifyRentalStartPin('booking-1', { pin })
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    const refund = hasura.executeMutation.mock.calls
      .map((call) => String(call[0]))
      .find((query) => query.includes('RefundRentalPinAttempt'));
    expect(refund).toContain('rental_start_pin_attempts: { _gt: 0 }');
  });

  it('gives the attempt back when the status update throws', async () => {
    const pin = '1234';
    const hash = pins.hashPin('booking-1', pin);
    hasura.executeMutation.mockResolvedValue({
      update_rental_bookings: {
        affected_rows: 1,
        returning: [{ rental_start_pin_attempts: 3 }],
      },
    });
    (svc as any).hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'biz-user',
        active_persona: 'business',
        business: { id: 'biz' },
      }),
    };
    (svc as any).fetchBooking.mockResolvedValue({
      id: 'booking-1',
      business_id: 'biz',
      status: 'confirmed',
      rental_start_pin_hash: hash,
      rental_start_pin_attempts: 2,
    });
    (svc as any).casBooking = jest.fn().mockRejectedValue(new Error('db down'));
    (svc as any).logger = { error: jest.fn(), warn: jest.fn() };
    await expect(svc.verifyRentalStartPin('booking-1', { pin })).rejects.toThrow(
      'db down'
    );
    const refund = hasura.executeMutation.mock.calls
      .map((call) => String(call[0]))
      .find((query) => query.includes('RefundRentalPinAttempt'));
    expect(refund).toContain('rental_start_pin_attempts: { _gt: 0 }');
  });

  it('refuses a business-minted overwrite code', async () => {
    await expect(
      svc.generateStartOverwriteCode('booking-1')
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      message: RENTAL_OVERWRITE_BUSINESS_FORBIDDEN,
    });
    expect((svc as any).fetchBooking).not.toHaveBeenCalled();
  });

  it('lets support issue a code the business can apply', async () => {
    (svc as any).fetchBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });
    const issued = await svc.issueStartOverwriteCodeForSupport(
      'booking-1',
      'support-user'
    );
    expect(issued.overwriteCode).toMatch(/^[0-9A-F]{8}$/);
    const hash = (svc as any).patchBooking.mock.calls[0][1]
      .rental_start_overwrite_code_hash as string;
    expect(pins.verifyOverwriteCode('booking-1', issued.overwriteCode, hash)).toBe(
      true
    );
    expect((svc as any).logHistory).toHaveBeenCalledWith(
      'booking-1',
      'confirmed',
      'confirmed',
      'support-user',
      'system',
      'Support issued a rental start code'
    );
  });
});
