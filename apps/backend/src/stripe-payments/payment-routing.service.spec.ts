import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentRoutingService } from './payment-routing.service';

type MockHasuraSystemService = Pick<HasuraSystemService, 'executeQuery'>;
type MockConfigService = Pick<ConfigService, 'get'>;

describe('PaymentRoutingService', () => {
  let hasuraService: jest.Mocked<MockHasuraSystemService>;
  let configService: jest.Mocked<MockConfigService>;
  let service: PaymentRoutingService;

  beforeEach(() => {
    hasuraService = {
      executeQuery: jest.fn().mockResolvedValue({
        supported_payment_systems: [{ id: 'stripe-us' }],
      }),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'stripe' ? { enabledCountries: ['US', 'CA'] } : undefined
      ),
    };
    service = new PaymentRoutingService(
      hasuraService as HasuraSystemService,
      configService as ConfigService
    );
  });

  it('uses Stripe only when the country is configured and active in Hasura', async () => {
    await expect(service.resolveRailForCountry(' ca ')).resolves.toBe('stripe');

    expect(hasuraService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('supported_payment_systems'),
      { country: 'CA' }
    );
  });

  it('falls back to mobile money when Stripe has no active row for the country', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      supported_payment_systems: [],
    });

    await expect(service.resolveRailForCountry('US')).resolves.toBe(
      'mobile_money'
    );
  });

  it('does not query Hasura for blank or unconfigured countries', async () => {
    await expect(service.resolveRailForCountry(undefined)).resolves.toBe(
      'mobile_money'
    );
    await expect(service.resolveRailForCountry('GA')).resolves.toBe(
      'mobile_money'
    );

    expect(hasuraService.executeQuery).not.toHaveBeenCalled();
  });

  it('falls back to mobile money when Hasura rail lookup fails', async () => {
    const loggerError = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation();
    hasuraService.executeQuery.mockRejectedValueOnce(new Error('network down'));

    await expect(service.resolveRailForCountry('US')).resolves.toBe(
      'mobile_money'
    );
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to resolve payment rail for US: network down'
    );
  });

  it('derives user country from business location before legacy addresses', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      businesses: [
        { business_locations: [{ address: { country: 'CA' } }] },
      ],
      business_addresses: [{ address: { country: 'US' } }],
      client_addresses: [{ address: { country: 'FR' } }],
      agent_addresses: [{ address: { country: 'GA' } }],
    });

    await expect(service.getUserCountryCode('user-1')).resolves.toBe('CA');
  });

  it('uses legacy business address before client and agent addresses', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      businesses: [{ business_locations: [] }],
      business_addresses: [{ address: { country: 'US' } }],
      client_addresses: [{ address: { country: 'FR' } }],
      agent_addresses: [{ address: { country: 'GA' } }],
    });

    await expect(service.getUserCountryCode('user-1')).resolves.toBe('US');
  });
});
