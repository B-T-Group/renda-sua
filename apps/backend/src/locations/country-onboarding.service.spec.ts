import { CountryOnboardingService } from './country-onboarding.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('CountryOnboardingService fallbacks', () => {
  let hasura: { executeQuery: jest.Mock };
  let service: CountryOnboardingService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new CountryOnboardingService(
      hasura as unknown as HasuraSystemService
    );
  });

  function expectSeededCfaMarkets(
    configs: Awaited<ReturnType<CountryOnboardingService['getAllConfigs']>>
  ) {
    const byCode = Object.fromEntries(
      configs.map((config) => [config.countryCode, config])
    );
    expect(byCode.TG).toEqual({
      countryCode: 'TG',
      signupEnabled: true,
      postalCodeRequired: false,
      verificationFlow: 'national_id',
      defaultCurrency: 'XOF',
    });
    expect(byCode.BJ.defaultCurrency).toBe('XOF');
    expect(byCode.CI.defaultCurrency).toBe('XOF');
    expect(byCode.CG).toEqual({
      countryCode: 'CG',
      signupEnabled: true,
      postalCodeRequired: false,
      verificationFlow: 'national_id',
      defaultCurrency: 'XAF',
    });
    expect(byCode.CM.defaultCurrency).toBe('XAF');
    expect(byCode.CA.verificationFlow).toBe('stripe_connect');
  }

  it('seeds Togo, Benin, Côte d\'Ivoire, and Congo when the table is empty', async () => {
    hasura.executeQuery.mockResolvedValue({ country_onboarding_configs: [] });

    const configs = await service.getAllConfigs();

    expectSeededCfaMarkets(configs);
    await expect(service.getSignupEnabledCodes()).resolves.toEqual(
      expect.arrayContaining(['TG', 'BJ', 'CI', 'CG', 'CM', 'GA', 'US', 'CA'])
    );
  });

  it('uses the same seed when Hasura is unavailable', async () => {
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation();
    hasura.executeQuery.mockRejectedValue(new Error('relation missing'));

    expectSeededCfaMarkets(await service.getAllConfigs());
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('using fallback: relation missing')
    );
  });

  it('prefers persisted rows over the hardcoded seed', async () => {
    hasura.executeQuery.mockResolvedValue({
      country_onboarding_configs: [
        {
          country_code: ' tg ',
          signup_enabled: false,
          postal_code_required: true,
          verification_flow: 'national_id',
          default_currency: 'XOF',
        },
      ],
    });

    await expect(service.getConfigForCountry('tg')).resolves.toEqual({
      countryCode: 'TG',
      signupEnabled: false,
      postalCodeRequired: true,
      verificationFlow: 'national_id',
      defaultCurrency: 'XOF',
    });
    await expect(service.getSignupEnabledCodes()).resolves.toEqual([]);
    await expect(service.getConfigForCountry('BJ')).resolves.toBeNull();
  });
});
