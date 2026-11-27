import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { assertRateBps } from './rental-commission.calculator';
import { pickCommissionRate } from './rental-commission-rule-picker';
import * as Q from './rental-commission.queries';
import {
  CommissionRuleContext,
  CommissionRuleRow,
  EARLY_ADOPTER_CAMPAIGN,
  EARLY_ADOPTER_ENROL_UNTIL_KEY,
  EARLY_ADOPTER_MONTHS_KEY,
  EARLY_ADOPTER_RATE_KEY,
  RENTALS_COMMISSION_FLAG,
  ResolvedCommissionRate,
} from './rental-commission.types';

interface ConfigRow {
  config_key: string;
  country_code?: string | null;
  boolean_value?: boolean | null;
  number_value?: number | string | null;
  date_value?: string | null;
}

export interface EarlyAdopterConfig {
  rateBps: number;
  months: number;
  enrolUntil: Date;
}

function pickConfig(rows: ConfigRow[], key: string, country: string | null): ConfigRow | undefined {
  const own = rows.filter((r) => r.config_key === key);
  const scoped = country ? own.find((r) => (r.country_code ?? '').toUpperCase() === country.toUpperCase()) : undefined;
  return scoped ?? own.find((r) => !r.country_code);
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** Config flags, the rate resolver and the early-adopter promo. */
@Injectable()
export class RentalCommissionRulesService {
  private readonly logger = new Logger(RentalCommissionRulesService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  private async configRows(keys: string[], country: string | null): Promise<ConfigRow[]> {
    const res = await this.hasura.executeQuery<{ application_configurations: ConfigRow[] }>(
      Q.COMMISSION_CONFIG_ROWS,
      { keys, country: (country ?? '').toUpperCase() }
    );
    return res.application_configurations ?? [];
  }

  /** Country row wins over the global row. A missing row means off. A read failure throws. */
  async isEnabled(country: string | null): Promise<boolean> {
    const rows = await this.configRows([RENTALS_COMMISSION_FLAG], country);
    return pickConfig(rows, RENTALS_COMMISSION_FLAG, country)?.boolean_value === true;
  }

  async earlyAdopterConfig(country: string | null): Promise<EarlyAdopterConfig | null> {
    const keys = [EARLY_ADOPTER_RATE_KEY, EARLY_ADOPTER_MONTHS_KEY, EARLY_ADOPTER_ENROL_UNTIL_KEY];
    const rows = await this.configRows(keys, country);
    const rate = Number(pickConfig(rows, EARLY_ADOPTER_RATE_KEY, country)?.number_value);
    const months = Number(pickConfig(rows, EARLY_ADOPTER_MONTHS_KEY, country)?.number_value);
    const until = pickConfig(rows, EARLY_ADOPTER_ENROL_UNTIL_KEY, country)?.date_value;
    if (!Number.isInteger(rate) || !(months > 0) || !until) return null;
    return { rateBps: rate, months, enrolUntil: new Date(until) };
  }

  async activeRules(ctx: CommissionRuleContext): Promise<CommissionRuleRow[]> {
    const res = await this.hasura.executeQuery<{ rental_commission_rules: CommissionRuleRow[] }>(
      Q.COMMISSION_RULES_FOR_CONTEXT,
      { businessId: ctx.businessId, categoryId: ctx.categoryId }
    );
    return res.rental_commission_rules ?? [];
  }

  /** Throws 503 when no default rule exists. Never guesses a rate. */
  async resolve(ctx: CommissionRuleContext, at: Date = new Date()): Promise<ResolvedCommissionRate> {
    const rows = await this.activeRules(ctx);
    const candidate = await this.withEarlyAdopterCandidate(rows, ctx, at);
    const rate = pickCommissionRate(candidate, ctx, at);
    if (!rate) {
      this.logger.error(`rental_commission_default_missing business=${ctx.businessId}`);
      throw new HttpException('Commission rate is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return rate;
  }

  /** A not-yet-saved promo row, so a preview shows the rate the merchant will get. */
  private async withEarlyAdopterCandidate(
    rows: CommissionRuleRow[],
    ctx: CommissionRuleContext,
    at: Date
  ): Promise<CommissionRuleRow[]> {
    if (rows.some((r) => r.scope === 'promo' && r.campaign_code === EARLY_ADOPTER_CAMPAIGN)) return rows;
    const config = await this.earlyAdopterConfig(ctx.country);
    if (!config || at.getTime() >= config.enrolUntil.getTime()) return rows;
    return [...rows, this.promoRow(ctx.businessId, config, at, `pending:${ctx.businessId}`)];
  }

  private promoRow(businessId: string, config: EarlyAdopterConfig, at: Date, id: string): CommissionRuleRow {
    return {
      id,
      scope: 'promo',
      business_id: businessId,
      rental_category_id: null,
      country_code: null,
      campaign_code: EARLY_ADOPTER_CAMPAIGN,
      rate_bps: config.rateBps,
      effective_from: at.toISOString(),
      effective_to: addMonths(at, config.months).toISOString(),
      status: 'active',
    };
  }

  /** Saves the promo row when the resolved rate is a pending one. Returns the saved rule id. */
  async persistPendingPromo(ctx: CommissionRuleContext, rate: ResolvedCommissionRate, at: Date): Promise<string | null> {
    if (rate.source !== 'promo' || !rate.ruleId?.startsWith('pending:')) return rate.ruleId;
    const config = await this.earlyAdopterConfig(ctx.country);
    if (!config) return null;
    const row = this.promoRow(ctx.businessId, config, at, '');
    return this.insertPromo(row);
  }

  private async insertPromo(row: CommissionRuleRow): Promise<string | null> {
    try {
      const saved = await this.hasura.executeMutation<{ insert_rental_commission_rules_one: { id: string } }>(
        Q.INSERT_COMMISSION_RULE,
        { object: this.insertObject(row, 'Early-adopter promo') }
      );
      return saved.insert_rental_commission_rules_one.id;
    } catch (error: any) {
      this.logger.warn(`early adopter enrol skipped business=${row.business_id}: ${error?.message ?? 'unknown'}`);
      return null;
    }
  }

  private insertObject(row: Omit<CommissionRuleRow, 'id' | 'status'>, reason: string) {
    return {
      scope: row.scope,
      business_id: row.business_id,
      rental_category_id: row.rental_category_id,
      country_code: row.country_code,
      campaign_code: row.campaign_code,
      rate_bps: row.rate_bps,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      reason: row.reason ?? reason,
      created_by: row.created_by ?? null,
    };
  }

  async listRules(filter: { scope?: string; businessId?: string; status?: string }): Promise<CommissionRuleRow[]> {
    const where: Record<string, unknown> = {};
    if (filter.scope) where.scope = { _eq: filter.scope };
    if (filter.businessId) where.business_id = { _eq: filter.businessId };
    if (filter.status) where.status = { _eq: filter.status };
    const res = await this.hasura.executeQuery<{ rental_commission_rules: CommissionRuleRow[] }>(
      Q.LIST_COMMISSION_RULES,
      { where }
    );
    return res.rental_commission_rules ?? [];
  }

  /** Ends the open rule for the same key, then creates the new one. Rules are never edited in place. */
  async createRule(
    input: Omit<CommissionRuleRow, 'id' | 'status' | 'effective_from'> & { effective_from?: string | null },
    actorId: string
  ): Promise<CommissionRuleRow> {
    assertRateBps(input.rate_bps);
    const now = new Date().toISOString();
    this.assertWindow(input.effective_from ?? now, input.effective_to);
    if (!input.effective_to) await this.endOpenRuleForKey(input, now);
    const saved = await this.hasura.executeMutation<{ insert_rental_commission_rules_one: CommissionRuleRow }>(
      Q.INSERT_COMMISSION_RULE,
      { object: this.insertObject({ ...input, effective_from: input.effective_from ?? now, created_by: actorId }, 'Admin rule') }
    );
    return saved.insert_rental_commission_rules_one;
  }

  private assertWindow(from: string, to?: string | null): void {
    if (to && Date.parse(to) <= Date.parse(from)) {
      throw new HttpException('effective_to must be after effective_from', HttpStatus.BAD_REQUEST);
    }
  }

  private async endOpenRuleForKey(input: Omit<CommissionRuleRow, 'id' | 'status' | 'effective_from'>, at: string) {
    const where = {
      scope: { _eq: input.scope },
      status: { _eq: 'active' },
      effective_to: { _is_null: true },
      business_id: input.business_id ? { _eq: input.business_id } : { _is_null: true },
      rental_category_id: input.rental_category_id ? { _eq: input.rental_category_id } : { _is_null: true },
      country_code: input.country_code ? { _eq: input.country_code } : { _is_null: true },
      campaign_code: input.campaign_code ? { _eq: input.campaign_code } : { _is_null: true },
    };
    await this.hasura.executeMutation(Q.END_OPEN_COMMISSION_RULES, { where, at });
  }

  async endRule(id: string): Promise<CommissionRuleRow> {
    const res = await this.hasura.executeMutation<{
      update_rental_commission_rules: { returning: CommissionRuleRow[] };
    }>(Q.END_COMMISSION_RULE, { id, at: new Date().toISOString() });
    const row = res.update_rental_commission_rules.returning[0];
    if (!row) throw new HttpException('Active rule not found', HttpStatus.NOT_FOUND);
    return row;
  }
}
