import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type MerchantAgreementProvider = 'boldsign' | 'in_app';

const CONFIG_KEY = 'merchant_agreement_provider';

/** Normalize address.country values to ISO alpha-2 when possible. */
export function normalizeCountryCode(
  country: string | null | undefined
): string | null {
  if (!country) return null;
  const raw = country.trim().toUpperCase();
  if (raw.length === 2) return raw;
  const map: Record<string, string> = {
    CAMEROON: 'CM',
    GABON: 'GA',
    CANADA: 'CA',
  };
  return map[raw] ?? raw;
}

@Injectable()
export class MerchantAgreementProviderService {
  private readonly logger = new Logger(MerchantAgreementProviderService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Resolve business country from the primary active location, then any active
   * location, then business_addresses as a last resort.
   */
  async getBusinessCountryCode(businessId: string): Promise<string | null> {
    const query = `
      query GetBusinessCountry($businessId: uuid!) {
        businesses_by_pk(id: $businessId) {
          business_locations(
            where: { is_active: { _eq: true } }
            order_by: [{ is_primary: desc }]
          ) {
            address { country }
          }
          business_addresses {
            address { country }
          }
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        businessId,
      });
      const biz = response.businesses_by_pk;
      if (!biz) return null;

      for (const loc of biz.business_locations ?? []) {
        const code = normalizeCountryCode(loc?.address?.country);
        if (code) return code;
      }
      for (const row of biz.business_addresses ?? []) {
        const code = normalizeCountryCode(row?.address?.country);
        if (code) return code;
      }
      return null;
    } catch (error: any) {
      this.logger.warn(
        `Failed to resolve country for business ${businessId}: ${error?.message}`
      );
      return null;
    }
  }

  /**
   * Resolve agreement provider for a country.
   * - Missing country → in_app (do not send BoldSign until country is known)
   * - Absence of a config row → in_app
   * - Explicit boldsign string_value → boldsign
   * - Lookup errors with a known country → in_app
   */
  async getProviderForCountry(
    countryCode: string | null | undefined
  ): Promise<MerchantAgreementProvider> {
    const code = normalizeCountryCode(countryCode);
    if (!code) return 'in_app';

    const query = `
      query MerchantAgreementProvider($key: String!, $country: String!) {
        application_configurations(
          where: {
            config_key: { _eq: $key }
            country_code: { _eq: $country }
            status: { _eq: "active" }
          }
          limit: 1
        ) {
          string_value
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        key: CONFIG_KEY,
        country: code,
      });
      const value =
        response.application_configurations?.[0]?.string_value?.toLowerCase();
      return value === 'boldsign' ? 'boldsign' : 'in_app';
    } catch (error: any) {
      this.logger.warn(
        `Failed to load merchant_agreement_provider for ${code}: ${error?.message}`
      );
      return 'in_app';
    }
  }

  async getProviderForBusiness(
    businessId: string
  ): Promise<{ provider: MerchantAgreementProvider; countryCode: string | null }> {
    const countryCode = await this.getBusinessCountryCode(businessId);
    const provider = await this.getProviderForCountry(countryCode);
    return { provider, countryCode };
  }

  async usesInAppAgreement(businessId: string): Promise<boolean> {
    const { provider } = await this.getProviderForBusiness(businessId);
    return provider === 'in_app';
  }
}
