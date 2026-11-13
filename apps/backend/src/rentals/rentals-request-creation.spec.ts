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
      },
    });
    expect(result).toEqual({ success: true, requestId: 'request-1' });
  });

  it('rejects an unfit card window at create time when the guard is on', async () => {
    const service = Object.create(RentalsService.prototype) as RentalsServiceHarness & {
      inspectionFlags: { cardWindowGuardEnabled: jest.Mock };
      cardWindow: { forCountry: jest.Mock };
      rejectUnfitCardRequest: RentalsService['rejectUnfitCardRequest'];
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client', active_persona: 'client', client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = { executeMutation: jest.fn() };
    service.fetchListing = jest.fn().mockResolvedValue({
      id: 'listing-1',
      units_available: 1,
      business_location: { address: { country: 'CA' } },
    });
    service.assertListingBookable = jest.fn();
    service.validateRentalRequestWindowsPlan = jest.fn();
    service.emailBusinessNewRentalRequest = jest.fn();
    service.inspectionFlags = { cardWindowGuardEnabled: jest.fn().mockResolvedValue(true) };
    service.cardWindow = {
      forCountry: jest.fn().mockResolvedValue({
        payment_rail: 'stripe',
        momo_available: false,
        inspection_enabled: true,
        latest_card_end_at: '2026-11-15T19:00:00.000Z',
        card_auth_window_days: 6,
        stripe_review_hours: 72,
        timezone: 'America/Toronto',
      }),
    };
    await expect(service.createRentalRequest({
      rentalLocationListingId: 'listing-1',
      windows: [{
        requestedStartAt: '2026-11-17T08:00:00.000Z',
        requestedEndAt: '2026-11-18T01:00:00.000Z',
        billing: 'all_day',
        calendarDate: '2026-11-17',
      }],
    })).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        code: 'RENTAL_INSPECTION_STRIPE_WINDOW',
        latest_card_end_at: '2026-11-15T19:00:00.000Z',
        timezone: 'America/Toronto',
        payment_rail: 'stripe',
      }),
    });
    expect(service.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('does not reject when charge at pickup clears latest_card_end_at', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      insert_rental_requests_one: { id: 'request-pickup' },
    });
    const service = Object.create(RentalsService.prototype) as RentalsServiceHarness & {
      inspectionFlags: { cardWindowGuardEnabled: jest.Mock };
      cardWindow: { forCountry: jest.Mock };
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client', active_persona: 'client', client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = { executeMutation };
    service.fetchListing = jest.fn().mockResolvedValue({
      id: 'listing-1',
      units_available: 1,
      base_price_per_day: 10,
      base_price_per_hour: 1,
      business_location: { address: { country: 'CA' } },
    });
    service.assertListingBookable = jest.fn();
    service.validateRentalRequestWindowsPlan = jest.fn();
    service.emailBusinessNewRentalRequest = jest.fn();
    service.inspectionFlags = { cardWindowGuardEnabled: jest.fn().mockResolvedValue(true) };
    service.cardWindow = {
      forCountry: jest.fn().mockResolvedValue({
        mode: 'charge_at_pickup',
        payment_rail: 'stripe',
        momo_available: false,
        inspection_enabled: true,
        latest_card_end_at: null,
        card_auth_window_days: 6,
        stripe_review_hours: 72,
        timezone: 'America/Toronto',
      }),
    };
    const result = await service.createRentalRequest({
      rentalLocationListingId: 'listing-1',
      requestedStartAt: '2026-11-17T08:00:00.000Z',
      requestedEndAt: '2026-11-20T01:00:00.000Z',
    });
    expect(result.requestId).toBe('request-pickup');
    expect(executeMutation).toHaveBeenCalled();
  });

  it('does not reject at create time while the guard flag is off', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      insert_rental_requests_one: { id: 'request-2' },
    });
    const service = Object.create(RentalsService.prototype) as RentalsServiceHarness & {
      inspectionFlags: { cardWindowGuardEnabled: jest.Mock };
    };
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client', active_persona: 'client', client: { id: 'client-1' },
      }),
    };
    service.hasuraSystemService = { executeMutation };
    service.fetchListing = jest.fn().mockResolvedValue({
      id: 'listing-1',
      units_available: 1,
      base_price_per_day: 10,
      base_price_per_hour: 1,
    });
    service.assertListingBookable = jest.fn();
    service.validateRentalRequestWindowsPlan = jest.fn();
    service.emailBusinessNewRentalRequest = jest.fn();
    service.inspectionFlags = { cardWindowGuardEnabled: jest.fn().mockResolvedValue(false) };
    const result = await service.createRentalRequest({
      rentalLocationListingId: 'listing-1',
      requestedStartAt: '2026-11-17T08:00:00.000Z',
      requestedEndAt: '2026-11-20T01:00:00.000Z',
    });
    expect(result.requestId).toBe('request-2');
    expect(service.inspectionFlags.cardWindowGuardEnabled).toHaveBeenCalled();
  });
});
