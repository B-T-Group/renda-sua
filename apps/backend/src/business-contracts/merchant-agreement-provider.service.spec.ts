import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  MerchantAgreementProviderService,
  normalizeCountryCode,
} from './merchant-agreement-provider.service';

describe('normalizeCountryCode', () => {
  it('normalizes ISO codes and common country names', () => {
    expect(normalizeCountryCode('cm')).toBe('CM');
    expect(normalizeCountryCode(' Cameroon ')).toBe('CM');
    expect(normalizeCountryCode('GABON')).toBe('GA');
    expect(normalizeCountryCode('canada')).toBe('CA');
  });

  it('returns null for empty input and passes through unknown values', () => {
    expect(normalizeCountryCode(null)).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
    expect(normalizeCountryCode('')).toBeNull();
    expect(normalizeCountryCode('France')).toBe('FRANCE');
  });
});

describe('MerchantAgreementProviderService', () => {
  let service: MerchantAgreementProviderService;
  let hasura: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new MerchantAgreementProviderService(
      hasura as unknown as HasuraSystemService
    );
  });

  describe('getProviderForCountry', () => {
    it('returns in_app when country is missing', async () => {
      await expect(service.getProviderForCountry(null)).resolves.toBe('in_app');
      await expect(service.getProviderForCountry(undefined)).resolves.toBe(
        'in_app'
      );
      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });

    it('returns in_app when config string_value is in_app', async () => {
      hasura.executeQuery.mockResolvedValue({
        application_configurations: [{ string_value: 'in_app' }],
      });

      await expect(service.getProviderForCountry('CM')).resolves.toBe('in_app');
      expect(hasura.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MerchantAgreementProvider'),
        { key: 'merchant_agreement_provider', country: 'CM' }
      );
    });

    it('defaults to boldsign when config is missing or not in_app', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        application_configurations: [],
      });
      await expect(service.getProviderForCountry('CA')).resolves.toBe(
        'boldsign'
      );

      hasura.executeQuery.mockResolvedValueOnce({
        application_configurations: [{ string_value: 'BoldSign' }],
      });
      await expect(service.getProviderForCountry('CA')).resolves.toBe(
        'boldsign'
      );
    });

    it('fails closed to boldsign when config lookup throws', async () => {
      hasura.executeQuery.mockRejectedValue(new Error('hasura down'));
      await expect(service.getProviderForCountry('GA')).resolves.toBe(
        'boldsign'
      );
    });
  });

  describe('getBusinessCountryCode', () => {
    it('prefers primary active location country over business_addresses', async () => {
      hasura.executeQuery.mockResolvedValue({
        businesses_by_pk: {
          business_locations: [
            { address: { country: 'Cameroon' } },
            { address: { country: 'CA' } },
          ],
          business_addresses: [{ address: { country: 'GA' } }],
        },
      });

      await expect(service.getBusinessCountryCode('biz-1')).resolves.toBe('CM');
    });

    it('falls back to business_addresses when locations have no country', async () => {
      hasura.executeQuery.mockResolvedValue({
        businesses_by_pk: {
          business_locations: [{ address: { country: null } }],
          business_addresses: [{ address: { country: 'gabon' } }],
        },
      });

      await expect(service.getBusinessCountryCode('biz-1')).resolves.toBe('GA');
    });

    it('returns null when business is missing or query fails', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ businesses_by_pk: null });
      await expect(service.getBusinessCountryCode('missing')).resolves.toBeNull();

      hasura.executeQuery.mockRejectedValueOnce(new Error('timeout'));
      await expect(service.getBusinessCountryCode('biz-1')).resolves.toBeNull();
    });
  });

  describe('usesInAppAgreement', () => {
    it('is true only when resolved provider is in_app', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          businesses_by_pk: {
            business_locations: [{ address: { country: 'CM' } }],
            business_addresses: [],
          },
        })
        .mockResolvedValueOnce({
          application_configurations: [{ string_value: 'in_app' }],
        });

      await expect(service.usesInAppAgreement('biz-cm')).resolves.toBe(true);

      hasura.executeQuery
        .mockResolvedValueOnce({
          businesses_by_pk: {
            business_locations: [{ address: { country: 'CA' } }],
            business_addresses: [],
          },
        })
        .mockResolvedValueOnce({
          application_configurations: [],
        });

      await expect(service.usesInAppAgreement('biz-ca')).resolves.toBe(false);
    });
  });
});
