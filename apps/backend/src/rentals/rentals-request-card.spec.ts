import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalsService } from './rentals.service';

function harness() {
  const service = Object.create(RentalsService.prototype) as RentalsService & {
    requireBusinessId: jest.Mock;
    hasuraSystemService: { executeQuery: jest.Mock };
    paymentRoutingService: { resolveRailForCountry: jest.Mock };
    assertCapacityForRequestWindows: jest.Mock;
  };
  service.requireBusinessId = jest.fn().mockResolvedValue('biz-1');
  service.hasuraSystemService = { executeQuery: jest.fn() };
  service.paymentRoutingService = { resolveRailForCountry: jest.fn().mockResolvedValue('stripe') };
  service.assertCapacityForRequestWindows = jest.fn().mockResolvedValue(undefined);
  return service;
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    status: 'pending',
    units_requested: 1,
    rental_location_listing: {
      id: 'listing-1',
      units_available: 1,
      business_location: { address: { country: 'CM', city: "L'Assomption" } },
    },
    ...over,
  };
}

describe('getBusinessRentalRequests card facts', () => {
  it('marks a pending request unavailable when capacity conflicts and names the card rail', async () => {
    const service = harness();
    service.assertCapacityForRequestWindows.mockRejectedValue(
      new HttpException('No units available for these dates', HttpStatus.CONFLICT)
    );
    service.paymentRoutingService.resolveRailForCountry.mockResolvedValue('mobile_money');
    service.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_requests: [row()],
      rental_requests_aggregate: { aggregate: { count: 1 } },
    });

    const result = await service.getBusinessRentalRequests({});
    expect(result.requests[0].dates_available).toBe(false);
    expect(result.requests[0].payment_rail).toBe('mobile_money');
  });

  it('leaves dates available unknown when the check throws, and skips non-pending rows', async () => {
    const service = harness();
    service.assertCapacityForRequestWindows.mockRejectedValue(new Error('hasura down'));
    service.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_requests: [row(), row({ id: 'req-2', status: 'available' })],
      rental_requests_aggregate: { aggregate: { count: 2 } },
    });

    const result = await service.getBusinessRentalRequests({ id: 'req-1' });
    expect(result.requests[0].dates_available).toBeNull();
    expect(result.requests[1].dates_available).toBeNull();
    expect(service.assertCapacityForRequestWindows).toHaveBeenCalledTimes(1);
    const where = service.hasuraSystemService.executeQuery.mock.calls[0][1].where;
    expect(where.id).toEqual({ _eq: 'req-1' });
  });

  it('does not guess a card rail when the listing country is missing', async () => {
    const service = harness();
    service.hasuraSystemService.executeQuery.mockResolvedValue({
      rental_requests: [row({ rental_location_listing: { id: 'listing-1', units_available: 2 } })],
      rental_requests_aggregate: { aggregate: { count: 1 } },
    });
    const result = await service.getBusinessRentalRequests({});
    expect(result.requests[0].payment_rail).toBeNull();
    expect(result.requests[0].dates_available).toBe(true);
    expect(service.paymentRoutingService.resolveRailForCountry).not.toHaveBeenCalled();
  });
});
