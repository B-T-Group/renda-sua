import { RentalsCronService, endsWithinOnListingClock, wallClockHorizon } from './rentals-cron.service';
import { RentalsService } from './rentals.service';

/**
 * Booking start_at / end_at are the listing's wall clock stored as UTC components.
 * The cron queries widen by the largest UTC offset and every row is rechecked on
 * its own listing clock, so Toronto rows are not acted on 5 hours early and
 * Douala / Manila rows are not acted on hours late.
 */
const toronto = { business_location: { address: { country: 'Canada' } } };
const manila = { business_location: { address: { country: 'Philippines' } } };

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    status: 'active',
    start_at: '2026-11-26T12:00:00.000Z',
    end_at: '2026-11-26T16:00:00.000Z',
    actual_start_at: '2026-11-26T17:05:00.000Z',
    client: { user_id: 'client-user' },
    business: { user_id: 'biz-user' },
    rental_location_listing: { ...toronto, rental_item: { name: 'JBL PartyBox 310' } },
    ...overrides,
  };
}

function cronWith(row: any) {
  const cron: any = Object.create(RentalsCronService.prototype);
  cron.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  cron.logHistory = jest.fn();
  cron.patchBooking = jest.fn();
  cron.fetchBooking = jest.fn().mockResolvedValue(row);
  cron.notificationsService = {
    sendRentalPeriodEndedEmails: jest.fn(),
    sendRentalEndingSoonNotifications: jest.fn(),
    sendRentalBookingCancelledPush: jest.fn(),
  };
  cron.hasuraSystemService = {
    executeQuery: jest.fn().mockResolvedValue({ rental_bookings: [{ id: row.id }] }),
    executeMutation: jest.fn().mockResolvedValue({ update_rental_bookings: { affected_rows: 1 } }),
  };
  return cron;
}

describe('rental crons on the listing clock', () => {
  afterEach(() => jest.useRealTimers());

  it('widens the candidate query by 14 hours', () => {
    expect(wallClockHorizon(new Date('2026-11-26T16:00:00.000Z'))).toBe('2026-11-27T06:00:00.000Z');
  });

  it('moves a Toronto 16:00 rental to awaiting return at 4 PM Toronto, not 11 AM', async () => {
    const cron = cronWith(booking());
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T16:30:00.000Z'));
    await expect(cron.processEndedActiveBookings()).resolves.toBe(0);
    expect(cron.hasuraSystemService.executeQuery.mock.calls[0][1]).toEqual({ now: '2026-11-27T06:30:00.000Z' });
    expect(cron.notificationsService.sendRentalPeriodEndedEmails).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-11-26T21:00:00.000Z'));
    await expect(cron.processEndedActiveBookings()).resolves.toBe(1);
    expect(cron.notificationsService.sendRentalPeriodEndedEmails).toHaveBeenCalledTimes(1);
  });

  it('moves a Manila rental at the Manila end time', async () => {
    const cron = cronWith(booking({ end_at: '2026-11-26T18:00:00.000Z', rental_location_listing: manila }));
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T09:59:59.000Z'));
    await expect(cron.processEndedActiveBookings()).resolves.toBe(0);
    jest.setSystemTime(new Date('2026-11-26T10:00:00.000Z'));
    await expect(cron.processEndedActiveBookings()).resolves.toBe(1);
  });

  it('sends the ending-soon reminder 30 minutes before the Toronto end', async () => {
    const cron = cronWith(booking());
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T15:45:00.000Z'));
    await expect(cron.sendEndingSoonReminders()).resolves.toBe(0);
    jest.setSystemTime(new Date('2026-11-26T20:29:59.000Z'));
    await expect(cron.sendEndingSoonReminders()).resolves.toBe(0);
    jest.setSystemTime(new Date('2026-11-26T20:30:00.000Z'));
    await expect(cron.sendEndingSoonReminders()).resolves.toBe(1);
    expect(cron.notificationsService.sendRentalEndingSoonNotifications).toHaveBeenCalledTimes(1);
  });

  it('checks the ending-soon window on the listing clock', () => {
    const row = booking();
    expect(endsWithinOnListingClock(row, new Date('2026-11-26T20:29:59.000Z'), 30 * 60_000)).toBe(false);
    expect(endsWithinOnListingClock(row, new Date('2026-11-26T20:30:00.000Z'), 30 * 60_000)).toBe(true);
    expect(endsWithinOnListingClock(row, new Date('2026-11-26T21:00:00.000Z'), 30 * 60_000)).toBe(false);
  });

  it('sends the pickup-day reminder on the Toronto start day only', () => {
    const cron: any = Object.create(RentalsCronService.prototype);
    const row = booking({ status: 'confirmed', actual_start_at: null });
    expect(cron.bookingIsStartDay(row, new Date('2026-11-26T01:00:00.000Z'))).toBe(false);
    expect(cron.bookingIsStartDay(row, new Date('2026-11-26T05:00:00.000Z'))).toBe(true);
    expect(cron.bookingIsStartDay(row, new Date('2026-11-27T05:00:00.000Z'))).toBe(false);
  });

  it('passes the widened horizon to the no-show query and lets the service recheck', async () => {
    const cron = cronWith(booking({ status: 'confirmed', actual_start_at: null }));
    cron.rentalsService = { cancelNoShowBooking: jest.fn().mockResolvedValue(false) };
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T16:00:00.000Z'));
    await expect(cron.cancelNoShowBookings()).resolves.toBe(0);
    expect(cron.hasuraSystemService.executeQuery.mock.calls[0][1]).toEqual({ now: '2026-11-27T06:00:00.000Z' });
    expect(cron.rentalsService.cancelNoShowBooking).toHaveBeenCalledWith('b1');
  });

  it('releases an unpaid Toronto reservation only after Toronto midnight', async () => {
    const reserved = booking({ status: 'reserved', actual_start_at: null, inspection_policy_version: null });
    const cron = cronWith(reserved);
    const svc: any = Object.create(RentalsService.prototype);
    cron.rentalsService = svc;
    cron.notifyReservationExpired = jest.fn();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T00:00:00.000Z'));
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(0);
    expect(cron.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-11-27T05:00:00.000Z'));
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(1);
    expect(cron.notifyReservationExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps a reservation when the service is unavailable to recheck it', async () => {
    const cron = cronWith(booking({ status: 'reserved', actual_start_at: null }));
    cron.rentalsService = undefined;
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(0);
    expect(cron.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});

describe('no-show recheck in the service', () => {
  it('does not cancel a confirmed Toronto 12:00-16:00 booking at 11 AM Toronto', () => {
    const svc: any = Object.create(RentalsService.prototype);
    const row = booking({ status: 'confirmed', actual_start_at: null });
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T16:00:00.000Z'));
    expect(svc.bookingIsNoShow(row)).toBe(false);
    jest.setSystemTime(new Date('2026-11-26T20:59:59.000Z'));
    expect(svc.bookingIsNoShow(row)).toBe(false);
    jest.setSystemTime(new Date('2026-11-26T21:00:00.000Z'));
    expect(svc.bookingIsNoShow(row)).toBe(true);
    jest.useRealTimers();
  });

  it('rejects starting a Toronto rental the evening before, then allows it on the day', () => {
    const svc: any = Object.create(RentalsService.prototype);
    const row = booking({ status: 'confirmed', actual_start_at: null });
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T00:30:00.000Z'));
    expect(() => svc.assertBookingStartWindow(row)).toThrow();
    jest.setSystemTime(new Date('2026-11-26T05:00:00.000Z'));
    expect(() => svc.assertBookingStartWindow(row)).not.toThrow();
    jest.setSystemTime(new Date('2026-11-26T21:00:00.000Z'));
    expect(() => svc.assertBookingStartWindow(row)).toThrow();
    jest.useRealTimers();
  });
});
