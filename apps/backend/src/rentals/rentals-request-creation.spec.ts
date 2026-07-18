import * as Q from './rentals-queries';
import { RentalsService } from './rentals.service';

describe('RentalsService.createRentalRequest', () => {
  it('persists the min/max request envelope with selection windows', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      insert_rental_requests_one: { id: 'request-1' },
    });
    const service: any = Object.create(RentalsService.prototype);
    service.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({
        user_type_id: 'client',
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
      },
    });
    expect(result).toEqual({ success: true, requestId: 'request-1' });
  });
});
