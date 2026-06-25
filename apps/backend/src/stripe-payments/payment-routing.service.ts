import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type PaymentRail = 'stripe' | 'mobile_money';

export interface UserCountryInfo {
  countryName: string;
  countryCode: string;
  currencyCode: string;
}

@Injectable()
export class PaymentRoutingService {
  private readonly logger = new Logger(PaymentRoutingService.name);

  constructor(
    private readonly hasuraService: HasuraSystemService,
    private readonly configService: ConfigService
  ) {}

  private get enabledCountries(): string[] {
    return (
      this.configService.get<StripeConfig>('stripe')?.enabledCountries ?? []
    );
  }

  /**
   * Resolve the payment rail for a given ISO alpha-2 country code. Stripe wins
   * when the country is configured AND there is an active `stripe` entry in
   * `supported_payment_systems`.
   */
  async resolveRailForCountry(
    countryCode: string | undefined
  ): Promise<PaymentRail> {
    if (!countryCode) return 'mobile_money';
    const code = countryCode.trim().toUpperCase();
    if (!this.enabledCountries.includes(code)) return 'mobile_money';
    const query = `
      query StripeEnabledForCountry($country: bpchar!) {
        supported_payment_systems(
          where: {
            name: { _eq: "stripe" }
            country: { _eq: $country }
            active: { _eq: true }
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    try {
      const response = await this.hasuraService.executeQuery(query, {
        country: code,
      });
      const enabled = (response.supported_payment_systems || []).length > 0;
      return enabled ? 'stripe' : 'mobile_money';
    } catch (error: any) {
      this.logger.error(
        `Failed to resolve payment rail for ${code}: ${error?.message || error}`
      );
      return 'mobile_money';
    }
  }

  /** Resolve the rail for a user based on their derived country. */
  async resolveRailForUser(userId: string): Promise<PaymentRail> {
    const info = await this.getUserCountryInfo(userId);
    return this.resolveRailForCountry(info?.countryCode);
  }

  /**
   * Derive a user's country from their primary business location address (for
   * businesses) or their personal address (for agents/clients), matched
   * against `supported_country_states` to obtain ISO country + currency codes.
   */
  async getUserCountryInfo(userId: string): Promise<UserCountryInfo | null> {
    const countryName = await this.getUserCountryName(userId);
    if (!countryName) return null;
    return this.matchCountry(countryName);
  }

  private async getUserCountryName(userId: string): Promise<string | null> {
    const query = `
      query GetUserCountryName($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          business_locations(
            where: { is_active: { _eq: true } }
            order_by: { is_primary: desc }
            limit: 1
          ) {
            address { country }
          }
        }
        addresses(
          where: {
            entity_type: { _eq: "user" }
            entity_id: { _eq: $userId }
          }
          limit: 1
        ) {
          country
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    const businessCountry =
      response.businesses?.[0]?.business_locations?.[0]?.address?.country;
    const userCountry = response.addresses?.[0]?.country;
    return businessCountry || userCountry || null;
  }

  private async matchCountry(
    countryName: string
  ): Promise<UserCountryInfo | null> {
    const query = `
      query MatchCountry($name: String!) {
        supported_country_states(
          where: { country_name: { _ilike: $name } }
          limit: 1
        ) {
          country_code
          country_name
          currency_code
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, {
      name: countryName.trim(),
    });
    const row = (response.supported_country_states || [])[0];
    if (!row) return null;
    return {
      countryName: row.country_name,
      countryCode: row.country_code,
      currencyCode: row.currency_code,
    };
  }
}
