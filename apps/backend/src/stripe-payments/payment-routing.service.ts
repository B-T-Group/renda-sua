import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiasporaConfig, StripeConfig } from '../config/configuration';
import {
  normalizeCountryCode,
  trustedPayerCountry,
} from '../diaspora/diaspora-order.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type PaymentRail = 'stripe' | 'mobile_money';

/**
 * Which side of the order decided the rail. `seller` is the long-standing
 * behavior; `payer` means a diaspora payer's card country unlocked Stripe for a
 * merchant who is otherwise on mobile money.
 */
export type PaymentRailSource = 'seller' | 'payer';

export interface OrderRailResolution {
  rail: PaymentRail;
  source: PaymentRailSource;
  /** True when the payer's country, not the seller's, put this order on Stripe. */
  isDiaspora: boolean;
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

  private get diasporaConfig(): DiasporaConfig | undefined {
    return this.configService.get<DiasporaConfig>('diaspora');
  }

  /**
   * Payer countries allowed to fund a mobile-money merchant by card. Defaults
   * to the Stripe country list so there is only one list to keep current.
   */
  private get diasporaPayerCountries(): string[] {
    const configured = this.diasporaConfig?.payerCountries ?? [];
    return configured.length > 0 ? configured : this.enabledCountries;
  }

  /**
   * Resolve the rail for a whole order. The seller's country decides first, so
   * every existing order routes exactly as before. Only when the seller is on
   * mobile money and the payer is billing from an allowed Stripe country does
   * the payer's country take over — that is the diaspora path, and the money
   * still lands on the platform Stripe balance rather than the merchant's bank.
   */
  async resolveOrderRail(params: {
    sellerCountry?: string | null;
    payerCountry?: string | null;
  }): Promise<OrderRailResolution> {
    const sellerRail = await this.resolveRailForCountry(
      params.sellerCountry ?? undefined
    );
    if (sellerRail === 'stripe') {
      return { rail: 'stripe', source: 'seller', isDiaspora: false };
    }
    if (!(await this.isDiasporaPayer(params.payerCountry))) {
      return { rail: sellerRail, source: 'seller', isDiaspora: false };
    }
    return { rail: 'stripe', source: 'payer', isDiaspora: true };
  }

  /**
   * True when this payer country may fund a mobile-money merchant by card.
   * Requires the feature flag, the country allowlist, and an active `stripe`
   * row in `supported_payment_systems` for that country.
   */
  async isDiasporaPayer(payerCountry?: string | null): Promise<boolean> {
    if (this.diasporaConfig?.enabled === false) return false;
    const code = payerCountry?.trim().toUpperCase();
    if (!code || code.length !== 2) return false;
    if (!this.diasporaPayerCountries.includes(code)) return false;
    return (await this.resolveRailForCountry(code)) === 'stripe';
  }

  /**
   * Payer country for rail + timing gates. Requested billing country may
   * upgrade a local profile into diaspora; it cannot downgrade a diaspora
   * profile into mobile money / pay-at-delivery.
   */
  async resolveTrustedPayerCountry(params: {
    profileCountry?: string | null;
    requestedCountry?: string | null;
  }): Promise<string | null> {
    const profile = normalizeCountryCode(params.profileCountry);
    const requested = normalizeCountryCode(params.requestedCountry);
    const [profileIsDiaspora, requestedIsDiaspora] = await Promise.all([
      this.isDiasporaPayer(profile),
      this.isDiasporaPayer(requested),
    ]);
    return trustedPayerCountry({
      profileCountry: profile,
      requestedCountry: requested,
      profileIsDiaspora,
      requestedIsDiaspora,
    });
  }

  /** Resolve the rail for a user based on their country. */
  async resolveRailForUser(userId: string): Promise<PaymentRail> {
    const countryCode = await this.getUserCountryCode(userId);
    return this.resolveRailForCountry(countryCode ?? undefined);
  }

  /** Resolve the rail for a business based on its owner's country. */
  async resolveRailForBusiness(businessId: string): Promise<PaymentRail> {
    const countryCode = await this.getBusinessCountryCode(businessId);
    return this.resolveRailForCountry(countryCode ?? undefined);
  }

  /**
   * A business's ISO alpha-2 country is its owner's `users.country`, falling
   * back to the primary active business location address for owners whose
   * country has not been backfilled. Keep the fallback order aligned with
   * CheckoutPreflightService (user country, then location address).
   */
  async getBusinessCountryCode(businessId: string): Promise<string | null> {
    const query = `
      query GetBusinessCountry($businessId: uuid!) {
        businesses_by_pk(id: $businessId) {
          user { country }
          business_locations(
            where: { is_active: { _eq: true } }
            order_by: { is_primary: desc }
            limit: 1
          ) {
            address { country }
          }
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, {
      businessId,
    });
    const business = response.businesses_by_pk;
    return (
      business?.user?.country ??
      business?.business_locations?.[0]?.address?.country ??
      null
    );
  }

  /**
   * A user's ISO alpha-2 country is the canonical `users.country` column,
   * falling back to address-derived resolution for unbackfilled users.
   */
  async getUserCountryCode(userId: string): Promise<string | null> {
    const query = `
      query GetUserCountry($userId: uuid!) {
        users_by_pk(id: $userId) { country }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    return (
      response.users_by_pk?.country ??
      (await this.getUserAddressCountryCode(userId))
    );
  }

  /**
   * Legacy address-derived country: business primary location, then
   * business/client/agent active addresses.
   */
  private async getUserAddressCountryCode(
    userId: string
  ): Promise<string | null> {
    const query = `
      query GetUserAddressCountry($userId: uuid!) {
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
