import { HttpException } from '@nestjs/common';
import { RentalsService } from '../rentals.service';
import {
  acceptStartPaymentRail,
  didntReceiveWindowOpen,
} from './rental-inspection.policy';

describe('accept and start', () => {
  const svc: any = Object.create(RentalsService.prototype);

  const enrolled = (overrides: Record<string, unknown> = {}) => ({
    id: 'b1',
    status: 'confirmed',
    client_id: 'client',
    business_id: 'biz',
    client: { user_id: 'client-user' },
    business: { user_id: 'biz-user' },
    currency: 'XAF',
    total_amount: 760,
    payment_status: 'authorized',
    payment_timing: 'pay_now',
    inspection_policy_version: 1,
    rental_location_listing: { rental_item: { name: 'Canon EOS R50' } },
    rental_request_id: 'req',
    ...overrides,
  });

  const gate = (overrides: Record<string, unknown> = {}) => ({
    rental_bookings_by_pk: {
      inspection_policy_version: 1,
      pickup_ack_current: false,
      pickup_accepted_version_id: null,
      pickup_current_version_id: 'ver-1',
      ...overrides,
    },
  });

  beforeEach(() => {
    svc.logger = { warn: jest.fn(), log: jest.fn() };
    svc.logHistory = jest.fn().mockResolvedValue(undefined);
    svc.fetchBooking = jest.fn().mockResolvedValue(enrolled());
    svc.fetchBookingByBookingNumber = jest.fn();
    svc.casBooking = jest.fn().mockResolvedValue(false);
    svc.confirmWalletContract = jest.fn().mockResolvedValue(true);
    svc.pushMomoPickupPayment = jest.fn().mockResolvedValue({ paymentPending: true });
    svc.ensureStartPinOnce = jest.fn().mockResolvedValue(undefined);
    svc.verifyPinAttempt = jest.fn().mockResolvedValue(undefined);
    svc.deliveryPinService = { getPinForClient: jest.fn().mockResolvedValue('1234') };
    svc.notificationsService = {
      sendRentalInspectionNotice: jest.fn().mockResolvedValue(undefined),
      sendBusinessRentalStarted: jest.fn().mockResolvedValue(undefined),
      sendRentalStartedClientPush: jest.fn().mockResolvedValue(undefined),
    };
    svc.inspectionFlags = { confirmationsEnabled: jest.fn().mockResolvedValue(false) };
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'client' },
      }),
    };
    svc.mobilePaymentsDatabaseService = {
      hasSuccessfulRentalBookingPayment: jest.fn().mockResolvedValue(false),
      hasPendingRentalBookingPayment: jest.fn().mockResolvedValue(false),
    };
    svc.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue(gate()),
      executeMutation: jest.fn().mockImplementation(async (query: string) => {
        const text = String(query);
        if (text.includes('rental_accept_pickup_version')) {
          return { rental_accept_pickup_version: [{ id: 'b1' }] };
        }
        if (text.includes('rental_mark_started')) {
          return { rental_mark_started: [{ id: 'b1' }] };
        }
        return { update_rental_bookings: { affected_rows: 1 } };
      }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acc', available_balance: 0 }),
    };
  });

  function markCalls() {
    return svc.hasuraSystemService.executeMutation.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('rental_mark_started')
    );
  }

  function acceptCalls() {
    return svc.hasuraSystemService.executeMutation.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('rental_accept_pickup_version')
    );
  }

  it('starts a card booking at the accept tap without another charge', async () => {
    const result = await svc.acceptAndStartRental('b1', 'ver-1');
    expect(result).toMatchObject({
      started: true,
      alreadyStarted: false,
      paymentPending: false,
      payment_rail: 'card',
      amount_due_at_pickup: 0,
    });
    expect(acceptCalls()).toHaveLength(1);
    expect(markCalls()).toHaveLength(1);
    expect(markCalls()[0][1].at).toEqual(expect.any(String));
    expect(svc.confirmWalletContract).not.toHaveBeenCalled();
    expect(svc.pushMomoPickupPayment).not.toHaveBeenCalled();
    expect(svc.hasuraSystemService.getAccount).not.toHaveBeenCalled();
    expect(svc.notificationsService.sendBusinessRentalStarted).toHaveBeenCalledTimes(1);
    expect(svc.notificationsService.sendRentalInspectionNotice).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pickup_accepted' })
    );
  });

  it('charges the wallet and then starts', async () => {
    let paid = false;
    svc.confirmWalletContract.mockImplementation(async () => {
      paid = true;
      return true;
    });
    svc.fetchBooking.mockImplementation(async () =>
      enrolled({
        status: paid ? 'confirmed' : 'reserved',
        payment_status: paid ? 'paid' : 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.hasuraSystemService.getAccount.mockResolvedValue({
      id: 'acc',
      available_balance: 760,
    });
    const result = await svc.acceptAndStartRental('b1', 'ver-1');
    expect(result).toMatchObject({
      started: true,
      paymentPending: false,
      payment_rail: 'wallet',
      amount_due_at_pickup: 760,
    });
    expect(svc.confirmWalletContract).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: 'reserved' })
    );
    expect(markCalls()).toHaveLength(1);
    expect(svc.pushMomoPickupPayment).not.toHaveBeenCalled();
  });

  it('starts a Mobile Money booking only after the payment webhook succeeds', async () => {
    svc.fetchBookingByBookingNumber.mockResolvedValue(
      enrolled({
        status: 'reserved',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.fetchBooking.mockResolvedValue(
      enrolled({
        status: 'confirmed',
        payment_status: 'paid',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_ack_current: true, pickup_accepted_version_id: 'ver-1' })
    );
    await svc.processRentalBookingPayment({ entity_id: 'RB-1' });
    expect(svc.confirmWalletContract).toHaveBeenCalled();
    expect(markCalls()).toHaveLength(1);
    expect(markCalls()[0][1].at).toEqual(expect.any(String));
    expect(svc.notificationsService.sendBusinessRentalStarted).toHaveBeenCalledTimes(1);
  });

  it('keeps the accept when Mobile Money fails, then retries without accepting again', async () => {
    let accepted = false;
    svc.fetchBooking.mockResolvedValue(
      enrolled({
        status: 'reserved',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.hasuraSystemService.executeQuery.mockImplementation(async () =>
      gate({
        pickup_ack_current: accepted,
        pickup_accepted_version_id: accepted ? 'ver-1' : null,
      })
    );
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('rental_accept_pickup_version')) {
        accepted = true;
        return { rental_accept_pickup_version: [{ id: 'b1' }] };
      }
      return { rental_mark_started: [{ id: 'b1' }] };
    });
    svc.pushMomoPickupPayment
      .mockRejectedValueOnce(new HttpException('MoMo failed', 400))
      .mockResolvedValueOnce({ paymentPending: true });
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toBeInstanceOf(HttpException);
    expect(accepted).toBe(true);
    expect(markCalls()).toHaveLength(0);
    const retry = await svc.acceptAndStartRental('b1', 'ver-1');
    expect(retry).toMatchObject({
      started: false,
      paymentPending: true,
      payment_rail: 'mobile_money',
      amount_due_at_pickup: 760,
    });
    expect(acceptCalls()).toHaveLength(1);
    expect(markCalls()).toHaveLength(0);
    expect(svc.pushMomoPickupPayment).toHaveBeenCalledTimes(2);
    expect(svc.notificationsService.sendBusinessRentalStarted).not.toHaveBeenCalled();
    const notice = svc.notificationsService.sendRentalInspectionNotice.mock.calls[0][0];
    expect(notice.kind).toBe('pickup_accepted');
    expect(JSON.stringify(notice)).not.toMatch(/started|in progress|démarrée|en cours/i);
  });

  it('does not charge or accept again when the rental already started', async () => {
    svc.fetchBooking.mockResolvedValue(
      enrolled({ status: 'active', payment_status: 'paid', actual_start_at: '2026-11-12T14:20:00.000Z' })
    );
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_ack_current: true, pickup_accepted_version_id: 'ver-1' })
    );
    const result = await svc.acceptAndStartRental('b1', 'ver-1');
    expect(result).toMatchObject({ alreadyStarted: true, started: true, paymentPending: false });
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(svc.confirmWalletContract).not.toHaveBeenCalled();
    expect(svc.pushMomoPickupPayment).not.toHaveBeenCalled();
  });

  it('still starts a legacy booking from the PIN', async () => {
    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user',
      active_persona: 'business',
      business: { id: 'biz' },
    });
    svc.fetchBooking.mockResolvedValue({ id: 'b1', business_id: 'biz', status: 'confirmed' });
    svc.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: { inspection_policy_version: null },
    });
    await expect(svc.verifyRentalStartPin('b1', { pin: '1234' })).resolves.toEqual({
      success: true,
    });
    expect(svc.verifyPinAttempt).toHaveBeenCalled();
    expect(markCalls()).toHaveLength(1);
  });

  it('returns 426 on the old start, PIN, and pickup-payment paths for an enrolled booking', async () => {
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_ack_current: true, pickup_accepted_version_id: 'ver-1' })
    );
    await expect(svc.getStartPinForClient('b1')).rejects.toMatchObject({ status: 426 });
    expect(svc.deliveryPinService.getPinForClient).not.toHaveBeenCalled();

    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user',
      active_persona: 'business',
      business: { id: 'biz' },
    });
    await expect(svc.verifyRentalStartPin('b1', { pin: '1234' })).rejects.toMatchObject({
      status: 426,
    });
    expect(svc.verifyPinAttempt).not.toHaveBeenCalled();

    svc.fetchBooking.mockResolvedValue(
      enrolled({ status: 'reserved', payment_status: 'pending', payment_timing: 'pay_at_pickup' })
    );
    await expect(svc.initiateRentalPickupPayment('b1')).rejects.toMatchObject({ status: 426 });
    expect(svc.hasuraSystemService.getAccount).not.toHaveBeenCalled();
  });

  it('allows only the renter of an enrolled booking', async () => {
    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user',
      active_persona: 'business',
      business: { id: 'biz' },
    });
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toMatchObject({ status: 403 });

    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'other',
      active_persona: 'client',
      client: { id: 'other-client' },
    });
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toMatchObject({ status: 404 });

    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'client' },
    });
    svc.fetchBooking.mockResolvedValue(enrolled({ inspection_policy_version: null }));
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toMatchObject({
      status: 400,
      response: { code: 'RENTAL_ACCEPT_START_NOT_ENROLLED' },
    });
  });

  it('rejects a version that is no longer current', async () => {
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_current_version_id: 'ver-2' })
    );
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_ACCEPT_START_CONFLICT' },
    });
    expect(acceptCalls()).toHaveLength(0);
  });

  it('does not attach accept_start_preview for a business viewer', async () => {
    const row = enrolled({
      status: 'reserved',
      payment_status: 'pending',
      payment_timing: 'pay_at_pickup',
      client: { id: 'client', user_id: 'client-user' },
    });
    svc.hasuraUserService.executeQuery = jest.fn().mockResolvedValue({
      rental_bookings_by_pk: row,
    });
    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user',
      active_persona: 'business',
      business: { id: 'biz' },
    });
    const businessView = await svc.getBookingDetailForViewer('b1');
    expect(businessView.accept_start_preview).toBeUndefined();
    expect(svc.hasuraSystemService.getAccount).not.toHaveBeenCalled();

    svc.hasuraUserService.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'client' },
    });
    const renterView = await svc.getBookingDetailForViewer('b1');
    expect(renterView.accept_start_preview).toEqual({
      payment_rail: 'mobile_money',
      amount_due_at_pickup: 760,
    });
    expect(svc.hasuraSystemService.getAccount).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when the start race is lost', async () => {
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('rental_accept_pickup_version')) {
        return { rental_accept_pickup_version: [{ id: 'b1' }] };
      }
      return { rental_mark_started: [] };
    });
    await expect(svc.acceptAndStartRental('b1', 'ver-1')).rejects.toMatchObject({ status: 409 });
  });

  it('reports Mobile Money when replaying a booking paid by Mobile Money', async () => {
    svc.fetchBooking.mockResolvedValue(
      enrolled({
        status: 'active',
        payment_status: 'paid',
        payment_timing: 'pay_at_pickup',
        booking_number: 'RB-1',
        actual_start_at: '2026-11-12T14:20:00.000Z',
      })
    );
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_ack_current: true, pickup_accepted_version_id: 'ver-1' })
    );
    svc.mobilePaymentsDatabaseService.hasSuccessfulRentalBookingPayment.mockResolvedValue(true);
    const result = await svc.acceptAndStartRental('b1', 'ver-1');
    expect(result).toMatchObject({
      alreadyStarted: true,
      payment_rail: 'mobile_money',
      paymentPending: false,
    });
    expect(svc.pushMomoPickupPayment).not.toHaveBeenCalled();
  });

  it('sends one payment request when two accepts race', async () => {
    let accepted = false;
    let requests = 0;
    let pending = false;
    let releaseSecond: () => void = () => undefined;
    const secondMayLose = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let entered = 0;
    let releaseBoth: () => void = () => undefined;
    const bothInside = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    svc.fetchBooking.mockResolvedValue(
      enrolled({
        status: 'reserved',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
        booking_number: 'RB-1',
      })
    );
    svc.hasuraSystemService.executeQuery.mockImplementation(async () =>
      gate({
        pickup_ack_current: accepted,
        pickup_accepted_version_id: accepted ? 'ver-1' : null,
      })
    );
    svc.hasuraSystemService.executeMutation.mockImplementation(async (query: string) => {
      if (!String(query).includes('rental_accept_pickup_version')) {
        return { rental_mark_started: [{ id: 'b1' }] };
      }
      entered += 1;
      if (entered === 2) releaseBoth();
      await bothInside;
      if (!accepted) {
        accepted = true;
        return { rental_accept_pickup_version: [{ id: 'b1' }] };
      }
      await secondMayLose;
      throw new Error('Uniqueness violation');
    });
    svc.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment.mockImplementation(
      async () => pending
    );
    svc.fetchUserContact = jest.fn().mockResolvedValue({ phone_number: '+237600000000' });
    svc.initiateRentalBookingPayment = jest.fn(async () => {
      requests += 1;
      pending = true;
      releaseSecond();
    });
    svc.pushMomoPickupPayment = RentalsService.prototype.pushMomoPickupPayment.bind(svc);

    const [first, second] = await Promise.all([
      svc.acceptAndStartRental('b1', 'ver-1'),
      svc.acceptAndStartRental('b1', 'ver-1'),
    ]);

    expect(requests).toBe(1);
    for (const result of [first, second]) {
      expect(result.paymentPending || result.alreadyStarted).toBe(true);
      expect(result).not.toMatchObject({ success: false });
    }
    expect(first.paymentPending || second.paymentPending).toBe(true);
  });

  it('ignores a late webhook on a cancelled booking', async () => {
    svc.fetchBookingByBookingNumber.mockResolvedValue(enrolled({ status: 'cancelled' }));
    await svc.processRentalBookingPayment({ entity_id: 'RB-1' });
    expect(svc.confirmWalletContract).not.toHaveBeenCalled();
    expect(markCalls()).toHaveLength(0);
  });

  it('does not start when the webhook arrives before the report is accepted', async () => {
    svc.fetchBookingByBookingNumber.mockResolvedValue(
      enrolled({
        status: 'reserved',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.fetchBooking.mockResolvedValue(
      enrolled({
        status: 'confirmed',
        payment_status: 'paid',
        payment_timing: 'pay_at_pickup',
      })
    );
    svc.hasuraSystemService.executeQuery.mockResolvedValue(
      gate({ pickup_ack_current: false, pickup_accepted_version_id: null })
    );
    await svc.processRentalBookingPayment({ entity_id: 'RB-1' });
    expect(svc.confirmWalletContract).toHaveBeenCalled();
    expect(markCalls()).toHaveLength(0);
  });

  it('classifies the payment rail and the thirty-minute window', () => {
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: 'authorized', walletCovers: false })
    ).toBe('card');
    expect(
      acceptStartPaymentRail({ status: 'reserved', paymentStatus: 'pending', walletCovers: true })
    ).toBe('wallet');
    expect(
      acceptStartPaymentRail({ status: 'reserved', paymentStatus: 'pending', walletCovers: false })
    ).toBe('mobile_money');
    const start = new Date('2026-11-12T14:20:00.000Z');
    expect(didntReceiveWindowOpen(start.toISOString(), new Date(start.getTime() + 29 * 60000))).toBe(
      true
    );
    expect(didntReceiveWindowOpen(start.toISOString(), new Date(start.getTime() + 31 * 60000))).toBe(
      false
    );
  });

  it('does not treat an unpaid confirmed booking as already paid', () => {
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: 'paid', walletCovers: false })
    ).toBe('wallet');
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: 'authorized', walletCovers: true })
    ).toBe('card');
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: 'pending', walletCovers: true })
    ).toBeNull();
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: null, walletCovers: false })
    ).toBeNull();
    expect(
      acceptStartPaymentRail({ status: 'confirmed', paymentStatus: 'failed', walletCovers: true })
    ).toBeNull();
    expect(
      acceptStartPaymentRail({ status: 'active', paymentStatus: 'authorized', walletCovers: false })
    ).toBeNull();
    expect(
      acceptStartPaymentRail({ status: 'cancelled', paymentStatus: 'paid', walletCovers: true })
    ).toBeNull();
    expect(
      acceptStartPaymentRail({ status: 'reserved', paymentStatus: 'paid', walletCovers: false })
    ).toBe('mobile_money');
    expect(
      acceptStartPaymentRail({ status: 'reserved', paymentStatus: 'authorized', walletCovers: true })
    ).toBe('wallet');
  });

  it('keeps the missing-item window closed before the start and on a bad timestamp', () => {
    const start = new Date('2026-11-12T14:20:00.000Z');
    expect(didntReceiveWindowOpen(start.toISOString(), start)).toBe(true);
    expect(didntReceiveWindowOpen(start.toISOString(), new Date(start.getTime() + 30 * 60000))).toBe(
      true
    );
    expect(
      didntReceiveWindowOpen(start.toISOString(), new Date(start.getTime() + 30 * 60000 + 1))
    ).toBe(false);
    expect(didntReceiveWindowOpen(start.toISOString(), new Date(start.getTime() - 1))).toBe(false);
    expect(didntReceiveWindowOpen(null, start)).toBe(false);
    expect(didntReceiveWindowOpen(undefined, start)).toBe(false);
    expect(didntReceiveWindowOpen('', start)).toBe(false);
    expect(didntReceiveWindowOpen('not-a-date', start)).toBe(false);
  });
});
