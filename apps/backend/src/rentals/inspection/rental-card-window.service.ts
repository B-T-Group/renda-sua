import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { PaymentRoutingService } from '../../stripe-payments/payment-routing.service';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import { DEFAULT_STRIPE_REVIEW_HOURS, STRIPE_AUTH_WINDOW_DAYS } from './rental-inspection.policy';
import { resolveCardPaymentPolicy, type ListingCardWindow } from '../rental-card-window';

const REVIEW_HOURS_KEY = 'rental_inspection_stripe_review_hours';

const FALLBACK_TIMEZONE: Record<string, string> = {
  CM: 'Africa/Douala',
  GA: 'Africa/Libreville',
  TG: 'Africa/Lome',
  CA: 'America/Toronto',
  US: 'America/New_York',
  PH: 'Asia/Manila',
};

@Injectable()
export class RentalCardWindowService {
  constructor(
    private readonly routing: PaymentRoutingService,
    private readonly flags: RentalInspectionFlags,
    private readonly hasura: HasuraSystemService
  ) {}

  async forCountry(country: string | null | undefined, now = new Date()): Promise<ListingCardWindow> {
    const code = country?.trim().toUpperCase() || null;
    const [rail, inspectionEnabled, reviewHours, timezone, chargeAtPickupEnabled] = await Promise.all([
      this.rail(code),
      this.flags.isEnabled(code),
      this.flags.numberConfig(REVIEW_HOURS_KEY, code, DEFAULT_STRIPE_REVIEW_HOURS),
      this.timezone(code),
      this.chargeAtPickup(code),
    ]);
    const policy = resolveCardPaymentPolicy({
      rail,
      timezone,
      now,
      reviewHours,
      chargeAtPickupEnabled,
      inspected: inspectionEnabled,
    });
    return { ...policy, inspection_enabled: inspectionEnabled, card_auth_window_days: STRIPE_AUTH_WINDOW_DAYS };
  }

  async forCountries(
    countries: Array<string | null | undefined>,
    now = new Date()
  ): Promise<Map<string, ListingCardWindow>> {
    const codes = [...new Set(countries.map((country) => country?.trim().toUpperCase() || ''))];
    const entries = await Promise.all(
      codes.map(async (code) => [code, await this.forCountry(code || null, now)] as const)
    );
    return new Map(entries);
  }

  private rail(code: string | null) {
    return code ? this.routing.resolveRailForCountry(code) : Promise.resolve('mobile_money' as const);
  }

  private chargeAtPickup(code: string | null): Promise<boolean> {
    if (!this.flags.cardChargeAtPickupEnabled) return Promise.resolve(false);
    return this.flags.cardChargeAtPickupEnabled(code);
  }

  private async timezone(code: string | null): Promise<string> {
    if (!code) return 'Africa/Douala';
    const configured = await this.readTimezone(code);
    return configured || FALLBACK_TIMEZONE[code] || 'Africa/Douala';
  }

  private async readTimezone(code: string): Promise<string | null> {
    try {
      const result = await this.hasura.executeQuery<{
        country_delivery_configs: Array<{ config_value?: string | null }>;
      }>(TIMEZONE_QUERY, { country: code });
      const value = result.country_delivery_configs?.[0]?.config_value?.trim();
      return value || null;
    } catch {
      return null;
    }
  }
}

const TIMEZONE_QUERY = `
  query ListingTimezone($country: bpchar!) {
    country_delivery_configs(
      where: { country_code: { _eq: $country }, config_key: { _eq: "timezone" } }
      limit: 1
    ) { config_value }
  }
`;
