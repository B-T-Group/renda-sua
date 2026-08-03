import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CountryOnboardingService } from './country-onboarding.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;
  let hasuraService: { executeQuery: jest.Mock };
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
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
      } as unknown as LocationsService,
      {
        getConfigMap: jest.fn().mockResolvedValue(
          new Map([
            [
              'CA',
              {
                countryCode: 'CA',
                signupEnabled: true,
                postalCodeRequired: true,
                verificationFlow: 'stripe_connect',
                defaultCurrency: 'CAD',
              },
            ],
            [
              'CM',
              {
                countryCode: 'CM',
                signupEnabled: true,
                postalCodeRequired: false,
                verificationFlow: 'national_id',
                defaultCurrency: 'XAF',
              },
            ],
          ])
        ),
      } as unknown as CountryOnboardingService
    );
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
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
            signupEnabled: true,
            postalCodeRequired: true,
            verificationFlow: 'stripe_connect',
          },
          {
            code: 'CM',
            name: 'Cameroon',
            currencyCode: 'XAF',
            serviceStatus: 'active',
            deliveryEnabled: true,
            supportedPaymentMethods: ['MTN MoMo', 'Orange Money'],
            signupEnabled: true,
            postalCodeRequired: false,
            verificationFlow: 'national_id',
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

  describe('getMarketStates', () => {
    it('returns inventory state counts by default', async () => {
      hasuraService.executeQuery.mockResolvedValueOnce({
        business_inventory_aggregate: { aggregate: { count: 3 } },
        business_inventory: [
          { business_location: { address: { state: 'Littoral' } } },
          { business_location: { address: { state: 'Littoral' } } },
          { business_location: { address: { state: 'Centre' } } },
        ],
      });

      const result = await controller.getMarketStates('CM');

      expect(result.success).toBe(true);
      expect(result.totalItemCount).toBe(3);
      expect(result.states).toEqual([
        { state: 'Littoral', itemCount: 2 },
        { state: 'Centre', itemCount: 1 },
      ]);
    });

    it('returns rental state counts when catalog=rentals', async () => {
      hasuraService.executeQuery.mockResolvedValueOnce({
        rental_location_listings_aggregate: { aggregate: { count: 2 } },
        rental_location_listings: [
          { business_location: { address: { state: 'Littoral' } } },
          { business_location: { address: { state: 'Littoral' } } },
        ],
      });

      const result = await controller.getMarketStates('CM', 'rentals');

      expect(result.success).toBe(true);
      expect(result.totalItemCount).toBe(2);
      expect(result.states).toEqual([{ state: 'Littoral', itemCount: 2 }]);
    });
  });
});
