import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  CONFIG_AUTO_COMPLETE_HOURS,
  CONFIG_GIFT_BUYER_CAN_CONFIRM,
  CONFIG_GRACE_MINUTES,
  CONFIG_NONSTRIPE_SUPPORT_HOURS,
  CONFIG_CLIENT_FLAG_THRESHOLD,
  CONFIG_CLIENT_FLAG_WINDOW_DAYS,
  CONFIG_MOMO_AUTO_COMPLETE_HOURS,
  CONFIG_MOMO_REMINDER_HOURS,
  CONFIG_REPORT_WINDOW_HOURS,
  DEFAULT_CLIENT_FLAG_THRESHOLD,
  DEFAULT_CLIENT_FLAG_WINDOW_DAYS,
  DEFAULT_MOMO_AUTO_COMPLETE_HOURS,
  DEFAULT_MOMO_REMINDER_HOURS,
  DEFAULT_REPORT_WINDOW_HOURS,
  DEFAULT_AUTO_COMPLETE_HOURS,
  DEFAULT_GRACE_MINUTES,
  DEFAULT_NONSTRIPE_SUPPORT_HOURS,
} from './client-confirm-delivery.constants';

export interface ClientConfirmMarketConfig {
  countryCode: string | null;
  isStripeRail: boolean;
  autoCompleteHours: number;
  graceMinutes: number;
  nonStripeSupportHours: number;
  giftBuyerCanConfirm: boolean;
  /** Non-Stripe: hours from Delivered to auto-complete (default 2). */
  momoAutoCompleteHours: number;
  /** Non-Stripe: hours from Delivered to the reminder (default 1). */
  momoReminderHours: number;
  /** Hours after completion the client can still report an issue (default 24). */
  reportWindowHours: number;
  clientFlagThreshold: number;
  clientFlagWindowDays: number;
}

interface ConfigRow {
  config_key: string;
  country_code?: string | null;
  number_value?: number | null;
  boolean_value?: boolean | null;
}

const CONFIG_KEYS = [
  CONFIG_AUTO_COMPLETE_HOURS,
  CONFIG_GRACE_MINUTES,
  CONFIG_NONSTRIPE_SUPPORT_HOURS,
  CONFIG_GIFT_BUYER_CAN_CONFIRM,
  CONFIG_MOMO_AUTO_COMPLETE_HOURS,
  CONFIG_MOMO_REMINDER_HOURS,
  CONFIG_REPORT_WINDOW_HOURS,
  CONFIG_CLIENT_FLAG_THRESHOLD,
  CONFIG_CLIENT_FLAG_WINDOW_DAYS,
];

@Injectable()
export class ClientConfirmMarketConfigService {
  private readonly logger = new Logger(ClientConfirmMarketConfigService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly paymentRouting: PaymentRoutingService
  ) {}

  async forOrder(order: {
    fulfillment_country?: string | null;
    payer_country?: string | null;
    business_location?: { address?: { country?: string | null } | null } | null;
  }): Promise<ClientConfirmMarketConfig> {
    const countryCode = this.marketCountry(order);
    const [isStripeRail, rows] = await Promise.all([
      this.isStripeMarket(countryCode),
      this.loadRows(countryCode),
    ]);
    return {
      countryCode,
      isStripeRail,
      autoCompleteHours: this.number(
        rows,
        CONFIG_AUTO_COMPLETE_HOURS,
        countryCode,
        DEFAULT_AUTO_COMPLETE_HOURS
      ),
      graceMinutes: this.number(
        rows,
        CONFIG_GRACE_MINUTES,
        countryCode,
        DEFAULT_GRACE_MINUTES
      ),
      nonStripeSupportHours: this.number(
        rows,
        CONFIG_NONSTRIPE_SUPPORT_HOURS,
        countryCode,
        DEFAULT_NONSTRIPE_SUPPORT_HOURS
      ),
      // OQ1 default true (Samuel has not locked). Flip the config row to false.
      giftBuyerCanConfirm: this.boolean(
        rows,
        CONFIG_GIFT_BUYER_CAN_CONFIRM,
        countryCode,
        true
      ),
      ...this.momoRules(rows, countryCode),
    };
  }

  private momoRules(rows: ConfigRow[], country: string | null) {
    const auto = this.number(
      rows,
      CONFIG_MOMO_AUTO_COMPLETE_HOURS,
      country,
      DEFAULT_MOMO_AUTO_COMPLETE_HOURS
    );
    const reminder = this.number(
      rows,
      CONFIG_MOMO_REMINDER_HOURS,
      country,
      DEFAULT_MOMO_REMINDER_HOURS
    );
    return {
      momoAutoCompleteHours: auto,
      // A reminder at or after auto-complete would never be useful.
      momoReminderHours: reminder < auto ? reminder : auto / 2,
      reportWindowHours: this.number(
        rows,
        CONFIG_REPORT_WINDOW_HOURS,
        country,
        DEFAULT_REPORT_WINDOW_HOURS
      ),
      clientFlagThreshold: this.number(
        rows,
        CONFIG_CLIENT_FLAG_THRESHOLD,
        country,
        DEFAULT_CLIENT_FLAG_THRESHOLD
      ),
      clientFlagWindowDays: this.number(
        rows,
        CONFIG_CLIENT_FLAG_WINDOW_DAYS,
        country,
        DEFAULT_CLIENT_FLAG_WINDOW_DAYS
      ),
    };
  }

  marketCountry(order: {
    fulfillment_country?: string | null;
    business_location?: { address?: { country?: string | null } | null } | null;
  }): string | null {
    const raw =
      order.fulfillment_country?.trim() ||
      order.business_location?.address?.country?.trim() ||
      null;
    return raw ? raw.toUpperCase() : null;
  }

  private async isStripeMarket(countryCode: string | null): Promise<boolean> {
    if (!countryCode) return false;
    const rail = await this.paymentRouting.resolveRailForCountry(countryCode);
    return rail === 'stripe';
  }

  private async loadRows(countryCode: string | null): Promise<ConfigRow[]> {
    const query = `
      query ClientConfirmMarketConfig($keys: [String!]!) {
        application_configurations(
          where: {
            config_key: { _in: $keys }
            status: { _eq: "active" }
          }
        ) {
          config_key
          country_code
          number_value
          boolean_value
        }
      }
    `;
    try {
      const res = await this.hasura.executeQuery<{
        application_configurations: ConfigRow[];
      }>(query, { keys: CONFIG_KEYS });
      return res.application_configurations ?? [];
    } catch (error: any) {
      this.logger.warn(
        `Client-confirm config load failed for ${countryCode}: ${error?.message}`
      );
      return [];
    }
  }

  private pick(rows: ConfigRow[], key: string, country: string | null): ConfigRow | undefined {
    const matches = rows.filter((r) => r.config_key === key);
    if (country) {
      const countryRow = matches.find(
        (r) => String(r.country_code ?? '').toUpperCase() === country
      );
      if (countryRow) return countryRow;
    }
    return matches.find((r) => !r.country_code);
  }

  private number(
    rows: ConfigRow[],
    key: string,
    country: string | null,
    fallback: number
  ): number {
    const value = Number(this.pick(rows, key, country)?.number_value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private boolean(
    rows: ConfigRow[],
    key: string,
    country: string | null,
    fallback: boolean
  ): boolean {
    const row = this.pick(rows, key, country);
    if (row?.boolean_value == null) return fallback;
    return row.boolean_value === true;
  }
}
