import { Injectable } from '@nestjs/common';
import { currencyForReferralPayout } from '../business-referral-payouts/business-referral-payout.constants';
import { CommissionsService } from '../commissions/commissions.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  deliveryPayRates,
  groupDeliveryTrips,
  periodBounds,
} from './agent-delivery-earnings.mapper';
import type {
  DeliveryEarnings,
  DeliveryEarningsPeriod,
  DeliveryPayoutRow,
  DeliveryPayRates,
} from './agent-delivery-earnings.types';

const ALL_PAYOUTS = `
  query AgentDeliveryPayouts($userId: uuid!, $currency: currency_enum!) {
    commission_payouts(
      where: {
        recipient_user_id: { _eq: $userId }
        recipient_type: { _eq: "agent" }
        currency: { _eq: $currency }
        commission_type: { _in: ["base_delivery_fee", "per_km_delivery_fee"] }
      }
      order_by: { created_at: desc }
    ) {
      amount
      commission_type
      created_at
      order { id order_number actual_delivery_time }
    }
  }
`;

const WINDOW_PAYOUTS = `
  query AgentDeliveryPayoutsInWindow(
    $userId: uuid!
    $currency: currency_enum!
    $start: timestamptz!
    $end: timestamptz!
  ) {
    commission_payouts(
      where: {
        recipient_user_id: { _eq: $userId }
        recipient_type: { _eq: "agent" }
        currency: { _eq: $currency }
        commission_type: { _in: ["base_delivery_fee", "per_km_delivery_fee"] }
        created_at: { _gte: $start, _lt: $end }
      }
      order_by: { created_at: desc }
    ) {
      amount
      commission_type
      created_at
      order { id order_number actual_delivery_time }
    }
  }
`;

interface PayoutQueryRow {
  amount: number | string;
  commission_type: string;
  created_at: string;
  order?: {
    id?: string;
    order_number?: string | null;
    actual_delivery_time?: string | null;
  } | null;
}

@Injectable()
export class AgentDeliveryEarningsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly delivery: DeliveryConfigService,
    private readonly commissions: CommissionsService
  ) {}

  async getEarnings(input: {
    userId: string;
    country: string | null;
    period: DeliveryEarningsPeriod;
  }): Promise<DeliveryEarnings> {
    const currency = currencyForReferralPayout(input.country);
    const timeZone = await this.timeZoneFor(input.country);
    const bounds = periodBounds(input.period, new Date(), timeZone);
    const [pay, rows] = await Promise.all([
      this.loadPay(input.country),
      this.loadRows(input.userId, currency, bounds),
    ]);
    const trips = groupDeliveryTrips(rows);
    return earningsView(input.period, currency, pay, trips);
  }

  private async timeZoneFor(country: string | null): Promise<string> {
    if (!country?.trim()) return 'UTC';
    return this.delivery.getTimezone(country);
  }

  private async loadPay(country: string | null): Promise<DeliveryPayRates> {
    const code = (country ?? '').trim().toUpperCase() || 'XX';
    const [normalBase, fastBase, perKm, config] = await Promise.all([
      this.delivery.getNormalDeliveryBaseFee(code),
      this.delivery.getFastDeliveryBaseFee(code),
      this.delivery.getPerKmDeliveryFee(code),
      this.commissions.getCommissionConfigs(),
    ]);
    return deliveryPayRates({
      normalBaseFee: normalBase,
      fastBaseFee: fastBase,
      perKmFee: perKm,
      basePercent: config.verifiedAgentBaseDeliveryCommission,
      perKmPercent: config.verifiedAgentPerKmDeliveryCommission,
    });
  }

  private async loadRows(
    userId: string,
    currency: string,
    bounds: { start: string | null; end: string | null }
  ): Promise<DeliveryPayoutRow[]> {
    const result = bounds.start
      ? await this.hasura.executeQuery(WINDOW_PAYOUTS, {
          userId,
          currency,
          start: bounds.start,
          end: bounds.end,
        })
      : await this.hasura.executeQuery(ALL_PAYOUTS, { userId, currency });
    const rows = (result.commission_payouts ?? []) as PayoutQueryRow[];
    return rows.map(mapPayoutRow);
  }
}

function earningsView(
  period: DeliveryEarningsPeriod,
  currency: string,
  pay: DeliveryPayRates,
  trips: DeliveryEarnings['trips']
): DeliveryEarnings {
  return {
    currency,
    period,
    pay,
    earnedAmount: trips.reduce((sum, trip) => sum + trip.amount, 0),
    tripCount: trips.length,
    trips,
  };
}

function mapPayoutRow(row: PayoutQueryRow): DeliveryPayoutRow {
  return {
    orderId: row.order?.id ?? '',
    orderNumber: row.order?.order_number ?? null,
    deliveredAt: row.order?.actual_delivery_time ?? null,
    amount: Number(row.amount) || 0,
    commissionType: row.commission_type,
    createdAt: row.created_at,
  };
}
