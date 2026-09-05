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

  it('reads the user country from users.country without an address lookup', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      users_by_pk: { country: 'CA' },
    });

    await expect(service.getUserCountryCode('user-1')).resolves.toBe('CA');
    expect(hasuraService.executeQuery).toHaveBeenCalledTimes(1);
    expect(hasuraService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('users_by_pk'),
      { userId: 'user-1' }
    );
  });

  it('falls back to address-derived country when users.country is null', async () => {
    hasuraService.executeQuery
      .mockResolvedValueOnce({ users_by_pk: { country: null } })
      .mockResolvedValueOnce({
        businesses: [],
        business_addresses: [],
        client_addresses: [{ address: { country: 'US' } }],
        agent_addresses: [],
      });

    await expect(service.getUserCountryCode('user-1')).resolves.toBe('US');
    expect(hasuraService.executeQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('client_addresses'),
      { userId: 'user-1' }
    );
  });

  it('prefers the business location address in the user fallback', async () => {
    hasuraService.executeQuery
      .mockResolvedValueOnce({ users_by_pk: null })
      .mockResolvedValueOnce({
        businesses: [
          { business_locations: [{ address: { country: 'CA' } }] },
        ],
        business_addresses: [{ address: { country: 'CM' } }],
        client_addresses: [],
        agent_addresses: [],
      });

    await expect(service.getUserCountryCode('user-1')).resolves.toBe('CA');
  });

  it('returns null when the user has no country and no addresses', async () => {
    hasuraService.executeQuery
      .mockResolvedValueOnce({ users_by_pk: null })
      .mockResolvedValueOnce({
        businesses: [],
        business_addresses: [],
        client_addresses: [],
        agent_addresses: [],
      });

    await expect(service.getUserCountryCode('user-1')).resolves.toBeNull();
  });

  it('reads the business country from the owner users.country', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      businesses_by_pk: {
        user: { country: 'CM' },
        business_locations: [{ address: { country: 'US' } }],
      },
    });

    await expect(service.getBusinessCountryCode('biz-1')).resolves.toBe('CM');
  });

  it('falls back to the primary location address when the owner has no country', async () => {
    hasuraService.executeQuery.mockResolvedValueOnce({
      businesses_by_pk: {
        user: { country: null },
        business_locations: [{ address: { country: 'US' } }],
      },
    });

    await expect(service.getBusinessCountryCode('biz-1')).resolves.toBe('US');
  });

  it('resolves the Stripe rail from the fallback country for unbackfilled owners', async () => {
    hasuraService.executeQuery
      .mockResolvedValueOnce({
        businesses_by_pk: {
          user: { country: null },
          business_locations: [{ address: { country: 'US' } }],
        },
      })
      .mockResolvedValueOnce({
        supported_payment_systems: [{ id: 'stripe-us' }],
      });

    await expect(service.resolveRailForBusiness('biz-1')).resolves.toBe(
      'stripe'
    );
  });

  describe('resolveOrderRail (diaspora checkout)', () => {
    it('keeps the seller rail when the seller is already on Stripe', async () => {
      await expect(
        service.resolveOrderRail({ sellerCountry: 'CA', payerCountry: 'US' })
      ).resolves.toEqual({
        rail: 'stripe',
        source: 'seller',
        isDiaspora: false,
      });
    });

    it('puts a mobile-money merchant on Stripe for a payer billing from CA', async () => {
      await expect(
        service.resolveOrderRail({ sellerCountry: 'GA', payerCountry: 'CA' })
      ).resolves.toEqual({ rail: 'stripe', source: 'payer', isDiaspora: true });
    });

    it('stays on mobile money when both sides are mobile-money countries', async () => {
      await expect(
        service.resolveOrderRail({ sellerCountry: 'GA', payerCountry: 'CM' })
      ).resolves.toEqual({
        rail: 'mobile_money',
        source: 'seller',
        isDiaspora: false,
      });
      expect(hasuraService.executeQuery).not.toHaveBeenCalled();
    });

    it('stays on mobile money when the payer country is unknown', async () => {
      await expect(
        service.resolveOrderRail({ sellerCountry: 'CM', payerCountry: null })
      ).resolves.toEqual({
        rail: 'mobile_money',
        source: 'seller',
        isDiaspora: false,
      });
    });

    it('stays on mobile money when diaspora checkout is disabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'stripe') return { enabledCountries: ['US', 'CA'] };
        if (key === 'diaspora') return { enabled: false, payerCountries: [] };
        return undefined;
      });

      await expect(
        service.resolveOrderRail({ sellerCountry: 'GA', payerCountry: 'CA' })
      ).resolves.toEqual({
        rail: 'mobile_money',
        source: 'seller',
        isDiaspora: false,
      });
    });

    it('honours an explicit payer country allowlist that excludes the payer', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'stripe') return { enabledCountries: ['US', 'CA'] };
        if (key === 'diaspora') return { enabled: true, payerCountries: ['US'] };
        return undefined;
      });

      await expect(
        service.resolveOrderRail({ sellerCountry: 'GA', payerCountry: 'CA' })
      ).resolves.toEqual({
        rail: 'mobile_money',
        source: 'seller',
        isDiaspora: false,
      });
    });

    it('stays on mobile money when the payer country has no active Stripe row', async () => {
      hasuraService.executeQuery.mockResolvedValue({
        supported_payment_systems: [],
      });

      await expect(
        service.resolveOrderRail({ sellerCountry: 'GA', payerCountry: 'CA' })
      ).resolves.toEqual({
        rail: 'mobile_money',
        source: 'seller',
        isDiaspora: false,
      });
    });
  });

  describe('resolveTrustedPayerCountry', () => {
    it('refuses a local spoof when the profile country is a diaspora payer', async () => {
      await expect(
        service.resolveTrustedPayerCountry({
          profileCountry: 'CA',
          requestedCountry: 'GA',
        })
      ).resolves.toBe('CA');
    });

    it('lets a traveller upgrade from a local profile to a Stripe billing country', async () => {
      await expect(
        service.resolveTrustedPayerCountry({
          profileCountry: 'GA',
          requestedCountry: 'CA',
        })
      ).resolves.toBe('CA');
    });
  });
});
