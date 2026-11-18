import { RentalsService } from './rentals.service';
import { expiryCountryFilter } from './rental-dashboard-flag';
import { effectiveRespondBy } from './rental-respond-by';
import {
  autodeclineBounds,
  cutoffForCountry,
  expireUnansweredRentalRequests,
  pendingExpiryWhere,
  type UnansweredRentalRequest,
} from './rental-request-expiry';
import {
  buildBusinessRentalRequestExpiredPush,
  buildRentalRequestNoResponsePush,
} from '../notifications/rental-push.messages';

function row(overrides: Partial<UnansweredRentalRequest> = {}): UnansweredRentalRequest {
  return {
    id: 'req-1',
    created_at: '2026-11-14T12:00:00.000Z',
    requested_start_at: '2026-11-17T16:00:00.000Z',
    clientUserId: 'client-user',
    businessUserId: 'biz-user',
    itemName: 'Canon EOS R8',
    businessName: 'Atelier Nord',
    renterName: 'Marie Dubois',
    listingId: 'listing-1',
    ...overrides,
  };
}

function harness(rows: UnansweredRentalRequest[], enabled = true) {
  const casDecline = jest.fn(async () => true);
  const releaseHolds = jest.fn(async () => undefined);
  const notify = jest.fn(async () => undefined);
  const run = (now: Date) =>
    expireUnansweredRentalRequests({
      now,
      isEnabled: async () => enabled,
      listPending: async () => rows,
      casDecline,
      releaseHolds,
      notify,
    });
  return { casDecline, releaseHolds, notify, run };
}

describe('expireUnansweredRentalRequests', () => {
  const now = new Date('2026-11-15T13:00:00.000Z');

  it('declines a request past the 24h mark, releases holds, and notifies once', async () => {
    const tools = harness([row()]);
    await expect(tools.run(now)).resolves.toBe(1);
    expect(tools.casDecline).toHaveBeenCalledWith('req-1', now.toISOString());
    expect(tools.releaseHolds).toHaveBeenCalledWith('req-1');
    expect(tools.notify).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1' }), 'sla');
  });

  it('skips a request that is still inside respond_by', async () => {
    const tools = harness([row({ created_at: '2026-11-15T12:00:00.000Z' })]);
    await expect(tools.run(now)).resolves.toBe(0);
    expect(tools.casDecline).not.toHaveBeenCalled();
    expect(tools.releaseHolds).not.toHaveBeenCalled();
  });

  it('does not release or notify when accept wins the compare-and-set', async () => {
    const tools = harness([row()]);
    tools.casDecline.mockResolvedValue(false);
    await expect(tools.run(now)).resolves.toBe(0);
    expect(tools.releaseHolds).not.toHaveBeenCalled();
    expect(tools.notify).not.toHaveBeenCalled();
  });

  it('is idempotent when the row is no longer pending', async () => {
    const tools = harness([row()]);
    tools.casDecline.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await tools.run(now);
    await expect(tools.run(now)).resolves.toBe(0);
    expect(tools.notify).toHaveBeenCalledTimes(1);
    expect(tools.releaseHolds).toHaveBeenCalledTimes(1);
  });

  it('is a no-op while the flag is off', async () => {
    const tools = harness([row()], false);
    await expect(tools.run(now)).resolves.toBe(0);
    expect(tools.casDecline).not.toHaveBeenCalled();
  });

  it('uses the start window when that instant has passed', async () => {
    const tools = harness([
      row({
        created_at: '2026-11-15T12:30:00.000Z',
        requested_start_at: '2026-11-15T12:40:00.000Z',
      }),
    ]);
    await tools.run(now);
    expect(tools.notify).toHaveBeenCalledWith(expect.anything(), 'start');
  });
});

describe('releaseLinkedDeclineHold', () => {
  it('releases the wallet hold and voids the card authorization', async () => {
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraSystemService: { executeQuery: jest.Mock };
      fetchBooking: jest.Mock;
      releaseHoldIfNeeded: jest.Mock;
      cancelStripeAuthorizationIfAny: jest.Mock;
    };
    const booking = { id: 'b1', booking_number: 'R-1' };
    service.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({ rental_bookings: [{ id: 'b1' }] }),
    };
    service.fetchBooking = jest.fn().mockResolvedValue(booking);
    service.releaseHoldIfNeeded = jest.fn().mockResolvedValue(undefined);
    service.cancelStripeAuthorizationIfAny = jest.fn().mockResolvedValue(undefined);
    await service.releaseLinkedDeclineHold('req-1');
    expect(service.releaseHoldIfNeeded).toHaveBeenCalledWith('b1', booking);
    expect(service.cancelStripeAuthorizationIfAny).toHaveBeenCalledWith(booking);
  });

  it('does nothing when the pending request has no booking', async () => {
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraSystemService: { executeQuery: jest.Mock };
      releaseHoldIfNeeded: jest.Mock;
    };
    service.hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({ rental_bookings: [] }),
    };
    service.releaseHoldIfNeeded = jest.fn();
    await service.releaseLinkedDeclineHold('req-1');
    expect(service.releaseHoldIfNeeded).not.toHaveBeenCalled();
  });
});

describe('autodecline cutoff', () => {
  const now = new Date('2026-11-18T15:00:00.000Z');

  it('M3 leaves every already-due request alone when no cutoff is stored', () => {
    const bounds = autodeclineBounds(now, []);
    expect(bounds.since).toBe(now.toISOString());
    expect(bounds.limit).toBe(50);
    expect(cutoffForCountry([], 'CM', now)).toBe(now.toISOString());
  });

  it('M3 keeps requests before the stored cutoff and caps the batch', () => {
    const rows = [
      {
        config_key: 'rentals_dashboard_requests_autodecline_since',
        country_code: null,
        string_value: '2026-11-01T00:00:00.000Z',
      },
      { config_key: 'rentals_dashboard_requests_autodecline_batch', country_code: null, number_value: 20 },
    ];
    expect(autodeclineBounds(now, rows)).toEqual({ since: '2026-11-01T00:00:00.000Z', limit: 20 });
    expect(Date.parse('2026-10-01T00:00:00.000Z') < Date.parse(cutoffForCountry(rows, 'CA', now))).toBe(true);
  });
});

describe('L4 failed decline side effects are retried', () => {
  it('L4 records a failed release and retries it on the next run', async () => {
    const due = row();
    const releaseHolds = jest.fn()
      .mockRejectedValueOnce(new Error('stripe down'))
      .mockResolvedValueOnce(undefined);
    const recordFailure = jest.fn(async () => undefined);
    const clearRetry = jest.fn(async () => undefined);
    const jobs = [{ id: 'job-1', kind: 'release' as const, row: due, window: 'sla' as const }];
    await expireUnansweredRentalRequests({
      now: new Date('2026-11-18T16:00:00.000Z'),
      isEnabled: async () => true,
      listPending: async () => [due],
      casDecline: async () => true,
      releaseHolds,
      notify: async () => undefined,
      recordFailure,
    });
    expect(recordFailure).toHaveBeenCalledWith(due, 'release', 'sla', expect.any(Error));
    await expireUnansweredRentalRequests({
      now: new Date('2026-11-18T16:05:00.000Z'),
      isEnabled: async () => true,
      listPending: async () => [],
      casDecline: async () => false,
      releaseHolds,
      notify: async () => undefined,
      listRetries: async () => jobs,
      clearRetry,
    });
    expect(clearRetry).toHaveBeenCalledWith('job-1');
  });
});

describe('cancelClientRentalRequest', () => {
  function cancelService(affected: number) {
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraUserService: { getUser: jest.Mock };
      hasuraSystemService: { executeQuery: jest.Mock; executeMutation: jest.Mock };
      releaseLinkedDeclineHold: jest.Mock;
      cancelProposedBooking: jest.Mock;
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        id: 'client-user',
        active_persona: 'client',
        client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation((query: string) => {
        if (String(query).includes('rental_bookings')) {
          return Promise.resolve({ rental_bookings: affected === 2 ? [{ id: 'booking-1' }] : [] });
        }
        return Promise.resolve({
          rental_requests_by_pk: { id: 'req-1', client_id: 'client-1', status: 'pending' },
        });
      }),
      executeMutation: jest.fn().mockResolvedValue({
        cancel_client_rental_request: affected ? [{ id: 'req-1', status: 'cancelled' }] : [],
      }),
    };
    service.releaseLinkedDeclineHold = jest.fn();
    service.cancelProposedBooking = jest.fn();
    return service;
  }

  it('M2 returns 409 and does not release a hold when the request is no longer open', async () => {
    const service = cancelService(0);
    await expect(service.cancelClientRentalRequest('req-1')).rejects.toMatchObject({ status: 409 });
    expect(service.releaseLinkedDeclineHold).not.toHaveBeenCalled();
  });

  it('M2 cancels a still-pending request without releasing a hold', async () => {
    const service = cancelService(1);
    await expect(service.cancelClientRentalRequest('req-1')).resolves.toEqual({ success: true });
    expect(service.releaseLinkedDeclineHold).not.toHaveBeenCalled();
    expect(service.hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('cancel_client_rental_request'),
      { requestId: 'req-1', clientId: 'client-1' }
    );
  });

  it('M2 releases the proposed booking when accept already created one', async () => {
    const service = cancelService(2);
    await expect(service.cancelClientRentalRequest('req-1')).resolves.toEqual({ success: true });
    expect(service.releaseLinkedDeclineHold).toHaveBeenCalledWith('req-1');
  });
});

describe('N5 stored respond_by after an edit', () => {
  it('N5 keeps the edited deadline instead of created_at plus 24 hours', async () => {
    const edited = effectiveRespondBy({
      createdAt: '2026-11-01T00:00:00.000Z',
      respondBy: '2026-11-02T20:00:00.000Z',
      startAt: '2026-11-10T00:00:00.000Z',
    });
    expect(edited.respondBy).toBe('2026-11-02T20:00:00.000Z');
    const now = new Date('2026-11-02T01:00:00.000Z');
    const tools = harness([row({ respond_by: edited.respondBy, created_at: '2026-11-01T00:00:00.000Z' })]);
    await expect(tools.run(now)).resolves.toBe(0);
    expect(tools.casDecline).not.toHaveBeenCalled();
  });
});

describe('N6 expiry scan country filter', () => {
  it('N6 limits the SQL where to enabled countries before the batch', () => {
    const filter = expiryCountryFilter([
      { boolean_value: false, country_code: null },
      { boolean_value: true, country_code: 'CM' },
    ]);
    expect(filter.kind).toBe('in');
    if (filter.kind !== 'in') return;
    expect(filter.countries).toEqual(expect.arrayContaining(['CM', 'Cameroon']));
    expect(filter.countries.join(' ')).not.toMatch(/Gabon|GA/);
    const where = pendingExpiryWhere(new Date('2026-11-18T00:00:00.000Z'), '2026-11-01T00:00:00.000Z', filter);
    expect(JSON.stringify(where)).toContain('Cameroon');
    expect(JSON.stringify(where)).not.toContain('Gabon');
  });
});

describe('no-response copy', () => {
  it('uses the 24h sentence and the start-time sentence in English and French', () => {
    const sla = buildRentalRequestNoResponsePush({
      businessName: 'Atelier Nord',
      window: 'sla',
      preferredLanguage: 'en',
    });
    expect(sla.title).toBe('Rental request declined');
    expect(sla.body).toContain('didn’t respond within 24 hours');
    expect(sla.viewListing).toBe('View listing');
    expect(sla.browseRentals).toBe('Browse rentals');
    const fr = buildRentalRequestNoResponsePush({
      businessName: 'Atelier Nord',
      window: 'start',
      preferredLanguage: 'fr',
    });
    expect(fr.title).toBe('Demande de location refusée');
    expect(fr.body).toContain('n’a pas répondu avant le début');
    expect(buildBusinessRentalRequestExpiredPush({ window: 'sla', preferredLanguage: 'en' }).body).toBe(
      'Request expired — no response in 24h'
    );
    expect(buildBusinessRentalRequestExpiredPush({ window: 'start', preferredLanguage: 'fr' }).body).toBe(
      'Demande expirée — aucune réponse avant le début'
    );
  });
});
