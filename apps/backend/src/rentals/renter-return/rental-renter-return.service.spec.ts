import { HttpException } from '@nestjs/common';
import { RentalRenterReturnService } from './rental-renter-return.service';

const START = '2026-11-12T12:00:00.000Z';
const END = '2026-11-12T19:00:00.000Z';
const NOW = new Date('2026-11-12T18:00:00.000Z');
const REPORTED = '2026-11-12T18:42:00.000Z';

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    booking_number: 'RB-27251416',
    client_id: 'c1',
    status: 'active',
    actual_start_at: START,
    end_at: END,
    renter_reported_returned_at: null,
    renter_return_escalated_at: null,
    inspection_policy_version: null,
    business: { user_id: 'bu1' },
    rental_location_listing: {
      rental_item: { name: 'JBL PartyBox 310' },
      business_location: { address: { country: 'CM' } },
    },
    ...overrides,
  };
}

function setup(options: {
  user?: Record<string, unknown>;
  booking?: Record<string, unknown> | null;
  flag?: boolean | 'missing';
  stamp?: boolean;
  appearAfterStamp?: boolean;
  lostCompleted?: boolean;
  list?: Array<Record<string, unknown>> | null;
  place?: Record<string, unknown> | null;
  placeThrows?: boolean;
} = {}) {
  const user = options.user ?? { id: 'u1', active_persona: 'client', client: { id: 'c1' } };
  let row = options.booking === null ? null : booking(options.booking ?? {});
  const flags = options.flag === 'missing' ? {} : { rentals_renter_return_report_enabled: options.flag !== false };
  const executeQuery = jest.fn(async (query: string) => {
    if (query.includes('OpenReturnReports')) {
      return { rental_bookings: options.list === null ? null : options.list };
    }
    if (query.includes('ReturnPlace')) {
      if (options.placeThrows) throw new Error('hasura down');
      return { rental_bookings_by_pk: options.place ?? null };
    }
    return { rental_bookings_by_pk: row };
  });
  const executeMutation = jest.fn(async (query: string) => {
    if (query.includes('StampRenterReturn')) {
      if (options.stamp === false) {
        if (options.appearAfterStamp && row) {
          row = { ...row, renter_reported_returned_at: REPORTED };
        }
        if (options.lostCompleted && row) row = { ...row, status: 'completed' };
        return { update_rental_bookings: { returning: [] } };
      }
      if (row) row = { ...row, renter_reported_returned_at: NOW.toISOString() };
      return { update_rental_bookings: { returning: [{ id: 'b1' }] } };
    }
    return { update_rental_bookings: { returning: [] } };
  });
  const notifications = {
    sendBusinessRenterReturned: jest.fn(async () => undefined),
    notifySupportRenterReturnUnconfirmed: jest.fn(async () => undefined),
  };
  const rentals = { confirmLegacyReturnForSupport: jest.fn(async () => ({ success: true })) };
  const inspections = { recordHandbackAsAdmin: jest.fn(async () => ({ handedBack: true })) };
  const service = new RentalRenterReturnService(
    { getUser: async () => user } as never,
    { executeQuery, executeMutation } as never,
    notifications as never,
    { getClientFlags: async () => flags } as never,
    rentals as never,
    inspections as never
  );
  return { service, executeQuery, executeMutation, notifications, rentals, inspections };
}

describe('RentalRenterReturnService.report', () => {
  it('allows only the renter', async () => {
    const business = setup({ user: { id: 'u2', active_persona: 'business', client: null } });
    await expect(business.service.report('b1', NOW)).rejects.toMatchObject({ status: 403 });
    expect(business.executeQuery).not.toHaveBeenCalled();

    const other = setup({ user: { id: 'u3', active_persona: 'client', client: { id: 'other' } } });
    await expect(other.service.report('b1', NOW)).rejects.toMatchObject({ status: 404 });

    const missing = setup({ booking: null });
    await expect(missing.service.report('b1', NOW)).rejects.toMatchObject({ status: 404 });
  });

  it('does nothing when the flag is off', async () => {
    const { service, executeMutation, notifications } = setup({ flag: false });
    await expect(service.report('b1', NOW)).rejects.toMatchObject({
      status: 404,
      response: { code: 'RENTAL_RETURN_REPORT_DISABLED' },
    });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
  });

  it('rejects bookings that are not out with the renter', async () => {
    const reserved = setup({ booking: { status: 'reserved' } });
    await expect(reserved.service.report('b1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_REPORT_NOT_OUT' },
    });
    expect(reserved.executeMutation).not.toHaveBeenCalled();

    const cancelled = setup({ booking: { status: 'cancelled' } });
    await expect(cancelled.service.report('b1', NOW)).rejects.toMatchObject({
      response: { code: 'RENTAL_RETURN_REPORT_NOT_OUT' },
    });

    const confirmed = setup({ booking: { status: 'confirmed', actual_start_at: null } });
    await expect(confirmed.service.report('b1', NOW)).rejects.toMatchObject({
      response: { code: 'RENTAL_RETURN_REPORT_NOT_OUT' },
    });
  });

  it('rejects an active booking that has not started', async () => {
    const missingStart = setup({ booking: { actual_start_at: null } });
    await expect(missingStart.service.report('b1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_REPORT_NOT_STARTED' },
    });
    const future = setup({ booking: { actual_start_at: '2026-11-12T18:00:00.001Z' } });
    await expect(future.service.report('b1', NOW)).rejects.toMatchObject({
      response: { code: 'RENTAL_RETURN_REPORT_NOT_STARTED' },
    });
    expect(missingStart.executeMutation).not.toHaveBeenCalled();
  });

  it('records the timestamp once and does not change status or the deposit', async () => {
    const { service, executeMutation, notifications } = setup();
    const result = await service.report('b1', NOW);
    expect(result.alreadyReported).toBe(false);
    expect(result.report.rentalBookingId).toBe('b1');
    const mutation = String(executeMutation.mock.calls[0][0]);
    expect(mutation).toContain('renter_reported_returned_at: $at');
    expect(mutation).not.toContain('security_deposit');
    expect(mutation).not.toContain('captured_amount');
    expect(mutation).not.toContain('payment_status');
    expect(mutation).not.toMatch(/_set:\s*\{[^}]*status/);
    expect(executeMutation.mock.calls[0][1]).toEqual({ id: 'b1', at: NOW.toISOString() });
    expect(notifications.sendBusinessRenterReturned).toHaveBeenCalledWith({
      businessUserId: 'bu1',
      bookingId: 'b1',
      bookingNumber: 'RB-27251416',
      rentalItemName: 'JBL PartyBox 310',
    });
  });

  it('returns the existing report and does not notify again', async () => {
    const { service, executeMutation, notifications } = setup({
      booking: { renter_reported_returned_at: REPORTED, status: 'awaiting_return' },
    });
    const result = await service.report('b1', new Date('2026-11-14T00:00:00.000Z'));
    expect(result.alreadyReported).toBe(true);
    expect(result.report.reportedAt).toBe(REPORTED);
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
  });

  it('treats a lost stamp as the existing report', async () => {
    const raced = setup({ stamp: false, appearAfterStamp: true });
    await expect(raced.service.report('b1', NOW)).resolves.toMatchObject({ alreadyReported: true });
    expect(raced.notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
  });

  it('does not record a report after the business confirmed', async () => {
    const done = setup({ booking: { status: 'completed', renter_reported_returned_at: REPORTED } });
    await expect(done.service.report('b1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_ALREADY_CONFIRMED' },
    });
    expect(done.executeMutation).not.toHaveBeenCalled();
    expect(done.notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
  });

  it('rejects a client with no profile and an agent who also has a client row', async () => {
    const bare = setup({ user: { id: 'u1', active_persona: 'client', client: null } });
    await expect(bare.service.report('b1', NOW)).rejects.toMatchObject({ status: 403 });
    expect(bare.executeQuery).not.toHaveBeenCalled();
    const agent = setup({ user: { id: 'u4', active_persona: 'agent', client: { id: 'c1' } } });
    await expect(agent.service.report('b1', NOW)).rejects.toMatchObject({ status: 403 });
    expect(agent.executeQuery).not.toHaveBeenCalled();
  });

  it('stays closed when the flag key is missing', async () => {
    const { service, executeMutation } = setup({ flag: 'missing' });
    await expect(service.report('b1', NOW)).rejects.toMatchObject({
      status: 404,
      response: { code: 'RENTAL_RETURN_REPORT_DISABLED' },
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('accepts a start at this instant and rejects an unreadable start', async () => {
    const exact = setup({ booking: { actual_start_at: NOW.toISOString() } });
    await expect(exact.service.report('b1', NOW)).resolves.toMatchObject({ alreadyReported: false });
    const bad = setup({ booking: { status: 'awaiting_return', actual_start_at: 'not-a-date' } });
    await expect(bad.service.report('b1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_REPORT_NOT_STARTED' },
    });
    expect(bad.executeMutation).not.toHaveBeenCalled();
  });

  it('marks overdue only after the rental end', async () => {
    const onTime = setup({ booking: { end_at: NOW.toISOString() } });
    await expect(onTime.service.report('b1', NOW)).resolves.toMatchObject({ wasOverdue: false });
    const late = setup({ booking: { end_at: new Date(NOW.getTime() - 1).toISOString() } });
    await expect(late.service.report('b1', NOW)).resolves.toMatchObject({ wasOverdue: true });
  });

  it('asks the renter to retry when a lost stamp does not reappear', async () => {
    const gone = setup({ stamp: false });
    await expect(gone.service.report('b1', NOW)).rejects.toMatchObject({ status: 409, message: 'Try again' });
    expect(gone.notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
    const confirmed = setup({ stamp: false, lostCompleted: true });
    await expect(confirmed.service.report('b1', NOW)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_ALREADY_CONFIRMED' },
    });
    expect(confirmed.notifications.sendBusinessRenterReturned).not.toHaveBeenCalled();
  });

  it('still records the report when the business user or item name is missing', async () => {
    const { service, executeMutation, notifications } = setup({
      booking: {
        business: null,
        booking_number: null,
        rental_location_listing: {
          rental_item: { name: null },
          business_location: { address: { country: 'CM' } },
        },
      },
    });
    await service.report('b1', NOW);
    expect(executeMutation).toHaveBeenCalled();
    expect(notifications.sendBusinessRenterReturned).toHaveBeenCalledWith({
      businessUserId: '',
      bookingId: 'b1',
      bookingNumber: 'b1',
      rentalItemName: 'Rental',
    });
  });
});

describe('RentalRenterReturnService.escalateDue', () => {
  function escalation(blank = false) {
    let claimed = false;
    const executeMutation = jest.fn(async (_query: string, vars: { cutoff: string }) => {
      const cutoff = new Date(vars.cutoff).getTime();
      const reported = new Date(REPORTED).getTime();
      if (reported > cutoff || claimed) return { update_rental_bookings: { returning: [] } };
      claimed = true;
      return {
        update_rental_bookings: {
          returning: [{
            id: 'b1',
            booking_number: blank ? null : 'RB-27251416',
            renter_reported_returned_at: REPORTED,
            rental_location_listing: blank ? null : { rental_item: { name: 'JBL PartyBox 310' } },
          }],
        },
      };
    });
    const notifications = { notifySupportRenterReturnUnconfirmed: jest.fn(async () => undefined) };
    const service = new RentalRenterReturnService(
      { getUser: async () => ({}) } as never,
      { executeQuery: jest.fn(), executeMutation } as never,
      notifications as never,
      { getClientFlags: async () => ({}) } as never,
      {} as never,
      {} as never
    );
    return { service, executeMutation, notifications };
  }

  it('does not escalate at 23h59 and escalates once at 24h', async () => {
    const early = escalation();
    const reported = new Date(REPORTED).getTime();
    const before = new Date(reported + 24 * 60 * 60 * 1000 - 60 * 1000);
    await expect(early.service.escalateDue(before)).resolves.toBe(0);
    expect(early.notifications.notifySupportRenterReturnUnconfirmed).not.toHaveBeenCalled();

    const due = escalation();
    const at = new Date(reported + 24 * 60 * 60 * 1000);
    await expect(due.service.escalateDue(at)).resolves.toBe(1);
    await expect(due.service.escalateDue(new Date(at.getTime() + 60 * 60 * 1000))).resolves.toBe(0);
    expect(due.notifications.notifySupportRenterReturnUnconfirmed).toHaveBeenCalledTimes(1);
    expect(due.notifications.notifySupportRenterReturnUnconfirmed).toHaveBeenCalledWith({
      bookingId: 'b1',
      bookingNumber: 'RB-27251416',
      rentalItemName: 'JBL PartyBox 310',
    });
    const mutation = String(due.executeMutation.mock.calls[0][0]);
    expect(mutation).toContain('renter_return_escalated_at: $now');
    expect(mutation).not.toMatch(/_set:\s*\{[^}]*status/);
  });

  it('tells support the booking id and Rental when the row has no number or item', async () => {
    const due = escalation(true);
    const at = new Date(new Date(REPORTED).getTime() + 24 * 60 * 60 * 1000);
    await expect(due.service.escalateDue(at)).resolves.toBe(1);
    expect(due.notifications.notifySupportRenterReturnUnconfirmed).toHaveBeenCalledWith({
      bookingId: 'b1',
      bookingNumber: 'b1',
      rentalItemName: 'Rental',
    });
  });
});

describe('RentalRenterReturnService.confirmAsSupport', () => {
  it('rejects a booking that has not been escalated', async () => {
    const { service, rentals, inspections } = setup({
      booking: { renter_reported_returned_at: REPORTED, renter_return_escalated_at: null },
    });
    await expect(service.confirmAsSupport('b1', 'admin', 'Talked to both sides')).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_NOT_ESCALATED' },
    });
    expect(rentals.confirmLegacyReturnForSupport).not.toHaveBeenCalled();
    expect(inspections.recordHandbackAsAdmin).not.toHaveBeenCalled();
  });

  it('confirms an escalated legacy booking through the business settlement path', async () => {
    const { service, rentals, inspections } = setup({
      booking: { renter_return_escalated_at: '2026-11-13T18:42:00.000Z', inspection_policy_version: null },
    });
    await service.confirmAsSupport('b1', 'admin-1', 'Both sides agree');
    expect(rentals.confirmLegacyReturnForSupport).toHaveBeenCalledWith('b1', 'admin-1', 'Both sides agree');
    expect(inspections.recordHandbackAsAdmin).not.toHaveBeenCalled();
  });

  it('confirms an escalated inspected booking through handback', async () => {
    const { service, rentals, inspections } = setup({
      booking: { renter_return_escalated_at: '2026-11-13T18:42:00.000Z', inspection_policy_version: 1 },
    });
    await service.confirmAsSupport('b1', 'admin-1', 'Inspected and accepted');
    expect(inspections.recordHandbackAsAdmin).toHaveBeenCalledWith('b1', 'admin-1', 'Inspected and accepted');
    expect(rentals.confirmLegacyReturnForSupport).not.toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    const { service, rentals } = setup({
      booking: { renter_return_escalated_at: '2026-11-13T18:42:00.000Z' },
    });
    try {
      await service.confirmAsSupport('b1', 'admin-1', '  ');
      throw new Error('expected 400');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }
    expect(rentals.confirmLegacyReturnForSupport).not.toHaveBeenCalled();
  });

  it('does not settle a missing booking or one the business already closed', async () => {
    const missing = setup({ booking: null });
    await expect(missing.service.confirmAsSupport('b1', 'admin-1', 'Both sides agree')).rejects.toMatchObject({
      status: 404,
    });
    expect(missing.rentals.confirmLegacyReturnForSupport).not.toHaveBeenCalled();
    const closed = setup({
      booking: { status: 'completed', renter_return_escalated_at: '2026-11-13T18:42:00.000Z', inspection_policy_version: 1 },
    });
    await expect(closed.service.confirmAsSupport('b1', 'admin-1', 'Too late')).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_RETURN_ALREADY_CONFIRMED' },
    });
    expect(closed.inspections.recordHandbackAsAdmin).not.toHaveBeenCalled();
  });
});

describe('RentalRenterReturnService admin list and place', () => {
  it('returns no rows when the list is null and hides a place lookup that fails', async () => {
    await expect(setup().service.listForAdmin()).resolves.toEqual([]);
    await expect(setup({ list: null }).service.listForAdmin()).resolves.toEqual([]);
    await expect(setup({ list: [{ id: 'b1' }] }).service.listForAdmin()).resolves.toEqual([{ id: 'b1' }]);
    await expect(setup({ placeThrows: true }).service.placeFor('b1')).resolves.toBeNull();
    await expect(setup({ place: { rental_location_listing: { business_location: { name: '' } } } }).service.placeFor('b1')).resolves.toBeNull();
  });

  it('joins the return address and trims a blank phone', async () => {
    const { service } = setup({
      place: {
        business: { user: { phone_number: '  699  ' } },
        rental_location_listing: {
          business_location: {
            name: 'Studio K',
            address: { address_line_1: '12 Rue', address_line_2: ' ', city: 'Douala', state: null, country: 'CM' },
          },
        },
      },
    });
    await expect(service.placeFor('b1')).resolves.toEqual({
      name: 'Studio K',
      address: '12 Rue, Douala, CM',
      phone: '699',
    });
  });
});
