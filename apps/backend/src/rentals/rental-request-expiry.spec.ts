import { RentalsService } from './rentals.service';
import {
  expireUnansweredRentalRequests,
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
      executeQuery: jest.fn().mockResolvedValue({
        rental_requests_by_pk: { id: 'req-1', client_id: 'client-1', status: 'pending' },
      }),
      executeMutation: jest.fn().mockResolvedValue({ update_rental_requests: { affected_rows: affected } }),
    };
    service.releaseLinkedDeclineHold = jest.fn();
    service.cancelProposedBooking = jest.fn();
    return service;
  }

  it('does not cancel or release a hold when accept or auto-decline already won', async () => {
    const service = cancelService(0);
    await expect(service.cancelClientRentalRequest('req-1')).rejects.toMatchObject({ status: 400 });
    expect(service.releaseLinkedDeclineHold).not.toHaveBeenCalled();
  });

  it('cancels a still-pending request without releasing a hold', async () => {
    const service = cancelService(1);
    await expect(service.cancelClientRentalRequest('req-1')).resolves.toEqual({ success: true });
    expect(service.releaseLinkedDeclineHold).not.toHaveBeenCalled();
    expect(service.hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('status: { _eq: $status }'),
      { id: 'req-1', status: 'pending' }
    );
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
