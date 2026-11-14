import { HttpException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RentalNotReceivedService } from './rental-not-received.service';

const START = '2026-11-12T14:00:00.000Z';
const inside = new Date('2026-11-12T14:10:00.000Z');
const edge = new Date('2026-11-12T14:30:00.000Z');
const closed = new Date('2026-11-12T14:30:00.001Z');

const stored = {
  id: 'r1',
  rental_booking_id: 'b1',
  reported_at: '2026-11-12T14:10:00.000Z',
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    booking_number: 'RB-1',
    client_id: 'c1',
    status: 'active',
    inspection_policy_version: 1,
    actual_start_at: START,
    business: { user_id: 'bu1' },
    rental_location_listing: { rental_item: { name: 'Drill' } },
    ...overrides,
  };
}

function setup(options: {
  user?: Record<string, unknown>;
  booking?: Record<string, unknown> | null;
  existing?: typeof stored | null;
  emptyReturning?: boolean;
  insertError?: unknown;
  appearOnSecondFind?: boolean;
} = {}) {
  const user = options.user ?? { id: 'u1', active_persona: 'client', client: { id: 'c1' } };
  const row = options.booking === null ? null : booking(options.booking ?? {});
  let report = options.existing ?? null;
  let finds = 0;
  const executeQuery = jest.fn(async (query: string) => {
    if (query.includes('rental_bookings_by_pk')) return { rental_bookings_by_pk: row };
    if (query.includes('rental_not_received_reports')) {
      finds += 1;
      if (options.appearOnSecondFind && finds > 1) report = stored;
      return { rental_not_received_reports: report ? [report] : [] };
    }
    return {};
  });
  const executeMutation = jest.fn(async () => {
    if (options.insertError) throw options.insertError;
    if (options.emptyReturning) return { insert_rental_not_received_reports: { returning: [] } };
    report = stored;
    return { insert_rental_not_received_reports: { returning: [stored] } };
  });
  const notifications = {
    sendBusinessRentalNotReceived: jest.fn(async () => undefined),
    notifySupportRentalNotReceived: jest.fn(async () => undefined),
  };
  const service = new RentalNotReceivedService(
    { getUser: async () => user } as never,
    { executeQuery, executeMutation } as never,
    notifications as never
  );
  return { service, executeQuery, executeMutation, notifications };
}

describe('RentalNotReceivedService.report', () => {
  it('allows only the renter', async () => {
    const business = setup({ user: { id: 'u2', active_persona: 'business', client: null } });
    await expect(business.service.report('b1', inside)).rejects.toMatchObject({ status: 403 });
    expect(business.executeQuery).not.toHaveBeenCalled();

    const other = setup({ user: { id: 'u3', active_persona: 'client', client: { id: 'other' } } });
    await expect(other.service.report('b1', inside)).rejects.toMatchObject({ status: 404 });

    const missing = setup({ booking: null });
    await expect(missing.service.report('b1', inside)).rejects.toMatchObject({ status: 404 });

    const noProfile = setup({ user: { id: 'u4', active_persona: 'client', client: null } });
    await expect(noProfile.service.report('b1', inside)).rejects.toMatchObject({ status: 403 });
    expect(noProfile.executeQuery).not.toHaveBeenCalled();

    const agent = setup({
      user: { id: 'u5', active_persona: 'agent', client: { id: 'c1' } },
    });
    await expect(agent.service.report('b1', inside)).rejects.toMatchObject({ status: 403 });
    expect(agent.executeQuery).not.toHaveBeenCalled();
  });

  it('rejects a booking with no condition report', async () => {
    const { service, notifications } = setup({ booking: { inspection_policy_version: null } });
    await expect(service.report('b1', inside)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_NOT_RECEIVED_NOT_INSPECTED' },
    });
    expect(notifications.sendBusinessRentalNotReceived).not.toHaveBeenCalled();
  });

  it('rejects a report before the start, with no start, or with an unusable start', async () => {
    const future = setup({ booking: { actual_start_at: '2026-11-12T14:10:00.001Z' } });
    await expect(future.service.report('b1', inside)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED' },
    });
    expect(future.executeMutation).not.toHaveBeenCalled();

    const missingStart = setup({ booking: { actual_start_at: null } });
    await expect(missingStart.service.report('b1', inside)).rejects.toMatchObject({
      response: { code: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED' },
    });
    expect(missingStart.executeMutation).not.toHaveBeenCalled();

    const unusable = setup({ booking: { actual_start_at: 'not-a-date' } });
    await expect(unusable.service.report('b1', inside)).rejects.toMatchObject({
      response: { code: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED' },
    });
    expect(unusable.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a report outside the 30-minute window, including one millisecond past', async () => {
    const { service } = setup();
    try {
      await service.report('b1', closed);
      throw new Error('expected 409');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED',
      });
    }
  });

  it('stores the report at the 30-minute mark and notifies support and the business once', async () => {
    const { service, executeMutation, notifications } = setup();
    const result = await service.report('b1', edge);
    expect(result).toEqual({
      success: true,
      alreadyReported: false,
      report: { id: 'r1', rentalBookingId: 'b1', reportedAt: stored.reported_at },
    });
    const mutation = String(executeMutation.mock.calls[0][0]);
    expect(mutation).toContain('insert_rental_not_received_reports');
    expect(mutation).not.toContain('update_rental_bookings');
    expect(executeMutation.mock.calls[0][1]).toEqual({
      object: { rental_booking_id: 'b1', reported_by_user_id: 'u1' },
    });
    expect(notifications.sendBusinessRentalNotReceived).toHaveBeenCalledTimes(1);
    expect(notifications.sendBusinessRentalNotReceived).toHaveBeenCalledWith({
      businessUserId: 'bu1',
      bookingId: 'b1',
    });
    expect(notifications.notifySupportRentalNotReceived).toHaveBeenCalledWith({
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'Drill',
    });
  });

  it('still stores the report when the business user, number, or item name is missing', async () => {
    const { service, executeMutation, notifications } = setup({
      booking: {
        business: null,
        booking_number: null,
        rental_location_listing: null,
      },
    });
    await expect(service.report('b1', inside)).resolves.toMatchObject({ alreadyReported: false });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(notifications.sendBusinessRentalNotReceived).toHaveBeenCalledWith({
      businessUserId: '',
      bookingId: 'b1',
    });
    expect(notifications.notifySupportRentalNotReceived).toHaveBeenCalledWith({
      bookingId: 'b1',
      bookingNumber: 'b1',
      rentalItemName: 'Rental',
    });
  });

  it('returns the existing report and does not notify again, even after the window', async () => {
    const { service, executeMutation, notifications } = setup({ existing: stored });
    const result = await service.report('b1', closed);
    expect(result.alreadyReported).toBe(true);
    expect(result.report.id).toBe('r1');
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendBusinessRentalNotReceived).not.toHaveBeenCalled();
    expect(notifications.notifySupportRentalNotReceived).not.toHaveBeenCalled();
  });

  it('treats an empty insert and a uniqueness violation as the existing report', async () => {
    const raced = setup({ emptyReturning: true, appearOnSecondFind: true });
    await expect(raced.service.report('b1', inside)).resolves.toMatchObject({ alreadyReported: true });
    expect(raced.notifications.notifySupportRentalNotReceived).not.toHaveBeenCalled();

    const duplicate = setup({
      insertError: { response: { errors: [{ message: 'Uniqueness violation. duplicate key' }] } },
      appearOnSecondFind: true,
    });
    await expect(duplicate.service.report('b1', inside)).resolves.toMatchObject({ alreadyReported: true });
    expect(duplicate.notifications.sendBusinessRentalNotReceived).not.toHaveBeenCalled();

    const lost = setup({
      insertError: { message: 'duplicate key value violates unique constraint' },
    });
    await expect(lost.service.report('b1', inside)).rejects.toMatchObject({
      status: 409,
      message: 'Try again',
    });
    expect(lost.notifications.notifySupportRentalNotReceived).not.toHaveBeenCalled();

    const down = setup({ insertError: new Error('connection reset') });
    await expect(down.service.report('b1', inside)).rejects.toThrow('connection reset');
    expect(down.notifications.sendBusinessRentalNotReceived).not.toHaveBeenCalled();
  });

  it('exposes an existing report for the booking read', async () => {
    const found = setup({ existing: stored });
    await expect(found.service.findForBooking('b1')).resolves.toEqual(stored);
    const missing = setup();
    await expect(missing.service.findForBooking('b1')).resolves.toBeNull();

    const executeQuery = jest.fn(async () => {
      throw new Error('down');
    });
    const failed = new RentalNotReceivedService(
      { getUser: async () => ({}) } as never,
      { executeQuery, executeMutation: jest.fn() } as never,
      {
        sendBusinessRentalNotReceived: jest.fn(),
        notifySupportRentalNotReceived: jest.fn(),
      } as never
    );
    await expect(failed.findForBooking('b1')).resolves.toBeNull();

    const listQuery = jest.fn(async () => ({ rental_not_received_reports: null }));
    const admin = new RentalNotReceivedService(
      { getUser: async () => ({}) } as never,
      { executeQuery: listQuery, executeMutation: jest.fn() } as never,
      {
        sendBusinessRentalNotReceived: jest.fn(),
        notifySupportRentalNotReceived: jest.fn(),
      } as never
    );
    await expect(admin.listForAdmin()).resolves.toEqual([]);
    listQuery.mockResolvedValueOnce({ rental_not_received_reports: [stored] });
    await expect(admin.listForAdmin()).resolves.toEqual([stored]);
  });

  it('does not change booking status in this service', () => {
    const source = readFileSync(join(__dirname, 'rental-not-received.service.ts'), 'utf8');
    expect(source).not.toContain('update_rental_bookings');
    expect(source).not.toContain('refund');
    expect(source).not.toContain('cancel');
  });
});
