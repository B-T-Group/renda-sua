import { HttpException } from '@nestjs/common';
import { RentalsCronService } from './rentals-cron.service';
import { casUpdateRentalBooking } from './rental-booking-cas';
import { RentalsService } from './rentals.service';

const svc: any = Object.create(RentalsService.prototype);

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    status: 'active',
    business_id: 'biz',
    client_id: 'c1',
    payment_status: 'paid',
    actual_end_at: '2026-07-17T12:00:00.000Z',
    actual_start_at: '2026-07-17T08:00:00.000Z',
    total_amount: 160,
    security_deposit_amount: 0,
    units_booked: 1,
    currency: 'XAF',
    end_at: '2026-07-17T12:00:00.000Z',
    client: { user_id: 'client-user' },
    rental_pricing_snapshot: {
      total: 160,
      currency: 'XAF',
      ratePerHour: 40,
      lines: [
        {
          kind: 'hourly',
          startAt: '2026-07-17T08:00:00.000Z',
          endAt: '2026-07-17T12:00:00.000Z',
          billableHours: 4,
          ratePerHour: 40,
          subtotal: 160,
        },
      ],
    },
    ...overrides,
  };
}

describe('casUpdateRentalBooking', () => {
  it('wins only when one row matches the expected status', async () => {
    const hasura = {
      executeMutation: jest
        .fn()
        .mockResolvedValueOnce({ update_rental_bookings: { affected_rows: 1 } })
        .mockResolvedValueOnce({ update_rental_bookings: { affected_rows: 0 } }),
    };
    await expect(
      casUpdateRentalBooking(hasura, 'b1', ['active'], { status: 'completed' })
    ).resolves.toBe(true);
    await expect(
      casUpdateRentalBooking(hasura, 'b1', ['active'], { status: 'completed' })
    ).resolves.toBe(false);
  });
});

describe('rental completion compare-and-set', () => {
  beforeEach(() => {
    svc.logHistory = jest.fn();
    svc.deliveryPinService = { clearPinForOrder: jest.fn() };
    svc.registerRentalProceedsLedger = jest.fn();
    svc.settleBooking = jest.fn();
    svc.getHold = jest.fn();
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'business-user',
        active_persona: 'business',
        business: { id: 'biz' },
      }),
    };
  });

  it('skips overtime settlement when another caller already completed', async () => {
    svc.casBooking = jest.fn().mockResolvedValue(false);
    await svc.finalizeRentalOvertimeAfterPayment({
      id: 'b1',
      overtime_amount: 40,
    });
    expect(svc.registerRentalProceedsLedger).not.toHaveBeenCalled();
    expect(svc.settleBooking).not.toHaveBeenCalled();
  });

  it('puts the booking back when overtime settlement throws', async () => {
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.registerRentalProceedsLedger.mockRejectedValue(new Error('ledger down'));
    await expect(
      svc.finalizeRentalOvertimeAfterPayment({ id: 'b1', overtime_amount: 40 })
    ).rejects.toThrow('ledger down');
    expect(svc.casBooking).toHaveBeenLastCalledWith('b1', ['completed'], {
      status: 'awaiting_return',
    });
    expect(svc.logHistory).not.toHaveBeenCalled();
  });

  it('does not settle a return when the completion claim loses', async () => {
    svc.fetchBooking = jest.fn().mockResolvedValue(booking());
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.settleWalletHeldBooking = jest.fn();
    const result = await svc.confirmRentalReturn('b1');
    expect(result.alreadyCompleted).toBe(true);
    expect(svc.settleWalletHeldBooking).not.toHaveBeenCalled();
  });

  it('settles a return only after the completion claim wins', async () => {
    svc.fetchBooking = jest.fn().mockResolvedValue(booking());
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.settleWalletHeldBooking = jest.fn().mockResolvedValue(true);
    const result = await svc.confirmRentalReturn('b1');
    expect(result).toEqual({ success: true, overtimeAmount: 0 });
    expect(svc.casBooking).toHaveBeenCalledWith('b1', ['active'], {
      status: 'completed',
    });
    expect(svc.settleWalletHeldBooking).toHaveBeenCalledTimes(1);
    expect(svc.logHistory).toHaveBeenCalled();
  });
});

describe('rental cancel compare-and-set', () => {
  it('does not release the hold when the booking is already cancelled', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'c1' },
      }),
    };
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(
        booking({ status: 'confirmed', actual_start_at: null })
      )
      .mockResolvedValueOnce({ status: 'cancelled' });
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.releaseHoldIfNeeded = jest.fn();
    await expect(svc.cancelRentalBooking('b1')).resolves.toEqual({
      success: true,
    });
    expect(svc.releaseHoldIfNeeded).not.toHaveBeenCalled();
  });

  it('rejects a cancel that lost to a different status', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'c1' },
      }),
    };
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(
        booking({ status: 'confirmed', actual_start_at: null })
      )
      .mockResolvedValueOnce({ status: 'active' });
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.releaseHoldIfNeeded = jest.fn();
    await expect(svc.cancelRentalBooking('b1')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(svc.releaseHoldIfNeeded).not.toHaveBeenCalled();
  });
});

describe('rental cron compare-and-set', () => {
  const cron: any = Object.create(RentalsCronService.prototype);

  beforeEach(() => {
    cron.logHistory = jest.fn();
    cron.notificationsService = {
      sendRentalPeriodEndedEmails: jest.fn(),
    };
    cron.logger = { warn: jest.fn() };
  });

  it('does not notify when the period-end claim loses', async () => {
    cron.fetchBooking = jest.fn().mockResolvedValue(booking());
    cron.hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        update_rental_bookings: { affected_rows: 0 },
      }),
    };
    await cron.transitionActiveToAwaitingReturn('b1', '2026-07-17T12:00:00.000Z');
    expect(cron.logHistory).not.toHaveBeenCalled();
    expect(
      cron.notificationsService.sendRentalPeriodEndedEmails
    ).not.toHaveBeenCalled();
  });

  it('does not cancel a reservation that already left reserved', async () => {
    cron.fetchBooking = jest.fn().mockResolvedValue(
      booking({ status: 'reserved', actual_start_at: null })
    );
    cron.hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        update_rental_bookings: { affected_rows: 0 },
      }),
    };
    cron.notifyReservationExpired = jest.fn();
    await cron.expireOneReservedBooking('b1');
    expect(cron.logHistory).not.toHaveBeenCalled();
    expect(cron.notifyReservationExpired).not.toHaveBeenCalled();
  });
});
