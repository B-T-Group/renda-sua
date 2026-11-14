import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';

const FLAG_KEY = 'rental_inspection_enabled';
const ALLOW_SELF_BOOKING_KEY = 'rentals_inspection_allow_self_booking';
export const CARD_WINDOW_GUARD_KEY = 'rentals_card_window_guard_enabled';
export const PICKUP_PHOTO_RULES_KEY = 'rentals_pickup_photo_rules_enabled';
export const CARD_CHARGE_AT_PICKUP_KEY = 'rentals_card_charge_at_pickup_enabled';

/**
 * Country row wins over the global row. Missing or unreadable config stays off.
 */
@Injectable()
export class RentalInspectionFlags {
  private readonly logger = new Logger(RentalInspectionFlags.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async isEnabled(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig(FLAG_KEY, countryCode, false);
  }

  /** Country row, then the global row. Missing or unreadable stays false. */
  async chargeAtPickupEnabled(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig('rentals_card_charge_at_pickup_enabled', countryCode, false);
  }

  /** Country row, then the global row. Missing or unreadable stays false. */
  async allowSelfBooking(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig(ALLOW_SELF_BOOKING_KEY, countryCode, false);
  }

  /** Date-picker guard and create-time rejection. Seeded false. */
  async cardWindowGuardEnabled(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig(CARD_WINDOW_GUARD_KEY, countryCode, false);
  }

  /** Pickup-day camera, server timestamp, and last-return guide. Seeded false. */
  async pickupPhotoRulesEnabled(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig(PICKUP_PHOTO_RULES_KEY, countryCode, false);
  }

  /**
   * Hook for charge-at-pickup. Seeded false. When on, an inspected Stripe booking
   * is not limited by the 6-day authorization window. The payment flow is separate.
   */
  async cardChargeAtPickupEnabled(countryCode?: string | null): Promise<boolean> {
    return this.booleanConfig(CARD_CHARGE_AT_PICKUP_KEY, countryCode, false);
  }

  async numberConfig(key: string, countryCode: string | null | undefined, fallback: number): Promise<number> {
    const value = await this.readNumber(key, countryCode);
    return value == null ? fallback : value;
  }

  private async booleanConfig(
    key: string,
    countryCode: string | null | undefined,
    fallback: boolean
  ): Promise<boolean> {
    try {
      const row = await this.readRow(key, countryCode);
      if (!row) return fallback;
      return row.boolean_value === true;
    } catch (error: any) {
      this.logger.warn(`inspection flag ${key}: ${error?.message ?? error}`);
      return fallback;
    }
  }

  private async readNumber(key: string, countryCode?: string | null): Promise<number | null> {
    try {
      const row = await this.readRow(key, countryCode);
      const value = Number(row?.number_value);
      return Number.isFinite(value) ? value : null;
    } catch (error: any) {
      this.logger.warn(`inspection config ${key}: ${error?.message ?? error}`);
      return null;
    }
  }

  private async readRow(
    key: string,
    countryCode?: string | null
  ): Promise<{ boolean_value?: boolean | null; number_value?: number | null } | null> {
    const country = countryCode?.trim() || undefined;
    const query = `
      query InspectionConfig($key: String!${country ? ', $country: String!' : ''}) {
        application_configurations(
          where: {
            config_key: { _eq: $key }
            status: { _eq: "active" }
            _or: [
              ${country ? '{ country_code: { _eq: $country } }' : ''}
              { country_code: { _is_null: true } }
            ]
          }
          order_by: { country_code: desc_nulls_last }
          limit: 1
        ) { boolean_value number_value }
      }
    `;
    const result = await this.hasura.executeQuery<{
      application_configurations: Array<{
        boolean_value?: boolean | null;
        number_value?: number | null;
      }>;
    }>(query, country ? { key, country } : { key });
    return result.application_configurations?.[0] ?? null;
  }
}
