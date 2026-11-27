import { HttpException } from '@nestjs/common';
import { RentalsService } from '../rentals.service';

const svc = Object.create(RentalsService.prototype) as any;

function booking(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'b1',
    client_id: 'client',
    business_id: 'biz',
    status: 'confirmed',
    payment_status: 'authorized',
    payment_timing: 'pay_at_pickup',
    actual_start_at: null,
    start_at: new Date(now).toISOString(),
    end_at: new Date(now + 2 * 24 * 3600000).toISOString(),
    total_amount: 45000,
    currency: 'XAF',
    booking_number: 'RB-1',
    inspection_policy_version: null,
    client: { user_id: 'client-user', user: { first_name: 'Amina' } },
    business: { user_id: 'biz-user' },
    rental_location_listing: {
      rental_item: { name: 'Drill' },
      business_location: { address: { country: 'Cameroon' } },
    },
    ...overrides,
  };
}

describe('renter start without a PIN', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    svc.logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
    svc.logHistory = jest.fn();
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'client' },
      }),
    };
    svc.fetchBooking = jest.fn().mockResolvedValue(booking());
    svc.readInspectionStart = jest.fn().mockResolvedValue({ inspectionPolicyVersion: null });
    svc.readInspectionPolicy = jest.fn().mockResolvedValue(null);
    svc.hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({ rental_mark_started: [{ id: 'b1' }] }),
      getAccount: jest.fn(),
    };
    svc.notificationsService = {
      sendBusinessRentalStarted: jest.fn(),
      sendRentalStartedClientPush: jest.fn(),
      sendRentalNoShowNotice: jest.fn(),
    };
    svc.inspectionFlags = { confirmationsEnabled: jest.fn().mockResolvedValue(false) };
    svc.confirmWalletContract = jest.fn();
    svc.pushMomoPickupPayment = jest.fn();
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.releaseFreeCancelFunds = jest.fn();
    svc.deliveryPinService = { clearPinForOrder: jest.fn() };
    svc.mobilePaymentsDatabaseService = {
      hasSuccessfulRentalBookingPayment: jest.fn().mockResolvedValue(false),
    };
  });

  it('starts a confirmed card booking from before this change without another charge', async () => {
    const result = await svc.startRental('b1');
    expect(result).toMatchObject({ started: true, payment_rail: 'card', paymentPending: false });
    expect(result.start_opens_at).toEqual(expect.any(String));
    expect(svc.confirmWalletContract).not.toHaveBeenCalled();
    expect(svc.pushMomoPickupPayment).not.toHaveBeenCalled();
    expect(svc.notificationsService.sendBusinessRentalStarted).toHaveBeenCalledTimes(1);
    expect(svc.notificationsService.sendRentalStartedClientPush).not.toHaveBeenCalled();
  });

  it('refuses a start before the pickup day', async () => {
    const now = Date.now();
    svc.fetchBooking.mockResolvedValue(booking({
      start_at: new Date(now + 2 * 24 * 3600000).toISOString(),
      end_at: new Date(now + 4 * 24 * 3600000).toISOString(),
    }));
    await expect(svc.startRental('b1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_START_WINDOW' },
    });
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('sends Mobile Money and does not say the rental started until it is paid', async () => {
    svc.fetchBooking.mockResolvedValue(booking({ status: 'reserved', payment_status: 'pending' }));
    svc.hasuraSystemService.getAccount.mockResolvedValue({ id: 'acc', available_balance: 0 });
    const result = await svc.startRental('b1');
    expect(result).toMatchObject({ started: false, paymentPending: true, payment_rail: 'mobile_money' });
    expect(svc.pushMomoPickupPayment).toHaveBeenCalledTimes(1);
    expect(svc.notificationsService.sendBusinessRentalStarted).not.toHaveBeenCalled();
  });

  it('starts a legacy booking after Mobile Money lands', async () => {
    const reserved = booking({ status: 'reserved', payment_status: 'pending' });
    svc.fetchBooking.mockResolvedValue(booking({ status: 'confirmed', payment_status: 'paid' }));
    await svc.startEnrolledAfterPickupPayment(reserved);
    expect(svc.hasuraSystemService.executeMutation).toHaveBeenCalled();
    expect(svc.notificationsService.sendBusinessRentalStarted).toHaveBeenCalledTimes(1);
  });

  it('cancels a no-show and returns collected Mobile Money to the wallet', async () => {
    svc.fetchBooking.mockResolvedValue(booking({
      status: 'confirmed',
      payment_status: 'paid',
      end_at: new Date(Date.now() - 60_000).toISOString(),
    }));
    svc.mobilePaymentsDatabaseService.hasSuccessfulRentalBookingPayment.mockResolvedValue(true);
    await expect(svc.cancelNoShowBooking('b1')).resolves.toBe(true);
    expect(svc.releaseFreeCancelFunds).toHaveBeenCalled();
    expect(svc.notificationsService.sendRentalNoShowNotice).toHaveBeenCalled();
    expect(svc.logger.log).toHaveBeenCalledWith(expect.stringContaining('renter wallet'));
  });

  it('does not cancel an unpaid reservation before the end of the start day', () => {
    // Pinned: start_at is the listing wall clock, so Date.now() broke this between midnight in Douala and UTC.
    const now = new Date('2026-11-26T12:00:00.000Z'); // 13:00 in Douala
    expect(svc.unpaidReservationDue(booking({ start_at: '2026-11-26T09:00:00.000Z' }), now)).toBe(false);
    expect(svc.unpaidReservationDue(booking({ start_at: '2026-11-26T09:00:00.000Z' }), new Date('2026-11-26T23:30:00.000Z'))).toBe(true);
  });
});

describe('start window error shape', () => {
  it('uses the pickup-day sentence before the day opens', async () => {
    const now = Date.now();
    svc.logger = { warn: jest.fn() };
    svc.fetchBooking = jest.fn().mockResolvedValue(booking({
      start_at: new Date(now + 3 * 24 * 3600000).toISOString(),
      end_at: new Date(now + 5 * 24 * 3600000).toISOString(),
    }));
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'client' },
      }),
    };
    try {
      await svc.startRental('b1');
      throw new Error('expected 409');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        message: 'You can start this rental from the pickup day.',
      });
    }
  });
});
