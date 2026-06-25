import { HttpException, HttpStatus } from '@nestjs/common';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;
  let hasuraService: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasuraService = { executeQuery: jest.fn() };
    controller = new LocationsController(
      hasuraService as unknown as HasuraSystemService,
      { getUser: jest.fn(), getUserId: jest.fn() } as unknown as HasuraUserService,
      {
        getFastDeliveryConfig: jest.fn(),
        isFastDeliveryEnabled: jest.fn(),
      } as unknown as DeliveryConfigService,
      {
        upsertMyAgentLocation: jest.fn(),
        getLatestAgentLocation: jest.fn(),
      } as unknown as LocationsService
    );
  });

  describe('getPublicSupportedCountries', () => {
    it('dedupes multi-state countries and attaches active payment methods', async () => {
      hasuraService.executeQuery
        .mockResolvedValueOnce({
          supported_country_states: [
            {
              country_code: 'CA',
              country_name: 'Canada',
              currency_code: 'CAD',
              service_status: 'coming_soon',
              delivery_enabled: false,
            },
            {
              country_code: 'CA',
              country_name: 'Canada',
              currency_code: 'CAD',
              service_status: 'coming_soon',
              delivery_enabled: true,
            },
            {
              country_code: 'CM',
              country_name: 'Cameroon',
              currency_code: 'XAF',
              service_status: 'active',
              delivery_enabled: true,
            },
          ],
        })
        .mockResolvedValueOnce({
          supported_payment_systems: [
            { name: 'MTN MoMo', country: 'CM' },
            { name: 'Orange Money', country: 'CM' },
            { name: 'Interac', country: 'CA' },
          ],
        });

      const result = await controller.getPublicSupportedCountries();

      expect(result).toEqual({
        success: true,
        countries: [
          {
            code: 'CA',
            name: 'Canada',
            currencyCode: 'CAD',
            serviceStatus: 'coming_soon',
            deliveryEnabled: true,
            supportedPaymentMethods: ['Interac'],
          },
          {
            code: 'CM',
            name: 'Cameroon',
            currencyCode: 'XAF',
            serviceStatus: 'active',
            deliveryEnabled: true,
            supportedPaymentMethods: ['MTN MoMo', 'Orange Money'],
          },
        ],
      });
      expect(hasuraService.executeQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('GetSupportedCountriesPublic')
      );
      expect(hasuraService.executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('active: { _eq: true }')
      );
    });

    it('returns a stable 500 payload when Hasura country lookup fails', async () => {
      hasuraService.executeQuery.mockRejectedValueOnce(new Error('hasura down'));

      await expect(controller.getPublicSupportedCountries()).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'Failed to fetch supported countries',
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });
});
