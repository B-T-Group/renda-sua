import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type PaymentRail = 'stripe' | 'mobile_money';

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
    const countryCode = await this.getUserCountryCode(userId);
    return this.resolveRailForCountry(countryCode ?? undefined);
  }

  /**
   * Derive a user's ISO alpha-2 country code from their primary business
   * location address (for businesses) or their personal address (for
   * agents/clients).
   */
  async getUserCountryCode(userId: string): Promise<string | null> {
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
        business_addresses(
          where: {
            business: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
          limit: 1
        ) {
          address { country }
        }
        client_addresses(
          where: {
            client: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
          limit: 1
        ) {
          address { country }
        }
        agent_addresses(
          where: {
            agent: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
          limit: 1
        ) {
          address { country }
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    return (
      response.businesses?.[0]?.business_locations?.[0]?.address?.country ||
      response.business_addresses?.[0]?.address?.country ||
      response.client_addresses?.[0]?.address?.country ||
      response.agent_addresses?.[0]?.address?.country ||
      null
    );
  }
}
