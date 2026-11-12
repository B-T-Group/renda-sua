import * as Q from './rentals-queries';
import { RentalsService } from './rentals.service';

interface RentalsServiceHarness {
  createRentalRequest: RentalsService['createRentalRequest'];
  hasuraUserService: { getUser: jest.Mock };
  hasuraSystemService: { executeMutation: jest.Mock };
  fetchListing: jest.Mock;
  assertListingBookable: jest.Mock;
  validateRentalRequestWindowsPlan: jest.Mock;
  emailBusinessNewRentalRequest: jest.Mock;
}

describe('RentalsService.createRentalRequest', () => {
  it('persists the min/max request envelope with selection windows', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      insert_rental_requests_one: { id: 'request-1' },
    });
    const service = Object.create(
      RentalsService.prototype
    ) as RentalsServiceHarness;
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client', active_persona: 'client',
        client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = { executeMutation };
    service.fetchListing = jest.fn().mockResolvedValue({
      id: 'listing-1',
      units_available: 3,
    });
    service.assertListingBookable = jest.fn();
    service.validateRentalRequestWindowsPlan = jest.fn();
    service.emailBusinessNewRentalRequest = jest.fn();

    const result = await service.createRentalRequest({
      rentalLocationListingId: 'listing-1',
      unitsRequested: 2,
      windows: [
        {
          requestedStartAt: '2026-08-20T15:00:00.000Z',
          requestedEndAt: '2026-08-20T18:00:00.000Z',
          billing: 'hourly',
        },
        {
          requestedStartAt: '2026-08-20T10:00:00.000Z',
          requestedEndAt: '2026-08-20T12:00:00.000Z',
          billing: 'hourly',
        },
      ],
    });

    expect(executeMutation).toHaveBeenCalledWith(Q.INSERT_RENTAL_REQUEST, {
      object: {
        client_id: 'client-1',
        rental_location_listing_id: 'listing-1',
        requested_start_at: '2026-08-20T10:00:00.000Z',
        requested_end_at: '2026-08-20T18:00:00.000Z',
        rental_selection_windows: [
          {
            start_at: '2026-08-20T15:00:00.000Z',
            end_at: '2026-08-20T18:00:00.000Z',
          },
          {
            start_at: '2026-08-20T10:00:00.000Z',
            end_at: '2026-08-20T12:00:00.000Z',
          },
        ],
        status: 'pending',
        units_requested: 2,
        client_request_note: null,
        quoted_total: null,
        rental_pricing_snapshot: null,
      },
    });
    expect(result).toEqual({ success: true, requestId: 'request-1' });
  });

  it('persists quoted_total and a v4 snapshot when listing rates can price the windows', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      insert_rental_requests_one: { id: 'request-2' },
    });
    const service = Object.create(RentalsService.prototype) as RentalsServiceHarness;
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client',
        active_persona: 'client',
        client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = { executeMutation };
    service.fetchListing = jest.fn().mockResolvedValue({
      id: 'listing-1',
      units_available: 2,
      base_price_per_day: 380,
      base_price_per_hour: 100,
      security_deposit_amount: 3040,
      rental_item: { currency: 'XAF' },
    });
    service.assertListingBookable = jest.fn();
    service.validateRentalRequestWindowsPlan = jest.fn();
    service.emailBusinessNewRentalRequest = jest.fn();

    await service.createRentalRequest({
      rentalLocationListingId: 'listing-1',
      unitsRequested: 1,
      windows: [
        {
          requestedStartAt: '2026-11-14T00:00:00.000Z',
          requestedEndAt: '2026-11-15T00:00:00.000Z',
          billing: 'all_day',
          calendarDate: '2026-11-14',
        },
        {
          requestedStartAt: '2026-11-15T00:00:00.000Z',
          requestedEndAt: '2026-11-16T00:00:00.000Z',
          billing: 'all_day',
          calendarDate: '2026-11-15',
        },
      ],
    });

    const object = executeMutation.mock.calls[0][1].object;
    expect(object.quoted_total).toBe(760);
    expect(object.rental_pricing_snapshot).toMatchObject({
      version: 4,
      currency: 'XAF',
      total: 760,
      unitsBooked: 1,
      securityDeposit: 3040,
    });
    expect(object.rental_pricing_snapshot.lines).toHaveLength(2);
    expect(object.rental_pricing_snapshot.computedAt).toEqual(expect.any(String));
  });
});
