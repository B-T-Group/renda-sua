import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { CommissionGrid, CommissionGridTier } from './representative-commission.rules';

const MIN_NOTICE_MS = 30 * 24 * 60 * 60 * 1000;

const GRID_FIELDS = `
  id currency base_percent cap_percent hold_percent hold_days
  registration_target objective_threshold_percent activation_amount
  activation_min_sales activation_window_days
  fast_start_amount fast_start_min_registrations fast_start_window_days
  fast_start_weekly_sales
  quarterly_amount quarterly_min_weeks quarterly_week_span
  quarterly_min_registrations_per_week quarterly_min_weekly_sales
  courier_amount courier_min_deliveries courier_window_days courier_max_per_month
  ambassador_amount ambassador_min_registrations ambassador_window_days
  inactive_days
  tiers(order_by: { sort_order: asc }) {
    min_monthly_sales max_monthly_sales bonus_percent
  }
`;

export interface StoredCommissionGrid extends CommissionGrid {
  id: string;
  activationMinSales: number;
  activationWindowDays: number;
  fastStartAmount: number;
  fastStartMinRegistrations: number;
  fastStartWindowDays: number;
  fastStartWeeklySales: number;
  quarterlyAmount: number;
  quarterlyMinWeeks: number;
  quarterlyWeekSpan: number;
  quarterlyMinRegistrationsPerWeek: number;
  quarterlyMinWeeklySales: number;
  courierAmount: number;
  courierMinDeliveries: number;
  courierWindowDays: number;
  courierMaxPerMonth: number;
  ambassadorAmount: number;
  ambassadorMinRegistrations: number;
  ambassadorWindowDays: number;
  inactiveDays: number;
}

@Injectable()
export class RepresentativeCommissionGridService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async loadFor(currency: string, at: Date): Promise<StoredCommissionGrid | null> {
    const result = await this.hasura.executeQuery(loadGridQuery(), {
      currency,
      at: at.toISOString(),
    });
    const row = result?.representative_commission_grids?.[0];
    return row ? mapGrid(row) : null;
  }

  async replaceOpenGrid(
    currency: string,
    effectiveFrom: Date,
    amounts: Record<string, number>
  ): Promise<void> {
    assertNotice(effectiveFrom);
    const open = await this.loadFor(currency, effectiveFrom);
    if (open) await this.closeOpen(open.id, effectiveFrom);
    await this.insertGrid(currency, effectiveFrom, amounts);
  }

  private async closeOpen(id: string, effectiveTo: Date): Promise<void> {
    await this.hasura.executeQuery(closeGridMutation(), {
      id,
      effectiveTo: effectiveTo.toISOString(),
    });
  }

  private async insertGrid(
    currency: string,
    effectiveFrom: Date,
    amounts: Record<string, number>
  ): Promise<void> {
    await this.hasura.executeQuery(insertGridMutation(), {
      object: { currency, effective_from: effectiveFrom.toISOString(), ...amounts },
    });
  }
}

function assertNotice(effectiveFrom: Date): void {
  if (effectiveFrom.getTime() < Date.now() + MIN_NOTICE_MS) {
    throw new Error('A commission grid change must start at least 30 days from now');
  }
}

function loadGridQuery(): string {
  return `
    query LoadCommissionGrid($currency: currency_enum!, $at: timestamptz!) {
      representative_commission_grids(
        where: {
          currency: { _eq: $currency }
          effective_from: { _lte: $at }
          _or: [{ effective_to: { _is_null: true } }, { effective_to: { _gt: $at } }]
        }
        order_by: { effective_from: desc }
        limit: 1
      ) { ${GRID_FIELDS} }
    }
  `;
}

function closeGridMutation(): string {
  return `
    mutation CloseCommissionGrid($id: uuid!, $effectiveTo: timestamptz!) {
      update_representative_commission_grids_by_pk(
        pk_columns: { id: $id }
        _set: { effective_to: $effectiveTo }
      ) { id }
    }
  `;
}

function insertGridMutation(): string {
  return `
    mutation InsertCommissionGrid($object: representative_commission_grids_insert_input!) {
      insert_representative_commission_grids_one(object: $object) { id }
    }
  `;
}

function mapGrid(row: GridRow): StoredCommissionGrid {
  return {
    id: row.id,
    currency: row.currency,
    basePercent: num(row.base_percent),
    capPercent: num(row.cap_percent),
    holdPercent: num(row.hold_percent),
    holdDays: num(row.hold_days),
    registrationTarget: num(row.registration_target),
    objectiveThresholdPercent: num(row.objective_threshold_percent),
    activationAmount: num(row.activation_amount),
    activationMinSales: num(row.activation_min_sales),
    activationWindowDays: num(row.activation_window_days),
    fastStartAmount: num(row.fast_start_amount),
    fastStartMinRegistrations: num(row.fast_start_min_registrations),
    fastStartWindowDays: num(row.fast_start_window_days),
    fastStartWeeklySales: num(row.fast_start_weekly_sales),
    quarterlyAmount: num(row.quarterly_amount),
    quarterlyMinWeeks: num(row.quarterly_min_weeks),
    quarterlyWeekSpan: num(row.quarterly_week_span),
    quarterlyMinRegistrationsPerWeek: num(row.quarterly_min_registrations_per_week),
    quarterlyMinWeeklySales: num(row.quarterly_min_weekly_sales),
    courierAmount: num(row.courier_amount),
    courierMinDeliveries: num(row.courier_min_deliveries),
    courierWindowDays: num(row.courier_window_days),
    courierMaxPerMonth: num(row.courier_max_per_month),
    ambassadorAmount: num(row.ambassador_amount),
    ambassadorMinRegistrations: num(row.ambassador_min_registrations),
    ambassadorWindowDays: num(row.ambassador_window_days),
    inactiveDays: num(row.inactive_days),
    tiers: (row.tiers ?? []).map(mapTier),
  };
}

function mapTier(row: TierRow): CommissionGridTier {
  return {
    minMonthlySales: num(row.min_monthly_sales),
    maxMonthlySales: row.max_monthly_sales == null ? null : num(row.max_monthly_sales),
    bonusPercent: num(row.bonus_percent),
  };
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

interface TierRow {
  min_monthly_sales: unknown;
  max_monthly_sales: unknown;
  bonus_percent: unknown;
}

interface GridRow extends TierRow {
  id: string;
  currency: string;
  base_percent: unknown;
  cap_percent: unknown;
  hold_percent: unknown;
  hold_days: unknown;
  registration_target: unknown;
  objective_threshold_percent: unknown;
  activation_amount: unknown;
  activation_min_sales: unknown;
  activation_window_days: unknown;
  fast_start_amount: unknown;
  fast_start_min_registrations: unknown;
  fast_start_window_days: unknown;
  fast_start_weekly_sales: unknown;
  quarterly_amount: unknown;
  quarterly_min_weeks: unknown;
  quarterly_week_span: unknown;
  quarterly_min_registrations_per_week: unknown;
  quarterly_min_weekly_sales: unknown;
  courier_amount: unknown;
  courier_min_deliveries: unknown;
  courier_window_days: unknown;
  courier_max_per_month: unknown;
  ambassador_amount: unknown;
  ambassador_min_registrations: unknown;
  ambassador_window_days: unknown;
  inactive_days: unknown;
  tiers?: TierRow[];
}
