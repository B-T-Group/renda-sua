import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { referralReferenceUuid } from '../referrals/referral-pyramid.util';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { addDays, currentPeriod, doualaMidnight, doualaNoon, periodRange, previousPeriod } from './douala-period';
import {
  portfolioCommissionApplies,
  readPortfolioEnabled,
  shouldReplaceLegacySalePay,
} from './portfolio-commission-flag';
import { RepresentativeCommissionGridService, type StoredCommissionGrid } from './representative-commission-grid.service';
import {
  computeStatement,
  eligibleOrderAmount,
  registrationsNeeded,
  uncollectedDeliveryAmount,
  type StatementMath,
} from './representative-commission.rules';
import { activationSubjectIds, fastStartAmountDue } from './representative-commission-premiums';
import {
  livePortfolioPending,
  portfolioTotalsFromSums,
  readPortfolioSums,
} from './portfolio-paid-totals';

export interface AccrualOrder {
  orderId: string;
  businessId: string;
  currency: string;
  subtotal: number;
  itemCommission: number;
  deliveryFeeWaived: boolean;
  baseDeliveryFee: number;
  perKmDeliveryFee: number;
  firstOrderDiscount: number;
  clientUserId: string | null;
  countryCode: string | null;
  completedAt?: string | null;
}

export interface PortfolioCommissionMonth {
  periodStart: string;
  gmv: number;
  eligible: number;
  registrations: number;
  registrationTarget: number;
  registrationsNeeded: number;
  objectiveMet: boolean;
  growthPercent: number;
  baseAmount: number;
  growthAmount: number;
  activationPaid: number;
  fastStartEarned: number;
  fastStartPaid: number;
  quarterlyEarned: number;
  quarterlyPaid: number;
  payableAmount: number;
  holdAmount: number;
  holdReleaseAt: string | null;
  recruitmentAmount: number;
  status: 'open' | 'credited';
}

export interface PortfolioCommissionView {
  currency: string;
  basePercent: number;
  capPercent: number;
  holdPercent: number;
  holdDays: number;
  registrationTarget: number;
  tiers: StoredCommissionGrid['tiers'];
  activationAmount: number;
  fastStartAmount: number;
  quarterlyAmount: number;
  courierAmount: number;
  ambassadorAmount: number;
  month: PortfolioCommissionMonth | null;
}

@Injectable()
export class RepresentativeCommissionService {
  private readonly logger = new Logger(RepresentativeCommissionService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly configurations: ConfigurationsService,
    private readonly grids: RepresentativeCommissionGridService,
    private readonly accounts: AccountsService,
    private readonly paymentRouting: PaymentRoutingService
  ) {}

  async accrue(order: AccrualOrder): Promise<void> {
    // Item settlement runs at agent pickup, before completed_at exists. Using
    // "now" there passed the cutover clock and could lapse the shop for good.
    const at = saleInstant(order.completedAt);
    if (!at) return;
    if (!(await this.enabled(order.countryCode, at))) return;
    const business = await this.loadBusiness(order.businessId);
    if (!business?.referred_by_agent_id || !business.merchant_agreement_accepted_at) return;
    const grid = await this.grids.loadFor(order.currency, at);
    if (!grid || (await this.blocked(business, grid, order.completedAt))) return;
    await this.insertAccrual(order, business);
  }

  async replacesLegacy(
    country: string | null,
    currency: string,
    at: Date
  ): Promise<boolean> {
    const on = await readPortfolioEnabled(
      (key, code) => this.configurations.getConfigurationByKey(key, code),
      country
    );
    const grid = await this.grids.loadFor(currency, at);
    return shouldReplaceLegacySalePay(on, at, !!grid);
  }

  async previewForAgent(
    agentId: string,
    currency: string,
    country: string | null = null
  ): Promise<PortfolioCommissionView | null> {
    try {
      return (await this.currentMonth(agentId, currency, country))?.view ?? null;
    } catch (error: any) {
      this.logger.warn(`Portfolio preview skipped: ${error.message}`);
      return null;
    }
  }

  async boardTotals(agentId: string, currency: string, country: string | null) {
    try {
      const sums = readPortfolioSums(
        await this.hasura.executeQuery(portfolioPaidQuery(), { agentId, currency })
      );
      return portfolioTotalsFromSums(sums, await this.livePending(agentId, currency, country));
    } catch (error: any) {
      this.logger.warn(`Portfolio paid total skipped: ${error.message}`);
      return null;
    }
  }

  private async currentMonth(agentId: string, currency: string, country: string | null) {
    if (!(await this.enabled(country))) return null;
    const period = currentPeriod(new Date());
    const grid = await this.gridForPeriod(currency, period);
    if (!grid) return null;
    const saved = await this.loadStatement(agentId, currency, period.start);
    const release = saved?.id ? await this.holdReleaseFor(saved.id) : null;
    const month = saved
      ? monthFromStatement(saved, grid, release)
      : (await this.liveMonth(agentId, currency, period, grid)).month;
    return { view: viewFrom(grid, month), stored: Boolean(saved) };
  }

  private async livePending(agentId: string, currency: string, country: string | null) {
    try {
      const current = await this.currentMonth(agentId, currency, country);
      return livePortfolioPending(Boolean(current?.stored), current?.view.month ?? null);
    } catch (error: any) {
      this.logger.warn(`Portfolio live month skipped: ${error.message}`);
      return 0;
    }
  }

  async closePreviousMonth(): Promise<number> {
    return this.closePeriod(previousPeriod(new Date()));
  }

  async closeCurrentMonth(): Promise<number> {
    return this.closePeriod(currentPeriod(new Date()));
  }

  private async closePeriod(period: { start: string; end: string }): Promise<number> {
    const agents = uniqueAgents([
      ...(await this.agentsWithAccruals(period)),
      ...(await this.premiumAgents(period)),
      ...(await this.agentsWithOpenStatements(period)),
    ]);
    let closed = 0;
    for (const row of agents) closed += await this.closeOne(row.agent_id, row.currency, period);
    return closed;
  }

  async releaseDueHolds(): Promise<number> {
    const holds = await this.dueHolds();
    let released = 0;
    for (const hold of holds) released += await this.releaseHold(hold);
    return released;
  }

  private async gridForPeriod(
    currency: string,
    period: { start: string; end: string }
  ): Promise<StoredCommissionGrid | null> {
    const opening = await this.grids.loadFor(currency, doualaNoon(period.start));
    if (opening) return opening;
    const end = doualaMidnight(period.end).getTime() - 1;
    return this.grids.loadFor(currency, new Date(Math.min(Date.now(), end)));
  }

  private async enabled(country: string | null, at: Date = new Date()): Promise<boolean> {
    const on = await readPortfolioEnabled(
      (key, code) => this.configurations.getConfigurationByKey(key, code),
      country
    );
    return portfolioCommissionApplies(on, at);
  }

  private async closeAllowed(agentId: string, periodStart: string): Promise<boolean> {
    return this.enabled(await this.agentCountry(agentId), doualaMidnight(periodStart));
  }

  private async agentCountry(agentId: string): Promise<string> {
    const userId = await this.agentUserId(agentId);
    const country = userId ? await this.paymentRouting.getUserCountryCode(userId) : null;
    return (country || 'CM').toUpperCase();
  }

  private async agentUserId(agentId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(agentUserIdQuery(), { agentId });
    return result?.agents_by_pk?.user_id ?? null;
  }

  private async blocked(
    business: ReferredBusiness,
    grid: StoredCommissionGrid,
    completedAt?: string | null
  ): Promise<boolean> {
    if (business.exit) return true;
    if (await this.agreementEnded(business.referred_by_agent_id)) return true;
    return this.exitIfInactive(business, grid, completedAt);
  }

  private async exitIfInactive(
    business: ReferredBusiness,
    grid: StoredCommissionGrid,
    completedAt?: string | null
  ): Promise<boolean> {
    // This completed sale is activity. Do not lapse the shop because an older
    // sale is the only row lastSaleAt can see (pickup raced completion).
    if (saleIsWithin(completedAt, grid.inactiveDays)) return false;
    const anchor = (await this.lastSaleAt(business.id)) ?? business.merchant_agreement_accepted_at;
    if (!anchor || Date.now() - Date.parse(anchor) < grid.inactiveDays * 86400000) return false;
    await this.insertExit(business.id, business.referred_by_agent_id);
    return true;
  }

  private async insertAccrual(order: AccrualOrder, business: ReferredBusiness): Promise<void> {
    const selfPurchase = order.clientUserId != null && order.clientUserId === business.agent_user_id;
    const uncollected = uncollectedDeliveryAmount(order);
    const eligible = selfPurchase
      ? 0
      : eligibleOrderAmount(order.itemCommission, uncollected, order.currency);
    await this.hasura.executeQuery(insertAccrualMutation(), {
      object: accrualObject(order, business, uncollected, eligible, selfPurchase),
    });
  }

  private async liveMonth(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null = null
  ): Promise<{ month: PortfolioCommissionMonth; premiums: PremiumDraft[] }> {
    await this.zeroDeadAccruals(agentId);
    const totals = await this.sumAccruals(agentId, currency, period, statementId);
    const registrations = await this.countRegistrations(agentId, period);
    const extras = await this.monthExtras(agentId, currency, period, grid, registrations, statementId);
    const { premiums, ...mathInput } = extras;
    const math = computeStatement({ ...totals, registrations, ...mathInput, grid });
    const month = monthView(period.start, totals, registrations, math, grid, 'open', null);
    const holdReleaseAt = month.holdAmount > 0 ? projectedRelease(period.end, grid.holdDays) : null;
    const closed = { ...month, recruitmentAmount: extras.recruitmentAmount, holdReleaseAt };
    return { month: closed, premiums };
  }

  private async closeOne(
    agentId: string,
    currency: string,
    period: { start: string; end: string }
  ): Promise<number> {
    if (!(await this.closeAllowed(agentId, period.start))) return 0;
    const existing = await this.loadStatement(agentId, currency, period.start);
    if (existing?.status === 'credited') return 0;
    const grid = await this.gridForPeriod(currency, period);
    if (!grid) return 0;
    const described = await this.liveMonth(agentId, currency, period, grid, existing?.id ?? null);
    const skip = described.premiums.length === 0 && (await this.skipClose(agentId, currency, period, described.month));
    if (skip) return 0;
    return this.finishClose(agentId, currency, period, grid, described, existing?.id);
  }

  private async skipClose(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    month: PortfolioCommissionMonth
  ): Promise<boolean> {
    if (!monthIsEmpty(month)) return false;
    return !(await this.periodHasAccrual(agentId, currency, period));
  }

  private async finishClose(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    described: { month: PortfolioCommissionMonth; premiums: PremiumDraft[] },
    existingId?: string
  ): Promise<number> {
    const id = existingId ?? (await this.insertStatement(agentId, currency, grid.id, described.month));
    if (!id) return 0;
    if (existingId) await this.updateStatement(id, described.month);
    await this.recordPremiums(agentId, currency, id, period.start, described.premiums, described.month.objectiveMet);
    if (!(await this.payStatement(agentId, currency, id, described.month, grid.holdDays))) return 0;
    await this.attachAccruals(agentId, currency, period, id);
    await this.markCredited(id);
    return 1;
  }

  private async payStatement(
    agentId: string,
    currency: string,
    statementId: string,
    month: PortfolioCommissionMonth,
    holdDays: number
  ): Promise<boolean> {
    const accountId = await this.personalAccount(agentId, currency);
    if (!(await this.payWallet(accountId, statementId, month))) {
      this.logger.error(`Portfolio payout still open for statement ${statementId}`);
      return false;
    }
    await this.parkHoldIfNeeded(statementId, agentId, currency, month, holdDays);
    return true;
  }

  private async payWallet(
    accountId: string | null,
    statementId: string,
    month: PortfolioCommissionMonth
  ): Promise<boolean> {
    if (month.payableAmount <= 0 && month.recruitmentAmount <= 0) return true;
    if (!accountId) return false;
    const payable = await this.credit(accountId, month.payableAmount, `portfolio:${statementId}:pay`);
    const recruitment = await this.credit(accountId, month.recruitmentAmount, `portfolio:${statementId}:recruit`);
    return payable && recruitment;
  }

  private async parkHoldIfNeeded(
    statementId: string,
    agentId: string,
    currency: string,
    month: PortfolioCommissionMonth,
    holdDays: number
  ): Promise<void> {
    if (month.holdAmount <= 0 || (await this.holdReleaseFor(statementId))) return;
    await this.parkHold(statementId, agentId, currency, month, holdDays);
  }

  private async credit(accountId: string, amount: number, seed: string): Promise<boolean> {
    if (amount <= 0) return true;
    const result = await this.accounts.registerDepositIfNotExists({
      accountId,
      amount,
      memo: 'Portfolio commission',
      referenceId: referralReferenceUuid(seed),
    });
    return result.success === true;
  }

  private async parkHold(
    statementId: string,
    agentId: string,
    currency: string,
    month: PortfolioCommissionMonth,
    holdDays: number
  ): Promise<void> {
    await this.hasura.executeQuery(insertHoldMutation(), {
      object: {
        statement_id: statementId,
        agent_id: agentId,
        currency,
        amount: month.holdAmount,
        remaining: month.holdAmount,
        release_at: addDays(new Date(), holdDays).toISOString(),
        status: 'held',
      },
    });
  }

  private async releaseHold(hold: HoldRow): Promise<number> {
    const accountId = await this.personalAccount(hold.agent_id, hold.currency);
    if (!accountId) return 0;
    const paid = await this.credit(accountId, Number(hold.remaining), `portfolio-hold:${hold.id}`);
    if (!paid) return 0;
    await this.hasura.executeQuery(releaseHoldMutation(), { id: hold.id });
    return 1;
  }

  private async zeroDeadAccruals(agentId: string): Promise<void> {
    await this.hasura.executeQuery(zeroDeadMutation(), { agentId });
  }

  private async sumAccruals(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    statementId: string | null
  ): Promise<{ eligible: number; gmv: number }> {
    const rows = [
      ...(await this.openAccruals(agentId, currency, period)),
      ...(await this.statementAccruals(statementId)),
    ];
    return rows.reduce(addOpenAccrual, { eligible: 0, gmv: 0 });
  }

  private async openAccruals(
    agentId: string,
    currency: string,
    period: { start: string; end: string }
  ) {
    const result = await this.hasura.executeQuery(sumAccrualsQuery(), {
      agentId,
      currency,
      ...periodRange(period),
    });
    return result?.representative_commission_accruals ?? [];
  }

  private async statementAccruals(statementId: string | null) {
    if (!statementId) return [];
    const result = await this.hasura.executeQuery(statementAccrualsQuery(), { statementId });
    return result?.representative_commission_accruals ?? [];
  }

  private async countRegistrations(
    agentId: string,
    period: { start: string; end: string }
  ): Promise<number> {
    const result = await this.hasura.executeQuery(registrationCountQuery(), {
      agentId,
      ...periodRange(period),
    });
    return result?.businesses_aggregate?.aggregate?.count ?? 0;
  }

  private async agentsWithAccruals(period: { start: string; end: string }) {
    const result = await this.hasura.executeQuery(agentsInPeriodQuery(), periodRange(period));
    return uniqueAgents(result?.representative_commission_accruals ?? []);
  }

  private async agentsWithOpenStatements(period: { start: string; end: string }) {
    const result = await this.hasura.executeQuery(openStatementsQuery(), { periodStart: period.start });
    return result?.representative_commission_statements ?? [];
  }

  private async premiumAgents(period: { start: string; end: string }) {
    const start = doualaMidnight(period.start);
    const end = doualaMidnight(period.end);
    const result = await this.hasura.executeQuery(premiumAgentsQuery(), {
      fastFrom: addDays(start, -89).toISOString(),
      fastTo: addDays(end, -89).toISOString(),
      recruitFrom: addDays(start, -60).toISOString(),
      periodEnd: end.toISOString(),
    });
    return xafAgents(result);
  }

  private async periodHasAccrual(
    agentId: string,
    currency: string,
    period: { start: string; end: string }
  ): Promise<boolean> {
    const result = await this.hasura.executeQuery(sumAccrualsQuery(), {
      agentId,
      currency,
      ...periodRange(period),
    });
    return (result?.representative_commission_accruals ?? []).length > 0;
  }

  private async recordPremiums(
    agentId: string,
    currency: string,
    statementId: string,
    periodStart: string,
    drafts: PremiumDraft[],
    objectiveMet: boolean
  ): Promise<void> {
    for (const premium of drafts) {
      await this.insertPremium(agentId, currency, statementId, periodStart, premium, objectiveMet);
    }
  }

  private async insertPremium(
    agentId: string,
    currency: string,
    statementId: string,
    periodStart: string,
    premium: PremiumDraft,
    objectiveMet: boolean
  ): Promise<void> {
    if (await this.premiumExists(agentId, premium.kind, premium.subjectId)) return;
    const lost = !objectiveMet && premium.kind !== 'courier' && premium.kind !== 'ambassador';
    try {
      await this.hasura.executeQuery(insertPremiumMutation(), {
        object: premiumObject(agentId, currency, statementId, periodStart, premium, lost),
      });
    } catch (error: any) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  private async loadStatement(agentId: string, currency: string, periodStart: string) {
    const result = await this.hasura.executeQuery(loadStatementQuery(), {
      agentId,
      currency,
      periodStart,
    });
    return result?.representative_commission_statements?.[0] ?? null;
  }

  private async holdReleaseFor(statementId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(holdReleaseQuery(), { statementId });
    return result?.representative_commission_holds?.[0]?.release_at ?? null;
  }

  private async insertStatement(
    agentId: string,
    currency: string,
    gridId: string,
    month: PortfolioCommissionMonth
  ): Promise<string | null> {
    const result = await this.hasura.executeQuery(insertStatementMutation(), {
      object: statementObject(agentId, currency, gridId, month),
    });
    return result?.insert_representative_commission_statements_one?.id ?? null;
  }

  private async updateStatement(id: string, month: PortfolioCommissionMonth): Promise<void> {
    await this.hasura.executeQuery(updateStatementMutation(), { id, set: statementPatch(month) });
  }

  private async attachAccruals(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    statementId: string
  ): Promise<void> {
    await this.hasura.executeQuery(attachAccrualsMutation(), {
      agentId,
      currency,
      ...periodRange(period),
      statementId,
    });
  }

  private async markCredited(id: string): Promise<void> {
    await this.hasura.executeQuery(markCreditedMutation(), { id, at: new Date().toISOString() });
  }

  private async dueHolds(): Promise<HoldRow[]> {
    const result = await this.hasura.executeQuery(dueHoldsQuery(), { now: new Date().toISOString() });
    return result?.representative_commission_holds ?? [];
  }

  private async personalAccount(agentId: string, currency: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(personalAccountQuery(), { agentId, currency });
    return result?.agents_by_pk?.user?.accounts?.[0]?.id ?? null;
  }

  private async loadBusiness(id: string): Promise<ReferredBusiness | null> {
    const result = await this.hasura.executeQuery(businessQuery(), { id });
    const row = result?.businesses_by_pk;
    if (!row?.referred_by_agent_id) return null;
    return {
      id: row.id,
      referred_by_agent_id: row.referred_by_agent_id,
      merchant_agreement_accepted_at: row.merchant_agreement_accepted_at ?? null,
      agent_user_id: row.referring_agent?.user_id ?? null,
      exit: result?.representative_portfolio_exits_by_pk ?? null,
    };
  }

  private async lastSaleAt(businessId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(lastSaleQuery(), { businessId });
    return result?.orders?.[0]?.completed_at ?? null;
  }

  private async agreementEnded(agentId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery(contractEndQuery(), { agentId });
    const row = result?.agent_contracts?.[0];
    const ended = row?.cancelled_at ?? row?.expired_at;
    return !!ended && Date.parse(ended) <= Date.now();
  }

  private async monthExtras(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    registrations: number,
    statementId: string | null
  ) {
    const activation = await this.activationAward(agentId, currency, period, grid, statementId);
    const fastStart = await this.fastStartAward(agentId, currency, period, grid, statementId);
    const recruitment = await this.recruitmentAwards(agentId, currency, period, grid, statementId);
    return {
      activationCount: activation.ids.length,
      fastStartEarned: fastStart.amount,
      quarterlyEarned: 0,
      recruitmentAmount: registrations >= 0 ? recruitment.amount : 0,
      premiums: [...activation.premiums, ...fastStart.premiums, ...recruitment.premiums],
    };
  }

  private async activationAward(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<{ ids: string[]; premiums: PremiumDraft[] }> {
    const result = await this.hasura.executeQuery(activationBusinessesQuery(), { agentId, currency });
    const paid = await this.paidSubjects(agentId, 'activation', statementId);
    const ids = activationSubjectIds(
      result?.businesses ?? [],
      period,
      grid,
      result?.agents_by_pk?.user_id ?? null,
      paid
    );
    return { ids, premiums: ids.map((subjectId) => draft('activation', subjectId, grid.activationAmount)) };
  }

  private async fastStartAward(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<{ amount: number; premiums: PremiumDraft[] }> {
    if (await this.premiumExists(agentId, 'fast_start', agentId, statementId)) return { amount: 0, premiums: [] };
    const signedAt = await this.contractSignedAt(agentId);
    if (!signedAt || !fastStartAmountDue(signedAt, period)) return { amount: 0, premiums: [] };
    const earned = await this.fastStartQualified(agentId, currency, signedAt, grid);
    if (!earned) return { amount: 0, premiums: [] };
    return { amount: grid.fastStartAmount, premiums: [draft('fast_start', agentId, grid.fastStartAmount)] };
  }

  private async fastStartQualified(
    agentId: string,
    currency: string,
    signedAt: string,
    grid: StoredCommissionGrid
  ): Promise<boolean> {
    const sales = await this.windowSales(agentId, currency, addDays(new Date(signedAt), 60), addDays(new Date(signedAt), 90));
    const signups = await this.windowRegistrations(agentId, new Date(signedAt), addDays(new Date(signedAt), 90));
    const pace = (sales * 7) / 30;
    return signups >= grid.fastStartMinRegistrations && pace >= grid.fastStartWeeklySales;
  }

  private async recruitmentAwards(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<{ amount: number; premiums: PremiumDraft[] }> {
    const couriers = await this.courierAward(agentId, currency, period, grid, statementId);
    const ambassadors = await this.ambassadorAward(agentId, period, grid, statementId);
    return {
      amount: couriers.amount + ambassadors.amount,
      premiums: [...couriers.premiums, ...ambassadors.premiums],
    };
  }

  private async courierAward(
    agentId: string,
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<{ amount: number; premiums: PremiumDraft[] }> {
    const qualified = await this.qualifiedCouriers(await this.referredAgents(agentId), currency, period, grid, statementId);
    const paid = qualified.slice(0, grid.courierMaxPerMonth);
    return { amount: paid.length * grid.courierAmount, premiums: paid.map((recruit) => draft('courier', recruit.id, grid.courierAmount, recruit.at)) };
  }

  private async ambassadorAward(
    agentId: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<{ amount: number; premiums: PremiumDraft[] }> {
    const qualified = await this.qualifiedAmbassadors(await this.referredAgents(agentId), period, grid, statementId);
    return {
      amount: qualified.length * grid.ambassadorAmount,
      premiums: qualified.map((recruit) => draft('ambassador', recruit.id, grid.ambassadorAmount, recruit.at)),
    };
  }

  private async qualifiedCouriers(
    recruits: Recruit[],
    currency: string,
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<Array<Recruit & { at: number }>> {
    if (recruits.length === 0) return [];
    const paid = await this.paidSubjects(recruits[0].referrerId, 'courier', statementId);
    const qualified: Array<Recruit & { at: number }> = [];
    for (const recruit of recruits) {
      const at = await this.courierQualifiedAt(recruit, currency, grid);
      if (at != null && inPeriod(at, period) && !paid.has(recruit.id)) qualified.push({ ...recruit, at });
    }
    return qualified.sort((a, b) => a.at - b.at);
  }

  private async qualifiedAmbassadors(
    recruits: Recruit[],
    period: { start: string; end: string },
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<Array<Recruit & { at: number }>> {
    const qualified: Array<Recruit & { at: number }> = [];
    for (const recruit of recruits) {
      const at = await this.ambassadorQualifiedAt(recruit, grid, statementId);
      if (at != null && inPeriod(at, period)) qualified.push({ ...recruit, at });
    }
    return qualified;
  }

  private async courierQualifiedAt(
    recruit: Recruit,
    currency: string,
    grid: StoredCommissionGrid
  ): Promise<number | null> {
    if (!recruit.signedAt) return null;
    const end = addDays(new Date(recruit.signedAt), grid.courierWindowDays);
    const result = await this.hasura.executeQuery(deliveryQuery(), {
      agentId: recruit.id,
      currency,
      start: recruit.signedAt,
      end: end.toISOString(),
      offset: grid.courierMinDeliveries - 1,
    });
    const at = Date.parse(result?.orders?.[0]?.completed_at ?? '');
    return Number.isNaN(at) ? null : at;
  }

  private async ambassadorQualifiedAt(
    recruit: Recruit,
    grid: StoredCommissionGrid,
    statementId: string | null
  ): Promise<number | null> {
    if (!recruit.signedAt || (await this.premiumExists(recruit.referrerId, 'ambassador', recruit.id, statementId))) {
      return null;
    }
    const end = addDays(new Date(recruit.signedAt), grid.ambassadorWindowDays);
    const result = await this.hasura.executeQuery(ambassadorSignupsQuery(), {
      agentId: recruit.id,
      start: recruit.signedAt,
      end: end.toISOString(),
      offset: grid.ambassadorMinRegistrations - 1,
    });
    const at = Date.parse(result?.businesses?.[0]?.merchant_agreement_accepted_at ?? '');
    return Number.isNaN(at) ? null : at;
  }

  private async referredAgents(agentId: string): Promise<Recruit[]> {
    const result = await this.hasura.executeQuery(referredAgentsQuery(), { agentId });
    return (result?.agents ?? []).map((row: RecruitRow) => ({
      id: row.id,
      referrerId: agentId,
      signedAt: row.agent_contracts?.[0]?.signed_at ?? null,
    }));
  }

  private async premiumExists(
    agentId: string,
    kind: string,
    subjectId = agentId,
    openStatementId: string | null = null
  ): Promise<boolean> {
    const result = await this.hasura.executeQuery(premiumExistsQuery(), { agentId, kind, subjectId });
    const row = result?.representative_commission_premiums?.[0];
    if (!row) return false;
    return !(openStatementId && row.statement_id === openStatementId);
  }

  private async paidSubjects(
    agentId: string,
    kind: string,
    openStatementId: string | null = null
  ): Promise<Set<string>> {
    const result = await this.hasura.executeQuery(paidSubjectsQuery(), { agentId, kind });
    const rows = result?.representative_commission_premiums ?? [];
    return new Set(
      rows
        .filter((row: { statement_id?: string | null }) => row.statement_id !== openStatementId || !openStatementId)
        .map((row: { subject_id: string }) => row.subject_id)
    );
  }

  private async contractSignedAt(agentId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(signedAtQuery(), { agentId });
    return result?.agent_contracts?.[0]?.signed_at ?? null;
  }

  private async windowSales(agentId: string, currency: string, start: Date, end: Date): Promise<number> {
    const result = await this.hasura.executeQuery(windowSalesQuery(), {
      agentId,
      currency,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    return Number(result?.orders_aggregate?.aggregate?.sum?.subtotal ?? 0);
  }

  private async windowRegistrations(agentId: string, start: Date, end: Date): Promise<number> {
    const result = await this.hasura.executeQuery(registrationCountQuery(), {
      agentId,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    return result?.businesses_aggregate?.aggregate?.count ?? 0;
  }

  private async insertExit(businessId: string, agentId: string): Promise<void> {
    await this.hasura.executeQuery(insertExitMutation(), {
      object: {
        business_id: businessId,
        agent_id: agentId,
        exited_at: new Date().toISOString(),
        reason: 'inactive_90_days',
      },
    });
  }
}

function addOpenAccrual(
  sum: { eligible: number; gmv: number },
  row: { eligible_amount: unknown; gmv_amount: unknown; self_purchase: boolean }
) {
  if (row.self_purchase) return sum;
  return {
    eligible: sum.eligible + Number(row.eligible_amount ?? 0),
    gmv: sum.gmv + Number(row.gmv_amount ?? 0),
  };
}

function uniqueAgents(rows: Array<{ agent_id: string; currency: string }>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.agent_id}:${row.currency}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function accrualObject(
  order: AccrualOrder,
  business: ReferredBusiness,
  uncollected: number,
  eligible: number,
  selfPurchase: boolean
) {
  return {
    order_id: order.orderId,
    agent_id: business.referred_by_agent_id,
    business_id: business.id,
    currency: order.currency,
    item_commission: order.itemCommission,
    uncollected_delivery: uncollected,
    eligible_amount: eligible,
    gmv_amount: selfPurchase ? 0 : Math.max(0, order.subtotal),
    self_purchase: selfPurchase,
    status: 'open',
  };
}

function monthView(
  periodStart: string,
  totals: { eligible: number; gmv: number },
  registrations: number,
  math: StatementMath,
  grid: StoredCommissionGrid,
  status: 'open' | 'credited',
  holdReleaseAt: string | null
): PortfolioCommissionMonth {
  return {
    periodStart,
    gmv: totals.gmv,
    eligible: totals.eligible,
    registrations,
    registrationTarget: grid.registrationTarget,
    registrationsNeeded: registrationsNeeded(grid),
    objectiveMet: math.objectiveMet,
    growthPercent: math.growthPercent,
    baseAmount: math.baseAmount,
    growthAmount: math.growthAmount,
    activationPaid: math.activationPaid,
    fastStartEarned: math.fastStartEarned,
    fastStartPaid: math.fastStartPaid,
    quarterlyEarned: math.quarterlyEarned,
    quarterlyPaid: math.quarterlyPaid,
    payableAmount: math.payableAmount,
    holdAmount: math.holdAmount,
    holdReleaseAt,
    recruitmentAmount: 0,
    status,
  };
}

function projectedRelease(periodEnd: string, holdDays: number): string {
  const creditDay = addDays(doualaMidnight(periodEnd), 9);
  return addDays(creditDay, holdDays).toISOString();
}

function monthFromStatement(
  row: StatementRow,
  grid: StoredCommissionGrid,
  holdReleaseAt: string | null
): PortfolioCommissionMonth {
  return {
    periodStart: row.period_start,
    gmv: Number(row.gmv_total),
    eligible: Number(row.eligible_total),
    registrations: row.registration_count,
    registrationTarget: grid.registrationTarget,
    registrationsNeeded: registrationsNeeded(grid),
    objectiveMet: row.objective_met,
    growthPercent: Number(row.growth_percent),
    baseAmount: Number(row.base_amount),
    growthAmount: Number(row.growth_amount),
    activationPaid: Number(row.activation_paid),
    fastStartEarned: Number(row.fast_start_earned),
    fastStartPaid: Number(row.fast_start_paid),
    quarterlyEarned: Number(row.quarterly_earned),
    quarterlyPaid: Number(row.quarterly_paid),
    payableAmount: Number(row.payable_amount),
    holdAmount: Number(row.hold_amount),
    holdReleaseAt,
    recruitmentAmount: Number(row.recruitment_amount),
    status: row.status,
  };
}

function viewFrom(grid: StoredCommissionGrid, month: PortfolioCommissionMonth): PortfolioCommissionView {
  return {
    currency: grid.currency,
    basePercent: grid.basePercent,
    capPercent: grid.capPercent,
    holdPercent: grid.holdPercent,
    holdDays: grid.holdDays,
    registrationTarget: grid.registrationTarget,
    tiers: grid.tiers,
    activationAmount: grid.activationAmount,
    fastStartAmount: grid.fastStartAmount,
    quarterlyAmount: grid.quarterlyAmount,
    courierAmount: grid.courierAmount,
    ambassadorAmount: grid.ambassadorAmount,
    month,
  };
}

function statementObject(
  agentId: string,
  currency: string,
  gridId: string,
  month: PortfolioCommissionMonth
) {
  return {
    agent_id: agentId,
    currency,
    period_start: month.periodStart,
    grid_id: gridId,
    eligible_total: month.eligible,
    gmv_total: month.gmv,
    registration_count: month.registrations,
    objective_met: month.objectiveMet,
    growth_percent: month.growthPercent,
    base_amount: month.baseAmount,
    growth_amount: month.growthAmount,
    activation_paid: month.activationPaid,
    fast_start_earned: month.fastStartEarned,
    fast_start_paid: month.fastStartPaid,
    quarterly_earned: month.quarterlyEarned,
    quarterly_paid: month.quarterlyPaid,
    in_cap_total: month.baseAmount + month.growthAmount + month.activationPaid + month.fastStartPaid + month.quarterlyPaid,
    payable_amount: month.payableAmount,
    hold_amount: month.holdAmount,
    recruitment_amount: month.recruitmentAmount,
    status: 'open',
  };
}

interface ReferredBusiness {
  id: string;
  referred_by_agent_id: string;
  merchant_agreement_accepted_at: string | null;
  agent_user_id: string | null;
  exit: { business_id: string } | null;
}

interface HoldRow {
  id: string;
  agent_id: string;
  currency: string;
  remaining: unknown;
}

interface StatementRow {
  id?: string;
  period_start: string;
  gmv_total: unknown;
  eligible_total: unknown;
  registration_count: number;
  objective_met: boolean;
  growth_percent: unknown;
  base_amount: unknown;
  growth_amount: unknown;
  activation_paid: unknown;
  fast_start_earned: unknown;
  fast_start_paid: unknown;
  quarterly_earned: unknown;
  quarterly_paid: unknown;
  payable_amount: unknown;
  hold_amount: unknown;
  recruitment_amount: unknown;
  status: 'open' | 'credited';
}

function insertAccrualMutation(): string {
  return `
    mutation InsertPortfolioAccrual($object: representative_commission_accruals_insert_input!) {
      insert_representative_commission_accruals_one(
        object: $object
        on_conflict: {
          constraint: representative_commission_accruals_order_id_key
          update_columns: []
        }
      ) { id }
    }
  `;
}

function businessQuery(): string {
  return `
    query PortfolioBusiness($id: uuid!) {
      businesses_by_pk(id: $id) {
        id referred_by_agent_id merchant_agreement_accepted_at
        referring_agent { id user_id }
      }
      representative_portfolio_exits_by_pk(business_id: $id) { business_id }
    }
  `;
}

function lastSaleQuery(): string {
  return `
    query LastPortfolioSale($businessId: uuid!) {
      orders(
        where: { business_id: { _eq: $businessId }, current_status: { _in: [complete, delivered] } }
        order_by: { completed_at: desc }
        limit: 1
      ) { completed_at }
    }
  `;
}

function contractEndQuery(): string {
  return `
    query AgentContractEnd($agentId: uuid!) {
      agent_contracts(
        where: { agent_id: { _eq: $agentId }, signed_at: { _is_null: false } }
        order_by: { signed_at: desc }
        limit: 1
      ) { cancelled_at expired_at }
    }
  `;
}

function insertExitMutation(): string {
  return `
    mutation ExitPortfolio($object: representative_portfolio_exits_insert_input!) {
      insert_representative_portfolio_exits_one(
        object: $object
        on_conflict: { constraint: representative_portfolio_exits_pkey, update_columns: [] }
      ) { business_id }
    }
  `;
}

function zeroDeadMutation(): string {
  return `
    mutation ZeroDeadAccruals($agentId: uuid!) {
      update_representative_commission_accruals(
        where: { agent_id: { _eq: $agentId }, status: { _eq: "open" }, order: { current_status: { _in: [refunded, cancelled, failed] } } }
        _set: { status: "zeroed", eligible_amount: 0, gmv_amount: 0 }
      ) { affected_rows }
    }
  `;
}

function sumAccrualsQuery(): string {
  return `
    query SumPortfolioAccruals(
      $agentId: uuid!, $currency: currency_enum!, $start: timestamptz!, $end: timestamptz!
    ) {
      representative_commission_accruals(where: {
        agent_id: { _eq: $agentId }, currency: { _eq: $currency }, status: { _eq: "open" },
        order: { current_status: { _in: [complete, delivered] }, completed_at: { _gte: $start, _lt: $end } }
      }) { eligible_amount gmv_amount self_purchase }
    }
  `;
}

function statementAccrualsQuery(): string {
  return `
    query StatementPortfolioAccruals($statementId: uuid!) {
      representative_commission_accruals(where: {
        statement_id: { _eq: $statementId }, status: { _eq: "closed" }
      }) { eligible_amount gmv_amount self_purchase }
    }
  `;
}

function registrationCountQuery(): string {
  return `
    query PortfolioRegistrations($agentId: uuid!, $start: timestamptz!, $end: timestamptz!) {
      businesses_aggregate(where: {
        referred_by_agent_id: { _eq: $agentId }
        merchant_agreement_accepted_at: { _gte: $start, _lt: $end }
      }) { aggregate { count } }
    }
  `;
}

function agentsInPeriodQuery(): string {
  return `
    query AgentsInPortfolioPeriod($start: timestamptz!, $end: timestamptz!) {
      representative_commission_accruals(where: {
        status: { _eq: "open" }
        order: { current_status: { _in: [complete, delivered] }, completed_at: { _gte: $start, _lt: $end } }
      }) { agent_id currency }
    }
  `;
}

function openStatementsQuery(): string {
  return `
    query OpenPortfolioStatements($periodStart: date!) {
      representative_commission_statements(where: {
        status: { _eq: "open" }, period_start: { _eq: $periodStart }
      }) { agent_id currency }
    }
  `;
}

function holdReleaseQuery(): string {
  return `
    query PortfolioHoldRelease($statementId: uuid!) {
      representative_commission_holds(
        where: { statement_id: { _eq: $statementId } }
        order_by: { release_at: asc }
        limit: 1
      ) { release_at }
    }
  `;
}

function loadStatementQuery(): string {
  return `
    query LoadPortfolioStatement($agentId: uuid!, $currency: currency_enum!, $periodStart: date!) {
      representative_commission_statements(where: {
        agent_id: { _eq: $agentId }, currency: { _eq: $currency }, period_start: { _eq: $periodStart }
      }, limit: 1) {
        id period_start gmv_total eligible_total registration_count objective_met growth_percent
        base_amount growth_amount activation_paid fast_start_earned fast_start_paid
        quarterly_earned quarterly_paid payable_amount hold_amount recruitment_amount status
      }
    }
  `;
}

function insertStatementMutation(): string {
  return `
    mutation InsertPortfolioStatement($object: representative_commission_statements_insert_input!) {
      insert_representative_commission_statements_one(
        object: $object
        on_conflict: { constraint: uq_representative_commission_statements_period, update_columns: [] }
      ) { id }
    }
  `;
}

function updateStatementMutation(): string {
  return `
    mutation UpdatePortfolioStatement($id: uuid!, $set: representative_commission_statements_set_input!) {
      update_representative_commission_statements_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    }
  `;
}

function statementPatch(month: PortfolioCommissionMonth) {
  const row = statementObject('', '', '', month);
  return {
    eligible_total: row.eligible_total,
    gmv_total: row.gmv_total,
    registration_count: row.registration_count,
    objective_met: row.objective_met,
    growth_percent: row.growth_percent,
    base_amount: row.base_amount,
    growth_amount: row.growth_amount,
    activation_paid: row.activation_paid,
    fast_start_earned: row.fast_start_earned,
    fast_start_paid: row.fast_start_paid,
    quarterly_earned: row.quarterly_earned,
    quarterly_paid: row.quarterly_paid,
    in_cap_total: row.in_cap_total,
    payable_amount: row.payable_amount,
    hold_amount: row.hold_amount,
    recruitment_amount: row.recruitment_amount,
  };
}

function attachAccrualsMutation(): string {
  return `
    mutation AttachPortfolioAccruals(
      $agentId: uuid!, $currency: currency_enum!, $start: timestamptz!, $end: timestamptz!,
 $statementId: uuid!
    ) {
      update_representative_commission_accruals(
        where: {
          agent_id: { _eq: $agentId }, currency: { _eq: $currency }, status: { _eq: "open" },
          order: { current_status: { _in: [complete, delivered] }, completed_at: { _gte: $start, _lt: $end } }
        }
        _set: { status: "closed", statement_id: $statementId }
      ) { affected_rows }
    }
  `;
}

function markCreditedMutation(): string {
  return `
    mutation CreditPortfolioStatement($id: uuid!, $at: timestamptz!) {
      update_representative_commission_statements_by_pk(
        pk_columns: { id: $id }
        _set: { status: "credited", credited_at: $at }
      ) { id }
    }
  `;
}

function insertHoldMutation(): string {
  return `
    mutation InsertPortfolioHold($object: representative_commission_holds_insert_input!) {
      insert_representative_commission_holds_one(
        object: $object
        on_conflict: {
          constraint: uq_representative_commission_holds_statement
          update_columns: []
        }
      ) { id }
    }
  `;
}

function agentUserIdQuery(): string {
  return `
    query PortfolioAgentUserId($agentId: uuid!) {
      agents_by_pk(id: $agentId) { user_id }
    }
  `;
}

function portfolioPaidQuery(): string {
  return `
    query PortfolioPaidTotals($agentId: uuid!, $currency: currency_enum!) {
      credited: representative_commission_statements_aggregate(where: {
        agent_id: { _eq: $agentId }, currency: { _eq: $currency }, status: { _eq: "credited" }
      }) { aggregate { sum { payable_amount recruitment_amount } } }
      open: representative_commission_statements_aggregate(where: {
        agent_id: { _eq: $agentId }, currency: { _eq: $currency }, status: { _eq: "open" }
      }) { aggregate { sum { payable_amount recruitment_amount } } }
      holds: representative_commission_holds_aggregate(where: {
        agent_id: { _eq: $agentId }, currency: { _eq: $currency }, status: { _eq: "released" }
      }) { aggregate { sum { amount } } }
    }
  `;
}

function dueHoldsQuery(): string {
  return `
    query DuePortfolioHolds($now: timestamptz!) {
      representative_commission_holds(where: { status: { _eq: "held" }, release_at: { _lte: $now } }) {
        id agent_id currency remaining
      }
    }
  `;
}

function releaseHoldMutation(): string {
  return `
    mutation ReleasePortfolioHold($id: uuid!) {
      update_representative_commission_holds_by_pk(
        pk_columns: { id: $id }
        _set: { status: "released", remaining: 0 }
      ) { id }
    }
  `;
}

function inPeriod(at: number, period: { start: string; end: string }): boolean {
  const range = periodRange(period);
  return at >= Date.parse(range.start) && at < Date.parse(range.end);
}

function saleInstant(completedAt?: string | null): Date | null {
  const parsed = Date.parse(completedAt ?? '');
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function saleIsWithin(completedAt: string | null | undefined, inactiveDays: number): boolean {
  const at = Date.parse(completedAt ?? '');
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < inactiveDays * 86400000;
}

function monthIsEmpty(month: PortfolioCommissionMonth): boolean {
  return month.payableAmount <= 0 && month.holdAmount <= 0 && month.recruitmentAmount <= 0;
}

function isUniqueViolation(error: any): boolean {
  return /uniqueness|unique constraint/i.test(String(error?.message ?? error));
}

interface PremiumDraft {
  kind: 'activation' | 'fast_start' | 'courier' | 'ambassador';
  subjectId: string;
  amount: number;
  qualifiedAt?: string;
}

function draft(
  kind: PremiumDraft['kind'],
  subjectId: string,
  amount: number,
  at?: number
): PremiumDraft {
  return { kind, subjectId, amount, qualifiedAt: at == null ? undefined : new Date(at).toISOString() };
}

function premiumObject(
  agentId: string,
  currency: string,
  statementId: string,
  periodStart: string,
  premium: PremiumDraft,
  lost: boolean
) {
  return {
    agent_id: agentId,
    currency,
    kind: premium.kind,
    subject_id: premium.subjectId,
    earned_amount: premium.amount,
    paid_amount: lost ? 0 : premium.amount,
    status: lost ? 'lost' : 'paid',
    qualified_at: premium.qualifiedAt ?? new Date().toISOString(),
    statement_id: statementId,
    period_start: periodStart,
  };
}

function xafAgents(result: {
  agent_contracts?: Array<{ agent_id?: string | null }>;
  agents?: Array<{ referred_by_agent_id?: string | null }>;
  businesses?: Array<{ referred_by_agent_id?: string | null }>;
}) {
  const ids = [
    ...(result?.agent_contracts ?? []).map((row) => row.agent_id),
    ...(result?.agents ?? []).map((row) => row.referred_by_agent_id),
    ...(result?.businesses ?? []).map((row) => row.referred_by_agent_id),
  ];
  return ids.filter((id): id is string => !!id).map((agent_id) => ({ agent_id, currency: 'XAF' }));
}

interface Recruit {
  id: string;
  referrerId: string;
  signedAt: string | null;
}

interface RecruitRow {
  id: string;
  agent_contracts?: Array<{ signed_at?: string | null }>;
}

function activationBusinessesQuery(): string {
  return `
    query ActivationBusinesses($agentId: uuid!, $currency: String!) {
      agents_by_pk(id: $agentId) { user_id }
      businesses(where: {
        referred_by_agent_id: { _eq: $agentId }
        merchant_agreement_accepted_at: { _is_null: false }
      }) {
        id merchant_agreement_accepted_at
        orders(where: { currency: { _eq: $currency }, current_status: { _in: [complete, delivered] } }) {
          subtotal completed_at
          client { user_id }
        }
      }
    }
  `;
}

function referredAgentsQuery(): string {
  return `
    query ReferredCouriers($agentId: uuid!) {
      agents(where: { referred_by_agent_id: { _eq: $agentId } }) {
        id
        agent_contracts(where: { signed_at: { _is_null: false } }, order_by: { signed_at: asc }, limit: 1) {
          signed_at
        }
      }
    }
  `;
}

function deliveryQuery(): string {
  return `
    query CourierDeliveries(
      $agentId: uuid!, $currency: String!, $start: timestamptz!, $end: timestamptz!,
 $offset: Int!
    ) {
      orders(
        where: {
          assigned_agent_id: { _eq: $agentId }, currency: { _eq: $currency },
          current_status: { _in: [complete, delivered] }, completed_at: { _gte: $start, _lte: $end }
        }
        order_by: { completed_at: asc }
        limit: 1
        offset: $offset
      ) { completed_at }
    }
  `;
}

function ambassadorSignupsQuery(): string {
  return `
    query AmbassadorSignups($agentId: uuid!, $start: timestamptz!, $end: timestamptz!, $offset: Int!) {
      businesses(
        where: {
          referred_by_agent_id: { _eq: $agentId }
          merchant_agreement_accepted_at: { _gte: $start, _lte: $end }
        }
        order_by: { merchant_agreement_accepted_at: asc }
        limit: 1
        offset: $offset
      ) { merchant_agreement_accepted_at }
    }
  `;
}

function premiumExistsQuery(): string {
  return `
    query PremiumExists($agentId: uuid!, $kind: String!, $subjectId: uuid!) {
      representative_commission_premiums(where: {
        agent_id: { _eq: $agentId }, kind: { _eq: $kind }, subject_id: { _eq: $subjectId }
      }, limit: 1) { id statement_id }
    }
  `;
}

function paidSubjectsQuery(): string {
  return `
    query PaidPremiumSubjects($agentId: uuid!, $kind: String!) {
      representative_commission_premiums(where: { agent_id: { _eq: $agentId }, kind: { _eq: $kind } }) {
        subject_id statement_id
      }
    }
  `;
}

function premiumAgentsQuery(): string {
  return `
    query PremiumCloseCandidates(
      $fastFrom: timestamptz!, $fastTo: timestamptz!, $recruitFrom: timestamptz!, $periodEnd: timestamptz!
    ) {
      agent_contracts(where: { signed_at: { _gte: $fastFrom, _lt: $fastTo } }) { agent_id }
      agents(where: {
        referred_by_agent_id: { _is_null: false }
        agent_contracts: { signed_at: { _gte: $recruitFrom, _lt: $periodEnd } }
      }) { referred_by_agent_id }
      businesses(where: {
        referred_by_agent_id: { _is_null: false }
        merchant_agreement_accepted_at: { _gte: $recruitFrom, _lt: $periodEnd }
      }) { referred_by_agent_id }
    }
  `;
}

function insertPremiumMutation(): string {
  return `
    mutation InsertPortfolioPremium($object: representative_commission_premiums_insert_input!) {
      insert_representative_commission_premiums_one(object: $object) { id }
    }
  `;
}

function signedAtQuery(): string {
  return `
    query AgentSignedAt($agentId: uuid!) {
      agent_contracts(
        where: { agent_id: { _eq: $agentId }, signed_at: { _is_null: false } }
        order_by: { signed_at: asc }
        limit: 1
      ) { signed_at }
    }
  `;
}

function windowSalesQuery(): string {
  return `
    query WindowPortfolioSales(
      $agentId: uuid!, $currency: String!, $start: timestamptz!, $end: timestamptz!
    ) {
      orders_aggregate(where: {
        business: { referred_by_agent_id: { _eq: $agentId } }
        currency: { _eq: $currency }
        current_status: { _in: [complete, delivered] }
        completed_at: { _gte: $start, _lt: $end }
      }) { aggregate { sum { subtotal } } }
    }
  `;
}

function personalAccountQuery(): string {
  return `
    query PortfolioAgentAccount($agentId: uuid!, $currency: currency_enum!) {
      agents_by_pk(id: $agentId) {
        user {
          accounts(where: {
            currency: { _eq: $currency }, is_active: { _eq: true }, business_location_id: { _is_null: true }
          }, limit: 1) { id }
        }
      }
    }
  `;
}

