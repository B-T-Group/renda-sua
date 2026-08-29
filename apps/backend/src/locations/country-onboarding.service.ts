import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type CountryVerificationFlow = 'stripe_connect' | 'national_id';

export interface CountryOnboardingConfig {
  countryCode: string;
  signupEnabled: boolean;
  postalCodeRequired: boolean;
  verificationFlow: CountryVerificationFlow;
  defaultCurrency: string;
}

/** Fallback when table is missing or empty — matches former SIGNUP_COUNTRY_CODES. */
const FALLBACK_CONFIGS: CountryOnboardingConfig[] = [
  {
    countryCode: 'CM',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XAF',
  },
  {
    countryCode: 'GA',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XAF',
  },
  {
    countryCode: 'TG',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XOF',
  },
  {
    countryCode: 'BJ',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XOF',
  },
  {
    countryCode: 'CI',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XOF',
  },
  {
    countryCode: 'CG',
    signupEnabled: true,
    postalCodeRequired: false,
    verificationFlow: 'national_id',
    defaultCurrency: 'XAF',
  },
  {
    countryCode: 'US',
    signupEnabled: true,
    postalCodeRequired: true,
    verificationFlow: 'stripe_connect',
    defaultCurrency: 'USD',
  },
  {
    countryCode: 'CA',
    signupEnabled: true,
    postalCodeRequired: true,
    verificationFlow: 'stripe_connect',
    defaultCurrency: 'CAD',
  },
];

@Injectable()
export class CountryOnboardingService {
  private readonly logger = new Logger(CountryOnboardingService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getAllConfigs(): Promise<CountryOnboardingConfig[]> {
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        country_onboarding_configs: Array<{
          country_code: string;
          signup_enabled: boolean;
          postal_code_required: boolean;
          verification_flow: CountryVerificationFlow;
          default_currency: string;
        }>;
      }>(`
        query CountryOnboardingConfigs {
          country_onboarding_configs(order_by: { country_code: asc }) {
            country_code
            signup_enabled
            postal_code_required
            verification_flow
            default_currency
          }
        }
      `);
      const rows = result.country_onboarding_configs || [];
      if (rows.length === 0) return FALLBACK_CONFIGS;
      return rows.map((r) => ({
        countryCode: r.country_code.trim().toUpperCase(),
        signupEnabled: r.signup_enabled,
        postalCodeRequired: r.postal_code_required,
        verificationFlow: r.verification_flow,
        defaultCurrency: r.default_currency,
      }));
    } catch (error: any) {
      this.logger.warn(
        `country_onboarding_configs unavailable, using fallback: ${error?.message}`
      );
      return FALLBACK_CONFIGS;
    }
  }

  async getConfigMap(): Promise<Map<string, CountryOnboardingConfig>> {
    const configs = await this.getAllConfigs();
    return new Map(configs.map((c) => [c.countryCode, c]));
  }

  async getSignupEnabledCodes(): Promise<string[]> {
    const configs = await this.getAllConfigs();
    return configs.filter((c) => c.signupEnabled).map((c) => c.countryCode);
  }

  async getConfigForCountry(
    countryCode: string
  ): Promise<CountryOnboardingConfig | null> {
    const code = countryCode.trim().toUpperCase();
    const map = await this.getConfigMap();
    return map.get(code) ?? null;
  }
}
