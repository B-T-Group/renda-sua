import { HttpException } from '@nestjs/common';
import { RentalsService } from './rentals.service';

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
  const response = (error as HttpException).getResponse?.();
  return response && typeof response === 'object' ? (response as { code?: string }).code : undefined;
}

describe('PATCH rental request error codes', () => {
  function serviceWith(request: Record<string, unknown>) {
    const executeMutation = jest.fn();
    const service = Object.create(RentalsService.prototype) as RentalsService & {
      hasuraUserService: { getUser: jest.Mock };
      hasuraSystemService: { executeQuery: jest.Mock; executeMutation: jest.Mock };
      notificationsService: { sendBusinessRentalRequestUpdated: jest.Mock };
      validateRentalRequestWindowsPlan: jest.Mock;
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
          return { application_configurations: [{ boolean_value: true, country_code: null }] };
        }
        return { rental_requests_by_pk: request };
      }),
    };
    service.notificationsService = { sendBusinessRentalRequestUpdated: jest.fn() };
    service.validateRentalRequestWindowsPlan = jest.fn();
    return { service, executeMutation };
  }

  it('returns 409 RENTAL_REQUEST_STALE_VERSION for a notes-only stale PATCH', async () => {
    const { service, executeMutation } = serviceWith(pendingRequest({ edit_version: 4 }));
    try {
      await service.modifyRentalRequest('request-1', {
        expectedVersion: 1,
        clientRequestNote: 'Updated note only',
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ status: 409 });
      expect(codeOf(error)).toBe('RENTAL_REQUEST_STALE_VERSION');
    }
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('returns 409 RENTAL_REQUEST_WINDOW_CLOSED for a notes-only edit inside the 2h cutoff', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { service, executeMutation } = serviceWith(
      pendingRequest({
        rental_selection_windows: [
          {
            billing: 'hourly',
            start_at: soon,
            end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          },
        ],
      })
    );
    try {
      await service.modifyRentalRequest('request-1', {
        expectedVersion: 1,
        clientRequestNote: 'Updated note only',
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ status: 409 });
      expect(codeOf(error)).toBe('RENTAL_REQUEST_WINDOW_CLOSED');
    }
    expect(executeMutation).not.toHaveBeenCalled();
  });
});
