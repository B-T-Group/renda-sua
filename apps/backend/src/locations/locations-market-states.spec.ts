import { HttpException, HttpStatus } from '@nestjs/common';
import { LocationsController } from './locations.controller';

describe('LocationsController.getMarketStates', () => {
  let controller: LocationsController;
  let hasuraService: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasuraService = { executeQuery: jest.fn() };
    controller = new LocationsController(
      hasuraService as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('rejects missing countryCode', async () => {
    try {
      await controller.getMarketStates(undefined as any);
      fail('expected Bad Request');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          success: false,
          error: 'countryCode query param is required',
        })
      );
    }
    expect(hasuraService.executeQuery).not.toHaveBeenCalled();
  });

  it('aggregates active inventory by state and sorts by item count', async () => {
    hasuraService.executeQuery.mockResolvedValue({
      business_inventory_aggregate: { aggregate: { count: 5 } },
      business_inventory: [
        { business_location: { address: { state: 'Littoral' } } },
        { business_location: { address: { state: 'Centre' } } },
        { business_location: { address: { state: 'Littoral' } } },
        { business_location: { address: { state: 'Littoral' } } },
        { business_location: { address: { state: null } } },
      ],
    });

    const result = await controller.getMarketStates('CM');

    expect(hasuraService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('GetMarketStateItemCounts'),
      { countryCode: 'CM' }
    );
    const query = String(hasuraService.executeQuery.mock.calls[0][0]);
    expect(query).toContain('is_active: { _eq: true }');
    expect(query).toContain('address: { country: { _eq: $countryCode } }');
    expect(result).toEqual({
      success: true,
      states: [
        { state: 'Littoral', itemCount: 3 },
        { state: 'Centre', itemCount: 1 },
      ],
      totalItemCount: 5,
    });
  });

  it('maps Hasura failures to a 500 response', async () => {
    hasuraService.executeQuery.mockRejectedValue(new Error('hasura down'));

    try {
      await controller.getMarketStates('CA');
      fail('expected Internal Server Error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          success: false,
          error: 'Failed to fetch market states',
        })
      );
    }
  });
});
