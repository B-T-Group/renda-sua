import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { DatabaseService } from '../database/database.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { LaunchPromoSlot } from './launch-promo.types';

interface ClaimRow {
  id: string;
  business_id: string;
  country_code: string;
  status: string;
  orders_remaining: number;
  claimed_at: Date | string;
}

interface SlotRow {
  id: string;
  business_id: string;
  country_code: string;
  status: string;
  orders_remaining: number;
  claimed_at: string;
  confirmed_at: string | null;
  released_at: string | null;
}

@Injectable()
export class LaunchPromoService {
  private readonly logger = new Logger(LaunchPromoService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  async claimSlotIfAvailable(
    businessId: string,
    countryCode?: string | null
  ): Promise<LaunchPromoSlot | null> {
    const country = (countryCode ?? '').trim().toUpperCase();
    if (!businessId || !country) return null;

    try {
      const rows = await this.databaseService.query<ClaimRow>(
        `SELECT id, business_id, country_code, status, orders_remaining, claimed_at
         FROM public.claim_business_launch_promo_slot($1::uuid, $2::text)`,
        [businessId, country]
      );
      const row = rows[0];
      if (!row) return null;
      return this.toSlot(row, country);
    } catch (error: any) {
      this.logger.warn(
        `Launch promo claim failed for business ${businessId}: ${error?.message}`
      );
      return null;
    }
  }

  async confirmSlot(businessId: string): Promise<void> {
    if (!businessId) return;
    try {
      await this.databaseService.query(
        `UPDATE public.business_launch_promo_slots
         SET status = 'confirmed',
             confirmed_at = COALESCE(confirmed_at, now()),
             updated_at = now()
         WHERE business_id = $1::uuid
           AND status = 'claimed'`,
        [businessId]
      );
    } catch (error: any) {
      this.logger.warn(
        `Launch promo confirm failed for ${businessId}: ${error?.message}`
      );
    }
  }

  /**
   * Atomically consume one promo order at settlement. Idempotent per order_id.
   */
  async consumePromoOrder(
    businessId: string,
    orderId: string
  ): Promise<boolean> {
    if (!businessId || !orderId) return false;
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        `SELECT id FROM public.consume_business_launch_promo_order($1::uuid, $2::uuid)`,
        [businessId, orderId]
      );
      return rows.length > 0;
    } catch (error: any) {
      this.logger.warn(
        `Launch promo consume failed for ${businessId}: ${error?.message}`
      );
      return false;
    }
  }

  /** Restore one consumed promo order when settlement fails after consume. */
  async restorePromoOrder(businessId: string, orderId: string): Promise<void> {
    if (!businessId || !orderId) return;
    try {
      await this.databaseService.query(
        `SELECT public.restore_business_launch_promo_order($1::uuid, $2::uuid)`,
        [businessId, orderId]
      );
    } catch (error: any) {
      this.logger.warn(
        `Launch promo restore failed for ${businessId}: ${error?.message}`
      );
    }
  }

  async getSlotForBusiness(
    businessId: string
  ): Promise<LaunchPromoSlot | null> {
    if (!businessId) return null;
    const query = `
      query LaunchPromoSlot($businessId: uuid!) {
        business_launch_promo_slots(
          where: {
            business_id: { _eq: $businessId }
            status: { _in: ["claimed", "confirmed"] }
          }
          limit: 1
        ) {
          id
          business_id
          country_code
          status
          orders_remaining
          claimed_at
          confirmed_at
          released_at
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        businessId,
      });
      const row = result?.business_launch_promo_slots?.[0] as SlotRow | undefined;
      if (!row) return null;
      return this.toSlot(row, row.country_code);
    } catch (error: any) {
      this.logger.warn(
        `Launch promo fetch failed for ${businessId}: ${error?.message}`
      );
      return null;
    }
  }

  async releaseExpiredSlots(): Promise<{ released: number }> {
    try {
      const rows = await this.databaseService.query<{ id: string; country_code: string }>(
        `WITH windows AS (
           SELECT DISTINCT ON (country_code)
             country_code,
             COALESCE(number_value, 30)::int AS window_days
           FROM public.application_configurations
           WHERE config_key = 'launch_promo_identification_window_days'
             AND status = 'active'
         )
         UPDATE public.business_launch_promo_slots s
         SET status = 'released',
             released_at = now(),
             updated_at = now()
         FROM windows w
         WHERE s.country_code = w.country_code
           AND s.status = 'claimed'
           AND s.claimed_at < now() - make_interval(days => w.window_days)
         RETURNING s.id, s.country_code`
      );
      this.logger.log(`Released ${rows.length} expired launch promo slots`);
      return { released: rows.length };
    } catch (error: any) {
      this.logger.error(`Failed to release expired launch promo slots: ${error?.message}`);
      throw error;
    }
  }

  private async toSlot(
    row: {
      id: string;
      business_id: string;
      country_code: string;
      status: string;
      orders_remaining: number;
      claimed_at: Date | string;
      confirmed_at?: Date | string | null;
      released_at?: Date | string | null;
    },
    country: string
  ): Promise<LaunchPromoSlot> {
    const [limit, orders, windowDays] = await Promise.all([
      this.readNumberConfig('launch_promo_business_limit', country),
      this.readNumberConfig('launch_promo_zero_commission_orders', country),
      this.readNumberConfig('launch_promo_identification_window_days', country),
    ]);
    return {
      id: row.id,
      businessId: row.business_id,
      countryCode: row.country_code,
      status: row.status as LaunchPromoSlot['status'],
      ordersRemaining: Number(row.orders_remaining),
      claimedAt: this.toIso(row.claimed_at),
      confirmedAt: row.confirmed_at ? this.toIso(row.confirmed_at) : null,
      releasedAt: row.released_at ? this.toIso(row.released_at) : null,
      businessLimit: limit,
      zeroCommissionOrders: orders,
      identificationWindowDays: windowDays,
    };
  }

  private async readNumberConfig(
    key: string,
    countryCode: string
  ): Promise<number | null> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        key,
        countryCode
      );
      if (config?.status !== 'active' || config.number_value == null) return null;
      return Number(config.number_value);
    } catch {
      return null;
    }
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : String(value);
  }
}
