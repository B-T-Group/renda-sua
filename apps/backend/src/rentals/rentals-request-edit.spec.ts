import { HttpException } from '@nestjs/common';
import * as Q from './rentals-queries';
import { RentalsService } from './rentals.service';
import {
  RespondRentalRequestStatusDto,
  UnavailableRentalReasonCode,
} from './dto/respond-rental-request.dto';

const OPEN = '2026-12-15T00:00:00.000Z';
const OPEN_END = '2026-12-16T00:00:00.000Z';

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    client_id: 'client-1',
    status: 'pending',
    edit_version: 1,
    units_requested: 1,
    client_request_note: 'For a site in Bastos.',
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-12-15', start_at: OPEN, end_at: OPEN_END },
    ],
    rental_location_listing_id: 'listing-1',
    rental_location_listing: {
      id: 'listing-1',
      units_available: 1,
      base_price_per_day: 380,
      rental_item: { business_id: 'biz-1', name: 'Scaffold', business: { user_id: 'biz-user', name: 'Blue' } },
    },
    client: { id: 'client-1', user_id: 'client-user' },
    ...overrides,
  };
}

function codeOf(error: unknown): string | undefined {
  return (error as HttpException).getResponse?.() &&
    ((error as HttpException).getResponse() as { code?: string }).code;
}

describe('RentalsService rental request edits', () => {
  function serviceWith(
    request: Record<string, unknown>,
    flag = true,
    configs?: Array<{ boolean_value: boolean | null; country_code: string | null }>
  ) {
    const executeMutation = jest.fn();
    const notify = jest.fn();
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraUserService: { getUser: jest.Mock };
      hasuraSystemService: { executeQuery: jest.Mock; executeMutation: jest.Mock };
      notificationsService: { sendBusinessRentalRequestUpdated: jest.Mock };
      validateRentalRequestWindowsPlan: jest.Mock;
      computePricingSnapshotForRequest: jest.Mock;
      assertSnapshotCurrency: jest.Mock;
      assertCapacityForRequestWindows: jest.Mock;
      insertProposedBookingRow: jest.Mock;
      deleteBooking: jest.Mock;
      emailClientRentalRequestAccepted: jest.Mock;
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'client-1' },
        first_name: 'Jean',
        last_name: 'K.',
      }),
    };
    service.hasuraSystemService = {
      executeMutation,
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('GetModifyRequestFlag')) {
          return {
            application_configurations: configs ?? [{ boolean_value: flag, country_code: null }],
          };
        }
        return { rental_requests_by_pk: request };
      }),
    };
    service.notificationsService = { sendBusinessRentalRequestUpdated: notify };
    service.validateRentalRequestWindowsPlan = jest.fn();
    return { service, executeMutation, notify };
  }

  const nextWindows = {
    expectedVersion: 1,
    unitsRequested: 1,
    clientRequestNote: 'For a site in Bastos.',
    windows: [
      {
        billing: 'all_day' as const,
        calendarDate: '2026-12-15',
        requestedStartAt: OPEN,
        requestedEndAt: OPEN_END,
      },
      {
        billing: 'all_day' as const,
        calendarDate: '2026-12-16',
        requestedStartAt: '2026-12-16T00:00:00.000Z',
        requestedEndAt: '2026-12-17T00:00:00.000Z',
      },
    ],
  };

  it('returns 404 and does not write when the flag is off', async () => {
    const { service, executeMutation } = serviceWith(pendingRequest(), false);
    await expect(service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 404,
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a save after the business already accepted', async () => {
    const { service, executeMutation } = serviceWith(pendingRequest({ status: 'available' }));
    await expect(service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a stale version and a start inside the 2 hour window before any write', async () => {
    const stale = serviceWith(pendingRequest({ edit_version: 4 }));
    await expect(stale.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
    });
    expect(stale.executeMutation).not.toHaveBeenCalled();

    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const closed = serviceWith(
      pendingRequest({
        rental_selection_windows: [
          { billing: 'hourly', start_at: soon, end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString() },
        ],
      })
    );
    await expect(closed.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
    });
    expect(closed.executeMutation).not.toHaveBeenCalled();
  });

  it('does not write when availability validation fails', async () => {
    const { service, executeMutation } = serviceWith(pendingRequest());
    service.validateRentalRequestWindowsPlan.mockRejectedValue(
      new HttpException('Not available for these dates', 409)
    );
    await expect(service.modifyRentalRequest('request-1', nextWindows)).rejects.toBeInstanceOf(HttpException);
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('maps a SQL stale-version failure after the pre-check', async () => {
    const { service, executeMutation, notify } = serviceWith(pendingRequest());
    executeMutation.mockRejectedValue(new Error('rental_request_stale_version'));
    try {
      await service.modifyRentalRequest('request-1', nextWindows);
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_STALE_VERSION');
    }
    expect(notify).not.toHaveBeenCalled();
  });

  it('stores the edit and notifies the business when the save commits', async () => {
    const { service, executeMutation, notify } = serviceWith(pendingRequest());
    executeMutation.mockResolvedValue({
      apply_rental_request_edit: [{ version: 2, quoted_total: '1140.00' }],
    });
    const saved = await service.modifyRentalRequest('request-1', nextWindows);
    expect(executeMutation).toHaveBeenCalledWith(
      Q.APPLY_RENTAL_REQUEST_EDIT,
      expect.objectContaining({ requestId: 'request-1', expectedVersion: 1, units: 1 })
    );
    expect(saved).toEqual({ success: true, requestId: 'request-1', editVersion: 2, quotedTotal: 1140 });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ businessUserId: 'biz-user', requestId: 'request-1' })
    );
  });

  it('returns 403 for another client or a non-client persona and does not write', async () => {
    const other = serviceWith(pendingRequest({ client_id: 'other-client' }));
    try {
      await other.service.modifyRentalRequest('request-1', nextWindows);
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_FORBIDDEN');
      expect(error).toMatchObject({ status: 403 });
    }
    expect(other.executeMutation).not.toHaveBeenCalled();

    const business = serviceWith(pendingRequest());
    business.service.hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user',
      active_persona: 'business',
      business: { id: 'biz-1' },
    });
    await expect(business.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 403,
      message: 'Only clients can modify rental requests',
    });
    expect(business.executeMutation).not.toHaveBeenCalled();
  });

  it('keeps a notes-only edit on the stored windows and stores a blank note as null', async () => {
    const { service, executeMutation, notify } = serviceWith(pendingRequest());
    executeMutation.mockResolvedValue({
      apply_rental_request_edit: [{ version: 2, quoted_total: '380.00' }],
    });
    const saved = await service.modifyRentalRequest('request-1', {
      expectedVersion: 1,
      clientRequestNote: '   ',
    });
    expect(executeMutation).toHaveBeenCalledWith(
      Q.APPLY_RENTAL_REQUEST_EDIT,
      expect.objectContaining({
        note: null,
        units: 1,
        windows: [
          {
            billing: 'all_day',
            calendar_date: '2026-12-15',
            start_at: OPEN,
            end_at: OPEN_END,
          },
        ],
        changeSummary: expect.objectContaining({ fields: ['notes'], notes: { changed: true } }),
      })
    );
    expect(saved.quotedTotal).toBe(380);
    expect(notify).toHaveBeenCalled();
  });

  it('rejects a notes-only edit when the request has no stored windows', async () => {
    const { service, executeMutation } = serviceWith(pendingRequest({ rental_selection_windows: [] }));
    await expect(
      service.modifyRentalRequest('request-1', { expectedVersion: 1, clientRequestNote: 'Updated' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'requestedStartAt and requestedEndAt are required when windows are omitted',
    });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('closes the edit when the replacement starts inside 2 hours even if the saved start does not', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const { service, executeMutation } = serviceWith(pendingRequest());
    try {
      await service.modifyRentalRequest('request-1', {
        expectedVersion: 1,
        windows: [{ requestedStartAt: soon, requestedEndAt: later }],
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_WINDOW_CLOSED');
    }
    expect(service.validateRentalRequestWindowsPlan).not.toHaveBeenCalled();
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('treats a missing edit version as 1 and ignores a country-only flag', async () => {
    const missing = serviceWith(pendingRequest({ edit_version: null }));
    missing.executeMutation.mockResolvedValue({
      apply_rental_request_edit: [{ version: 2, quoted_total: null }],
    });
    await expect(missing.service.modifyRentalRequest('request-1', nextWindows)).resolves.toMatchObject({
      editVersion: 2,
      quotedTotal: null,
    });

    const countryOnly = serviceWith(pendingRequest(), false, [
      { boolean_value: true, country_code: 'CM' },
    ]);
    await expect(countryOnly.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 404,
    });
    expect(countryOnly.executeMutation).not.toHaveBeenCalled();

    const globalOn = serviceWith(pendingRequest({ edit_version: 4 }), false, [
      { boolean_value: true, country_code: null },
      { boolean_value: false, country_code: 'CM' },
    ]);
    await expect(globalOn.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
    });
    expect(codeOf(await globalOn.service.modifyRentalRequest('request-1', nextWindows).catch((error) => error))).toBe(
      'RENTAL_REQUEST_STALE_VERSION'
    );
  });

  it.each([
    ['rental_request_not_pending', 409, 'RENTAL_REQUEST_ALREADY_ACCEPTED'],
    ['rental_request_forbidden', 403, 'RENTAL_REQUEST_FORBIDDEN'],
    ['rental_request_window_closed', 409, 'RENTAL_REQUEST_WINDOW_CLOSED'],
    ['rental_request_unavailable', 409, 'RENTAL_REQUEST_UNAVAILABLE'],
  ])('maps SQL %s to %s %s and does not notify', async (sqlError, status, code) => {
    const { service, executeMutation, notify } = serviceWith(pendingRequest());
    executeMutation.mockRejectedValue(new Error(sqlError));
    try {
      await service.modifyRentalRequest('request-1', nextWindows);
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ status });
      expect(codeOf(error)).toBe(code);
    }
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it('returns a conflict and skips the notice when the edit function returns no row or an unknown error', async () => {
    const empty = serviceWith(pendingRequest());
    empty.executeMutation.mockResolvedValue({ apply_rental_request_edit: [] });
    await expect(empty.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
      message: 'Could not save changes',
    });
    expect(empty.notify).not.toHaveBeenCalled();

    const unknown = serviceWith(pendingRequest());
    unknown.executeMutation.mockRejectedValue(new Error('connection reset'));
    await expect(unknown.service.modifyRentalRequest('request-1', nextWindows)).rejects.toMatchObject({
      status: 409,
      message: 'Could not save changes',
    });
    expect(unknown.notify).not.toHaveBeenCalled();
  });

  it('saves the edit without a notice when the listing has no business user', async () => {
    const request = pendingRequest();
    request.rental_location_listing.rental_item.business = { name: 'Blue' };
    const { service, executeMutation, notify } = serviceWith(request);
    executeMutation.mockResolvedValue({
      apply_rental_request_edit: [{ version: 2, quoted_total: 760 }],
    });
    await expect(service.modifyRentalRequest('request-1', nextWindows)).resolves.toMatchObject({
      success: true,
      quotedTotal: 760,
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('RentalsService.respondToRentalRequest version gate', () => {
  function responder(
    request: Record<string, unknown>,
    flag = false,
    conflict: Record<string, unknown> = {}
  ) {
    const executeMutation = jest.fn().mockResolvedValue({
      update_rental_requests: { affected_rows: 1 },
      update_rental_requests_by_pk: { id: 'request-1', status: 'available' },
    });
    let fetches = 0;
    const service = Object.create(RentalsService.prototype) as any;
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'biz-user',
        active_persona: 'business',
        business: { id: 'biz-1' },
      }),
    };
    service.hasuraSystemService = {
      executeMutation,
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('GetModifyRequestFlag')) {
          return { application_configurations: [{ boolean_value: flag, country_code: null }] };
        }
        fetches += 1;
        return {
          rental_requests_by_pk: fetches > 1 ? { ...request, edit_version: 9, ...conflict } : request,
        };
      }),
    };
    service.computePricingSnapshotForRequest = jest.fn().mockReturnValue({
      version: 4,
      currency: 'XAF',
      total: 760,
      lines: [],
      computedAt: OPEN,
      unitsBooked: 1,
      securityDeposit: 0,
    });
    service.assertSnapshotCurrency = jest.fn();
    service.assertCapacityForRequestWindows = jest.fn();
    service.insertProposedBookingRow = jest.fn().mockResolvedValue({
      insert_rental_bookings_one: { id: 'booking-1', booking_number: 'RB-1' },
    });
    service.deleteBooking = jest.fn();
    service.emailClientRentalRequestAccepted = jest.fn();
    service.emailClientRentalRequestRejected = jest.fn();
    return { service, executeMutation };
  }

  const accept = {
    status: RespondRentalRequestStatusDto.available,
    contractExpiryHours: 24,
  };

  it('rejects a stale version before inserting a booking', async () => {
    const { service } = responder(pendingRequest());
    await expect(
      service.respondToRentalRequest('request-1', { ...accept, expectedVersion: 8 })
    ).rejects.toMatchObject({ status: 409 });
    expect(service.insertProposedBookingRow).not.toHaveBeenCalled();
  });

  it('deletes the booking and rejects when the compare-and-set loses', async () => {
    const { service, executeMutation } = responder(pendingRequest());
    executeMutation.mockResolvedValue({ update_rental_requests: { affected_rows: 0 } });
    try {
      await service.respondToRentalRequest('request-1', { ...accept, expectedVersion: 1 });
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_STALE_VERSION');
    }
    expect(service.deleteBooking).toHaveBeenCalledWith('booking-1');
  });

  it('requires a version while the flag is on', async () => {
    const { service } = responder(pendingRequest(), true);
    try {
      await service.respondToRentalRequest('request-1', accept);
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_VERSION_REQUIRED');
    }
    expect(service.insertProposedBookingRow).not.toHaveBeenCalled();
  });

  it('keeps the old respond mutation when the client sends no version and the flag is off', async () => {
    const { service, executeMutation } = responder(pendingRequest(), false);
    await service.respondToRentalRequest('request-1', accept);
    expect(executeMutation).toHaveBeenCalledWith(Q.UPDATE_RENTAL_REQUEST_RESPOND, expect.any(Object));
    expect(executeMutation).not.toHaveBeenCalledWith(Q.UPDATE_RENTAL_REQUEST_RESPOND_CAS, expect.any(Object));
  });

  it('rejects a stale decline before any write', async () => {
    const { service, executeMutation } = responder(pendingRequest());
    await expect(
      service.respondToRentalRequest('request-1', {
        status: RespondRentalRequestStatusDto.unavailable,
        unavailableReasonCode: UnavailableRentalReasonCode.fully_booked,
        expectedVersion: 8,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(service.emailClientRentalRequestRejected).not.toHaveBeenCalled();
  });

  it('reports an accepted request when the compare-and-set loses and deletes the booking just inserted', async () => {
    const { service, executeMutation } = responder(pendingRequest(), false, { status: 'available' });
    executeMutation.mockResolvedValue({ update_rental_requests: { affected_rows: 0 } });
    try {
      await service.respondToRentalRequest('request-1', { ...accept, expectedVersion: 1 });
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_ALREADY_ACCEPTED');
    }
    expect(service.deleteBooking).toHaveBeenCalledWith('booking-1');
    expect(service.emailClientRentalRequestAccepted).not.toHaveBeenCalled();
  });

  it('reports an accepted request on a lost decline without deleting a booking', async () => {
    const { service, executeMutation } = responder(pendingRequest(), false, { status: 'available' });
    executeMutation.mockResolvedValue({ update_rental_requests: { affected_rows: 0 } });
    try {
      await service.respondToRentalRequest('request-1', {
        status: RespondRentalRequestStatusDto.unavailable,
        unavailableReasonCode: UnavailableRentalReasonCode.dates_not_available,
        expectedVersion: 1,
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(codeOf(error)).toBe('RENTAL_REQUEST_ALREADY_ACCEPTED');
    }
    expect(executeMutation).toHaveBeenCalledWith(Q.UPDATE_RENTAL_REQUEST_RESPOND_CAS, expect.any(Object));
    expect(service.deleteBooking).not.toHaveBeenCalled();
    expect(service.emailClientRentalRequestRejected).not.toHaveBeenCalled();
  });
});
