import { HttpException } from '@nestjs/common';
import { RentalsService } from '../rentals.service';

const svc: any = Object.create(RentalsService.prototype);

function businessUser() {
  return { id: 'biz-user', active_persona: 'business', business: { id: 'biz' } };
}

describe('enrolled rental gates', () => {
  beforeEach(() => {
    svc.logger = { warn: jest.fn(), error: jest.fn() };
    svc.logHistory = jest.fn();
    svc.casBooking = jest.fn();
    svc.fetchBooking = jest.fn();
    svc.hasuraUserService = { getUser: jest.fn().mockResolvedValue(businessUser()) };
    svc.hasuraSystemService = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    svc.settleWalletHeldBooking = jest.fn();
    svc.settleStripeAuthorizedBooking = jest.fn();
    svc.runCompletion = jest.fn();
    svc.patchBooking = jest.fn();
    svc.pushOvertimeCharge = jest.fn();
    svc.finalizeRentalOvertimeAfterPayment = jest.fn();
    svc.settleEnrolledRental = RentalsService.prototype.settleEnrolledRental;
  });

  it('refuses confirm-return for an enrolled booking and does not settle', async () => {
    svc.fetchBooking.mockResolvedValue({ id: 'b1', business_id: 'biz', status: 'active' });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: { inspection_policy_version: 1 },
    });
    await expect(svc.confirmRentalReturn('b1')).rejects.toMatchObject({
      status: 426,
    });
    expect(svc.casBooking).not.toHaveBeenCalled();
    expect(svc.runCompletion).not.toHaveBeenCalled();
  });

  it('still settles a legacy return when inspection policy is null', async () => {
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'active',
      payment_status: 'paid',
      actual_end_at: '2026-07-17T12:00:00.000Z',
      end_at: '2026-07-17T12:00:00.000Z',
      total_amount: 160,
      security_deposit_amount: 0,
      units_booked: 1,
      rental_pricing_snapshot: { ratePerHour: 40, lines: [] },
    });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: { inspection_policy_version: null },
    });
    svc.casBooking.mockResolvedValue(false);
    const result = await svc.confirmRentalReturn('b1');
    expect(result.alreadyCompleted).toBe(true);
    expect(svc.settleWalletHeldBooking).not.toHaveBeenCalled();
  });

  it('does not start an enrolled booking until the current pickup report is accepted', async () => {
    const pin = '1234';
    svc.deliveryPinService = {
      hashPin: () => 'hash',
      verifyPin: () => true,
    };
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'confirmed',
      rental_start_pin_hash: 'hash',
      rental_start_pin_attempts: 0,
    });
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('RefundRentalPinAttempt') || query.includes('rental_start_pin_attempts')) {
        return { update_rental_bookings: { affected_rows: 1, returning: [{ rental_start_pin_attempts: 1 }] } };
      }
      if (query.includes('rental_mark_started')) return { rental_mark_started: [] };
      return {};
    });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        pickup_ack_current: false,
        pickup_accepted_version_id: null,
        pickup_current_version_id: 'v1',
      },
    });
    svc.verifyPinAttempt = jest.fn().mockResolvedValue(undefined);
    const error = await svc.verifyRentalStartPin('b1', { pin }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(426);
    expect(svc.casBooking).not.toHaveBeenCalled();
    expect(svc.verifyPinAttempt).not.toHaveBeenCalled();
  });

  it('refunds the PIN attempt when a new report replaces acceptance before start commits', async () => {
    svc.deliveryPinService = { hashPin: () => 'hash', verifyPin: () => true };
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'confirmed',
      rental_start_pin_hash: 'hash',
      rental_start_pin_attempts: 1,
    });
    svc.verifyPinAttempt = jest.fn().mockResolvedValue(undefined);
    svc.hasuraSystemService.executeQuery
      .mockResolvedValueOnce({
        rental_bookings_by_pk: {
          inspection_policy_version: 1,
          pickup_ack_current: true,
          pickup_accepted_version_id: 'v1',
          pickup_current_version_id: 'v1',
        },
      })
      .mockResolvedValueOnce({
        rental_bookings_by_pk: { inspection_policy_version: 1 },
      })
      .mockResolvedValueOnce({
        rental_bookings_by_pk: {
          inspection_policy_version: 1,
          pickup_ack_current: false,
          pickup_accepted_version_id: null,
          pickup_current_version_id: 'v2',
        },
      });
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('rental_mark_started')) return { rental_mark_started: [] };
      return { update_rental_bookings: { affected_rows: 1 } };
    });
    await expect(svc.verifyRentalStartPin('b1', { pin: '1234' })).rejects.toMatchObject({
      status: 426,
    });
    expect(svc.casBooking).not.toHaveBeenCalled();
    const refund = svc.hasuraSystemService.executeMutation.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .find((query: string) => query.includes('RefundRentalPinAttempt'));
    expect(refund).toBeTruthy();
  });

  it('collects pickup payment only after the client accepted the report', async () => {
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'reserved',
      client: { user_id: 'c' },
      currency: 'XAF',
      total_amount: 100,
    });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        pickup_ack_current: false,
      },
    });
    svc.hasuraSystemService.getAccount = jest.fn();
    await expect(svc.initiateRentalPickupPayment('b1')).rejects.toMatchObject({
      status: 426,
    });
    expect(svc.hasuraSystemService.getAccount).not.toHaveBeenCalled();
  });

  it('sends an enrolled overtime callback to the inspection settlement, not the legacy one', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue({
      id: 'b1',
      status: 'awaiting_return',
      overtime_amount: 40,
    });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: { inspection_policy_version: 1 },
    });
    svc.settleEnrolledRental = jest.fn();
    await svc.processRentalBookingPayment({ entity_id: 'RB1' });
    expect(svc.settleEnrolledRental).toHaveBeenCalledWith('b1');
    expect(svc.finalizeRentalOvertimeAfterPayment).not.toHaveBeenCalled();
  });

  it('does not claim settlement while a dispute is open', async () => {
    svc.fetchBooking.mockResolvedValue({ id: 'b1', status: 'awaiting_return' });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        return_handed_back_at: '2026-07-17T12:00:00.000Z',
        return_resolution: 'disputed',
        settlement_claimed_at: null,
        settlement_completed_at: null,
      },
      rental_inspection_disputes: [{ id: 'd1' }],
    });
    await svc.settleEnrolledRental('b1');
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(svc.runCompletion).not.toHaveBeenCalled();
  });

  it('claims an accepted handback once and settles the wallet without a damage debit', async () => {
    const booking = {
      id: 'b1',
      status: 'awaiting_return',
      payment_status: 'paid',
      actual_end_at: '2026-07-17T12:00:00.000Z',
      end_at: '2026-07-17T12:00:00.000Z',
      total_amount: 160,
      security_deposit_amount: 0,
      units_booked: 1,
      currency: 'XAF',
      client: { user_id: 'c' },
      rental_pricing_snapshot: { ratePerHour: 40, lines: [] },
    };
    svc.fetchBooking.mockResolvedValue(booking);
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        return_handed_back_at: booking.actual_end_at,
        return_resolution: 'accepted',
        settlement_claimed_at: null,
        settlement_completed_at: null,
      },
      rental_inspection_disputes: [],
    });
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('rental_claim_inspection_settlement')) {
        return { rental_claim_inspection_settlement: [{ id: 'b1' }] };
      }
      return { update_rental_bookings: { affected_rows: 1 } };
    });
    svc.runCompletion.mockImplementation(async (_id: string, _from: string, _u: null, _t: string, settle: () => Promise<void>) => {
      await settle();
      return true;
    });
    await svc.settleEnrolledRental('b1');
    const claimed = svc.hasuraSystemService.executeMutation.mock.calls.some((call: unknown[]) =>
      String(call[0]).includes('rental_claim_inspection_settlement')
    );
    expect(claimed).toBe(true);
    expect(svc.settleWalletHeldBooking).toHaveBeenCalledWith(
      booking,
      expect.objectContaining({ overtimeAmount: 0, contract: 160 })
    );
    expect(svc.settleStripeAuthorizedBooking).not.toHaveBeenCalled();
  });

  it('takes Stripe damage only from the deposit left after overtime', async () => {
    const booking = {
      id: 'b1',
      status: 'awaiting_return',
      payment_status: 'authorized',
      authorized_amount: 260,
      actual_end_at: '2026-07-17T13:00:00.000Z',
      end_at: '2026-07-17T12:00:00.000Z',
      total_amount: 160,
      security_deposit_amount: 100,
      units_booked: 1,
      currency: 'CAD',
      client: { user_id: 'c' },
      rental_pricing_snapshot: { ratePerHour: 40, lines: [{ kind: 'hourly', ratePerHour: 40 }] },
    };
    svc.fetchBooking.mockResolvedValue(booking);
    svc.hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('DecidedInspectionDamage')) {
        return { rental_inspection_disputes: [{ decision: 'damage_upheld', damage_amount: 80 }] };
      }
      return {
        rental_bookings_by_pk: {
          inspection_policy_version: 1,
          return_handed_back_at: booking.actual_end_at,
          return_resolution: 'admin_cleared',
          settlement_claimed_at: '2026-07-17T14:05:00.000Z',
          settlement_completed_at: null,
        },
        rental_inspection_disputes: [],
      };
    });
    svc.runCompletion.mockImplementation(async (_id: string, _from: string, _u: null, _t: string, settle: () => Promise<void>) => {
      await settle();
      return true;
    });
    await svc.settleEnrolledRental('b1');
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('rental_claim_inspection_settlement'),
      expect.anything()
    );
    const priced = svc.settleStripeAuthorizedBooking.mock.calls[0][1];
    expect(priced.overtimeAmount).toBe(40);
    expect(priced.stripeCharge).toBe(260);
  });

  it('throws when a legacy overtime callback cannot read the inspection policy', async () => {
    svc.fetchBookingByBookingNumber = jest.fn().mockResolvedValue({
      id: 'b1',
      status: 'awaiting_return',
      overtime_amount: 40,
    });
    svc.hasuraSystemService.executeQuery.mockRejectedValue(new Error('column inspection_policy_version does not exist'));
    await expect(svc.processRentalBookingPayment({ entity_id: 'RB1' })).rejects.toMatchObject({
      status: 503,
    });
    expect(svc.finalizeRentalOvertimeAfterPayment).not.toHaveBeenCalled();
  });

  it('refuses confirm-return when the inspection policy cannot be read', async () => {
    svc.fetchBooking.mockResolvedValue({ id: 'b1', business_id: 'biz', status: 'active' });
    svc.hasuraSystemService.executeQuery.mockRejectedValue(new Error('column missing'));
    await expect(svc.confirmRentalReturn('b1')).rejects.toMatchObject({ status: 503 });
    expect(svc.casBooking).not.toHaveBeenCalled();
    expect(svc.runCompletion).not.toHaveBeenCalled();
  });

  it('refuses pickup payment when the inspection gate cannot be read', async () => {
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'reserved',
      client: { user_id: 'c' },
      currency: 'XAF',
      total_amount: 100,
    });
    svc.hasuraSystemService.executeQuery.mockRejectedValue(new Error('column missing'));
    svc.hasuraSystemService.getAccount = jest.fn();
    await expect(svc.initiateRentalPickupPayment('b1')).rejects.toMatchObject({ status: 503 });
    expect(svc.hasuraSystemService.getAccount).not.toHaveBeenCalled();
  });

  it('does not fall back to a legacy start when an enrolled booking cannot see the start function', async () => {
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'confirmed',
    });
    svc.verifyPinAttempt = jest.fn().mockResolvedValue(undefined);
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        pickup_ack_current: true,
        pickup_accepted_version_id: 'v1',
        pickup_current_version_id: 'v1',
      },
    });
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('rental_mark_started')) {
        throw new Error("field 'rental_mark_started' not found in type mutation_root");
      }
      return { update_rental_bookings: { affected_rows: 1 } };
    });
    await expect(svc.verifyRentalStartPin('b1', { pin: '1234' })).rejects.toMatchObject({
      status: 503,
    });
    expect(svc.casBooking).not.toHaveBeenCalled();
  });

  it('still uses the legacy start claim when the policy is null and the function is not installed', async () => {
    svc.fetchBooking.mockResolvedValue({
      id: 'b1',
      business_id: 'biz',
      status: 'confirmed',
    });
    svc.verifyPinAttempt = jest.fn().mockResolvedValue(undefined);
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: null,
        pickup_ack_current: false,
        pickup_accepted_version_id: null,
        pickup_current_version_id: null,
      },
    });
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('rental_mark_started')) {
        throw new Error("field 'rental_mark_started' not found in type mutation_root");
      }
      return { update_rental_bookings: { affected_rows: 1 } };
    });
    svc.casBooking.mockResolvedValue(true);
    await expect(svc.verifyRentalStartPin('b1', { pin: '1234' })).resolves.toEqual({ success: true });
    expect(svc.casBooking).toHaveBeenCalledWith('b1', ['confirmed'], expect.objectContaining({
      status: 'active',
    }));
  });

  it('does not send another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: 'b1',
      status: 'awaiting_return',
      payment_status: 'paid',
      booking_number: 'RB1',
      actual_end_at: '2026-07-17T14:00:00.000Z',
      end_at: '2026-07-17T12:00:00.000Z',
      total_amount: 160,
      security_deposit_amount: 0,
      units_booked: 1,
      currency: 'XAF',
      client: { user_id: 'c' },
      rental_pricing_snapshot: { ratePerHour: 40, lines: [{ kind: 'hourly', ratePerHour: 40 }] },
    };
    svc.fetchBooking.mockResolvedValue(booking);
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        inspection_policy_version: 1,
        return_handed_back_at: booking.actual_end_at,
        return_resolution: 'accepted',
        settlement_claimed_at: '2026-07-17T14:05:00.000Z',
        settlement_completed_at: null,
        settlement_attention: null,
        overtime_prompted_at: new Date().toISOString(),
      },
      rental_inspection_disputes: [],
    });
    svc.overtimeNeedsMobileMoney = jest.fn().mockResolvedValue(true);
    await svc.settleEnrolledRental('b1');
    expect(svc.pushOvertimeCharge).not.toHaveBeenCalled();
    expect(svc.runCompletion).not.toHaveBeenCalled();
  });

  it('flags an expired Stripe authorization instead of leaving capture to retry', async () => {
    const booking = {
      id: 'b1',
      status: 'awaiting_return',
      payment_status: 'authorized',
      authorized_amount: 200,
      actual_end_at: '2026-07-17T12:00:00.000Z',
      end_at: '2026-07-17T12:00:00.000Z',
      total_amount: 160,
      security_deposit_amount: 40,
      units_booked: 1,
      currency: 'CAD',
      client: { user_id: 'c' },
      rental_pricing_snapshot: { ratePerHour: 40, lines: [] },
    };
    svc.fetchBooking.mockResolvedValue(booking);
    svc.hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('DecidedInspectionDamage')) {
        return { rental_inspection_disputes: [{ decision: 'damage_upheld', damage_amount: 10 }] };
      }
      return {
        rental_bookings_by_pk: {
          inspection_policy_version: 1,
          return_handed_back_at: booking.actual_end_at,
          return_resolution: 'admin_cleared',
          settlement_claimed_at: '2026-07-17T15:00:00.000Z',
          settlement_completed_at: null,
          settlement_attention: null,
        },
        rental_inspection_disputes: [],
      };
    });
    svc.runCompletion.mockImplementation(async (_id: string, _from: string, _u: null, _t: string, settle: () => Promise<void>) => {
      await settle();
      return true;
    });
    svc.settleStripeAuthorizedBooking.mockRejectedValue(
      new Error('This PaymentIntent could not be captured because it has a status of canceled')
    );
    await expect(svc.settleEnrolledRental('b1')).resolves.toBeUndefined();
    const flagged = svc.hasuraSystemService.executeMutation.mock.calls.some((call: unknown[]) =>
      String(call[0]).includes('settlement_attention')
    );
    expect(flagged).toBe(true);
    expect(svc.logHistory).toHaveBeenCalled();
  });
});
