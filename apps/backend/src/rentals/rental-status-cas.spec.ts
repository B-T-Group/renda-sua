import { HttpException, HttpStatus } from '@nestjs/common';
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
  it('releases a hold that appears when cancel is replayed after cancellation', async () => {
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
      .mockResolvedValueOnce({ status: 'cancelled', client: { user_id: 'client-user' } });
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.releaseHoldIfNeeded = jest.fn();
    await expect(svc.cancelRentalBooking('b1')).resolves.toEqual({
      success: true,
    });
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'cancelled' })
    );
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

describe('wallet confirm and hold', () => {
  beforeEach(() => {
    svc.logger = { error: jest.fn(), warn: jest.fn() };
    svc.logHistory = jest.fn();
    svc.ensureStartPinOnce = jest.fn();
    svc.confirmedBookingNeedsPin = jest.fn().mockResolvedValue(false);
    svc.deliveryPinService = { clearPinForOrder: jest.fn() };
    svc.notificationsService = {
      sendRentalBookingConfirmedPush: jest.fn(),
    };
    svc.hasuraSystemService = { executeMutation: jest.fn() };
    svc.releaseHoldIfNeeded = jest.fn();
    svc.placeHoldForBooking = jest.fn();
    svc.getHold = jest.fn().mockResolvedValue(null);
  });

  it('releases a hold and does not confirm when expiry wins', async () => {
    const proposed = booking({
      status: 'proposed',
      payment_status: 'pending',
      contract_expires_at: '2026-07-18T00:00:00.000Z',
    });
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.fetchBooking = jest.fn().mockResolvedValue(
      booking({ status: 'cancelled', payment_status: 'cancelled' })
    );
    await svc.confirmBookingAfterContractPayment(proposed, 'RB1');
    expect(svc.placeHoldForBooking).not.toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'cancelled' })
    );
  });

  it('returns a failed hold to proposed so the webhook can retry', async () => {
    const proposed = booking({
      status: 'proposed',
      payment_status: 'pending',
      contract_expires_at: '2026-07-18T00:00:00.000Z',
    });
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValue(booking({ status: 'confirmed', payment_status: 'pending' }));
    svc.placeHoldForBooking.mockRejectedValue(new Error('hold failed'));
    await expect(
      svc.confirmBookingAfterContractPayment(proposed, 'RB1')
    ).rejects.toThrow('hold failed');
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenLastCalledWith('b1', ['confirmed'], {
      status: 'proposed',
      payment_status: 'pending',
      contract_expires_at: '2026-07-18T00:00:00.000Z',
      rental_start_pin_hash: null,
      rental_start_pin_attempts: 0,
    });
    expect(svc.deliveryPinService.clearPinForOrder).toHaveBeenCalledWith('b1');
  });

  it('repairs a confirmed unpaid booking and reverts to reserved when the hold fails', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(
      booking({
        status: 'confirmed',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValue(booking({ status: 'confirmed', payment_status: 'pending' }));
    svc.placeHoldForBooking.mockRejectedValue(new Error('hold failed'));
    await expect(
      svc.processRentalBookingPayment({ entity_id: 'RB1' })
    ).rejects.toThrow('hold failed');
    expect(svc.casBooking).toHaveBeenCalledWith(
      'b1',
      ['confirmed'],
      expect.objectContaining({ status: 'reserved' })
    );
  });

  it('does not hold a payment retry that lost to expiry', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'c1' },
        email: 'a@b.c',
      }),
    };
    const proposed = booking({
      status: 'proposed',
      client_id: 'c1',
      payment_status: 'pending',
      contract_expires_at: '2099-01-01T00:00:00.000Z',
      booking_number: 'RB1',
      rental_request_id: 'req',
      rental_pricing_snapshot: {
        version: 1,
        currency: 'XAF',
        total: 160,
        computedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(proposed)
      .mockResolvedValueOnce(booking({ status: 'cancelled' }));
    svc.hasuraSystemService.getAccount = jest
      .fn()
      .mockResolvedValue({ id: 'acc', available_balance: 1000 });
    svc.paymentRoutingService = {
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    svc.casBooking = jest.fn().mockResolvedValue(false);
    await expect(svc.retryBookingPayment('b1')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(svc.placeHoldForBooking).not.toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
  });

  it('does not hold a pickup payment that lost the reserved claim', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'business-user',
        active_persona: 'business',
        business: { id: 'biz' },
      }),
    };
    svc.hasuraSystemService.getAccount = jest
      .fn()
      .mockResolvedValue({ id: 'acc', available_balance: 1000 });
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(
        booking({ status: 'reserved', payment_status: 'pending', actual_start_at: null })
      )
      .mockResolvedValueOnce(booking({ status: 'cancelled' }));
    svc.casBooking = jest.fn().mockResolvedValue(false);
    await expect(svc.initiateRentalPickupPayment('b1')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(svc.placeHoldForBooking).not.toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
  });

  it('reactivates a cancelled hold row instead of inserting another', async () => {
    svc.getHold = jest.fn().mockResolvedValue({
      id: 'h1',
      status: 'cancelled',
      client_hold_amount: 20,
    });
    const executeMutation = jest
      .fn()
      .mockResolvedValue({ update_rental_holds: { affected_rows: 1 } });
    svc.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        clients_by_pk: { user_id: 'client-user' },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acc' }),
      executeMutation,
    };
    svc.accountsService = {
      registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    };
    await Object.getPrototypeOf(svc).placeHoldForBooking.call(
      svc,
      'b1',
      'c1',
      20,
      'XAF'
    );
    expect(executeMutation.mock.calls[0][0]).toContain('status: { _eq: cancelled }');
    expect(executeMutation.mock.calls[0][0]).not.toContain('insert_rental_holds');
    const held = svc.accountsService.registerHoldIfNotExists.mock.calls[0][0];
    expect(held.amount).toBe(20);
    expect(held.referenceId).not.toBe('b1');
    expect(held.idempotencyKey).toBe(`rental:b1:hold:${held.referenceId}`);
    expect(executeMutation.mock.calls[0][1].attemptId).toBe(held.referenceId);
  });

  it('does not revert a confirmed booking when another confirm owns the hold row', async () => {
    svc.getHold = jest.fn().mockResolvedValue(null);
    svc.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        clients_by_pk: { user_id: 'client-user' },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acc' }),
      executeMutation: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'Uniqueness violation. duplicate key value violates unique constraint "rental_holds_unique_booking"'
          )
        ),
    };
    svc.accountsService = {
      registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    };
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.fetchBooking = jest.fn();
    svc.placeHoldForBooking = Object.getPrototypeOf(svc).placeHoldForBooking;
    await expect(
      svc.finishConfirmedWalletHold(
        booking({ status: 'confirmed', payment_status: 'pending' }),
        'proposed'
      )
    ).resolves.toBe(true);
    expect(svc.casBooking).toHaveBeenCalledWith('b1', ['confirmed', 'active'], {
      payment_status: 'paid',
    });
    expect(svc.releaseHoldIfNeeded).not.toHaveBeenCalled();
    expect(svc.fetchBooking).not.toHaveBeenCalled();
    const held = svc.accountsService.registerHoldIfNotExists.mock.calls[0][0];
    const released = svc.accountsService.registerReleaseIfNotExists.mock.calls[0][0];
    expect(released.referenceId).toBe(held.referenceId);
    expect(released.referenceId).not.toBe('b1');
    expect(released.idempotencyKey).toBe(
      `rental:b1:hold:${held.referenceId}:release`
    );
  });

  it('does not release the winner hold when marking paid fails after a lost insert', async () => {
    svc.getHold = jest.fn().mockResolvedValue(null);
    svc.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        clients_by_pk: { user_id: 'client-user' },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acc' }),
      executeMutation: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'Uniqueness violation. duplicate key value violates unique constraint "rental_holds_unique_booking"'
          )
        ),
    };
    svc.accountsService = {
      registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    };
    svc.casBooking = jest.fn().mockRejectedValue(new Error('paid stamp failed'));
    svc.fetchBooking = jest.fn();
    svc.releaseHoldIfNeeded = jest.fn();
    svc.placeHoldForBooking = Object.getPrototypeOf(svc).placeHoldForBooking;
    await expect(
      svc.finishConfirmedWalletHold(
        booking({ status: 'confirmed', payment_status: 'pending' }),
        'proposed'
      )
    ).rejects.toThrow('paid stamp failed');
    expect(svc.releaseHoldIfNeeded).not.toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenCalledTimes(1);
    expect(svc.fetchBooking).not.toHaveBeenCalled();
    expect(svc.accountsService.registerReleaseIfNotExists).toHaveBeenCalledTimes(1);
  });

  it('releases the ledger hold when the hold row cannot be saved', async () => {
    svc.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        clients_by_pk: { user_id: 'client-user' },
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acc' }),
      executeMutation: jest.fn().mockRejectedValue(new Error('insert failed')),
    };
    svc.accountsService = {
      registerHoldIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    };
    await expect(
      Object.getPrototypeOf(svc).placeHoldForBooking.call(svc, 'b1', 'c1', 20, 'XAF')
    ).rejects.toThrow('insert failed');
    const held = svc.accountsService.registerHoldIfNotExists.mock.calls[0][0];
    expect(svc.accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: held.referenceId,
        amount: 20,
        idempotencyKey: `rental:b1:hold:${held.referenceId}:release`,
      })
    );
  });

  it('returns 409 when cancel wins after confirm and before the hold is kept', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'business-user',
        active_persona: 'business',
        business: { id: 'biz' },
      }),
    };
    svc.hasuraSystemService.getAccount = jest
      .fn()
      .mockResolvedValue({ id: 'acc', available_balance: 1000 });
    const reserved = booking({
      status: 'reserved',
      payment_status: 'pending',
      actual_start_at: null,
      rental_request_id: 'req',
    });
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(reserved)
      .mockResolvedValue(booking({ status: 'confirmed', payment_status: 'pending' }));
    svc.casBooking = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    svc.placeHoldForBooking = jest.fn().mockResolvedValue('own');
    const error = await svc.initiateRentalPickupPayment('b1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect(svc.placeHoldForBooking).toHaveBeenCalledWith('b1', 'c1', 160, 'XAF');
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalledWith('b1', reserved);
    expect(svc.casBooking).toHaveBeenCalledWith('b1', ['confirmed', 'active'], {
      payment_status: 'paid',
    });
    expect(svc.casBooking).not.toHaveBeenCalledWith(
      'b1',
      ['confirmed'],
      expect.objectContaining({ status: 'reserved' })
    );
  });

  it('returns 409 when a wallet retry loses the booking before the hold is kept', async () => {
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'c1' },
        email: 'a@b.c',
      }),
    };
    const proposed = booking({
      status: 'proposed',
      client_id: 'c1',
      payment_status: 'pending',
      contract_expires_at: '2099-01-01T00:00:00.000Z',
      booking_number: 'RB1',
      rental_request_id: 'req',
      rental_pricing_snapshot: {
        version: 1,
        currency: 'XAF',
        total: 160,
        computedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValueOnce(proposed)
      .mockResolvedValue(booking({ status: 'confirmed', payment_status: 'pending' }));
    svc.hasuraSystemService.getAccount = jest
      .fn()
      .mockResolvedValue({ id: 'acc', available_balance: 1000 });
    svc.paymentRoutingService = {
      resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
    };
    svc.casBooking = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    svc.placeHoldForBooking = jest.fn().mockResolvedValue('own');
    const error = await svc.retryBookingPayment('b1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect(svc.placeHoldForBooking).toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
  });

  it('releases a MoMo hold when cancel wins before the booking is marked paid', async () => {
    const proposed = booking({
      status: 'proposed',
      payment_status: 'pending',
      contract_expires_at: '2026-07-18T00:00:00.000Z',
      rental_request_id: 'req',
    });
    svc.casBooking = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValue(booking({ status: 'confirmed', payment_status: 'pending' }));
    svc.placeHoldForBooking = jest.fn().mockResolvedValue('own');
    await svc.confirmBookingAfterContractPayment(proposed, 'RB1');
    expect(svc.placeHoldForBooking).toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenLastCalledWith('b1', ['confirmed', 'active'], {
      payment_status: 'paid',
    });
  });

  it('does not mark a repaired confirmed booking paid after cancel wins', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(
      booking({
        status: 'confirmed',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.placeHoldForBooking = jest.fn().mockResolvedValue('own');
    await svc.processRentalBookingPayment({ entity_id: 'RB1' });
    expect(svc.placeHoldForBooking).toHaveBeenCalled();
    expect(svc.releaseHoldIfNeeded).toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenCalledWith('b1', ['confirmed', 'active'], {
      payment_status: 'paid',
    });
  });

  it('voids a card authorization when the booking is already cancelled', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(
      booking({
        status: 'proposed',
        payment_status: 'pending',
        booking_number: 'RB1',
        rental_request_id: 'req',
        client: { user_id: 'client-user' },
      })
    );
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValue(booking({ status: 'cancelled', booking_number: 'RB1' }));
    svc.cancelStripeAuthorizationIfAny = jest.fn();
    svc.patchBooking = jest.fn();
    await svc.processRentalBookingAuthorization({ entity_id: 'RB1', amount: 50 });
    expect(svc.patchBooking).not.toHaveBeenCalled();
    expect(svc.placeHoldForBooking).not.toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenCalledWith(
      'b1',
      ['proposed'],
      expect.objectContaining({
        payment_status: 'authorized',
        authorized_amount: 50,
        payment_timing: 'pay_now',
      })
    );
    expect(svc.cancelStripeAuthorizationIfAny).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', booking_number: 'RB1' })
    );
  });

  it('voids the card when confirm loses after the authorization stamp', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(
      booking({
        status: 'proposed',
        payment_status: 'pending',
        booking_number: 'RB1',
        rental_request_id: 'req',
        client: { user_id: 'client-user' },
      })
    );
    svc.casBooking = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    svc.fetchBooking = jest
      .fn()
      .mockResolvedValue(booking({ status: 'cancelled', booking_number: 'RB1' }));
    svc.cancelStripeAuthorizationIfAny = jest.fn();
    await svc.processRentalBookingAuthorization({ entity_id: 'RB1', amount: 50 });
    expect(svc.cancelStripeAuthorizationIfAny).toHaveBeenCalled();
    expect(svc.casBooking).toHaveBeenCalledWith(
      'b1',
      ['proposed'],
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  it('keeps a card authorization that confirms', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(
      booking({
        status: 'proposed',
        payment_status: 'pending',
        booking_number: 'RB1',
        rental_request_id: 'req',
        client: { user_id: 'client-user' },
      })
    );
    svc.casBooking = jest.fn().mockResolvedValue(true);
    svc.fetchBooking = jest.fn().mockResolvedValue(booking({ status: 'confirmed' }));
    svc.cancelStripeAuthorizationIfAny = jest.fn();
    await svc.processRentalBookingAuthorization({ entity_id: 'RB1', amount: 50 });
    expect(svc.cancelStripeAuthorizationIfAny).not.toHaveBeenCalled();
  });
});
