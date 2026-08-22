import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigurationsService } from '../admin/configurations.service';
import {
  BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
  currencyForReferralPayout,
} from '../business-referral-payouts/business-referral-payout.constants';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReferralPyramidService } from '../referrals/referral-pyramid.service';
import { referralReferenceUuid } from '../referrals/referral-pyramid.util';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  BUSINESS_REFERRAL_10_ITEMS,
  evaluateCompensation,
  ONBOARDING_RULES,
  SALE_PERCENT,
  type CompensationAction,
  type CompensationMarketConfig,
  type CompensationRuleCode,
  type CompletedSale,
} from './compensation-rules';

const DEFAULTS: Record<string, CompensationMarketConfig> = {
  CM: {
    currency: 'XAF',
    onboarding10FirstSale: 7500,
    onboarding25SmallSale: 10000,
    onboarding25LargeSale: 15000,
    smallSaleMaxExclusive: 10000,
    largeSaleMaxInclusive: 25000,
    salePercent: 1,
    businessReferral10Items: 1000,
  },
  GA: {
    currency: 'XAF',
    onboarding10FirstSale: 7500,
    onboarding25SmallSale: 10000,
    onboarding25LargeSale: 15000,
    smallSaleMaxExclusive: 10000,
    largeSaleMaxInclusive: 25000,
    salePercent: 1,
    businessReferral10Items: 1000,
  },
  CA: {
    currency: 'CAD',
    onboarding10FirstSale: 25,
    onboarding25SmallSale: 40,
    onboarding25LargeSale: 50,
    smallSaleMaxExclusive: 25,
    largeSaleMaxInclusive: 75,
    salePercent: 1,
    businessReferral10Items: 10,
  },
};

export interface CompensationCreditResult {
  credited: number;
  skipped: number;
  failed: number;
}

export interface CompensationEventRow {
  id: string;
  rule_code: CompensationRuleCode;
  amount: number;
  gross_milestone_amount: number | null;
  currency: string;
  country_code: string;
  status: string;
  item_count: number | null;
  sale_amount: number | null;
  created_at: string;
  business_id: string | null;
  triggering_order_id: string | null;
  earner_agent_id: string | null;
  earner_business_id: string | null;
  business?: { id: string; name: string } | null;
}

export interface CompensationPreviewRow {
  businessId: string;
  businessName: string;
  ruleCode: CompensationRuleCode;
  amount: number;
  currency: string;
  countryCode: string;
  itemCount: number;
  orderId: string | null;
  earnerKind: 'agent' | 'business';
  earnerId: string;
  earnerUserId: string;
  earnerName: string;
}

interface BusinessSnapshot {
  id: string;
  name: string;
  created_at: string;
  lifecycle_status?: string | null;
  referred_by_agent_id: string | null;
  referred_by_business_id: string | null;
  referring_agent: {
    id: string;
    user_id: string;
    user: { first_name?: string; last_name?: string };
  } | null;
  referring_business: {
    id: string;
    name: string;
    user_id: string;
    user?: { first_name?: string; last_name?: string };
  } | null;
  items_aggregate: { aggregate: { count: number } };
}

interface EventClaim {
  id: string;
  reference_id: string;
  status: string;
}

interface EarnerInfo {
  kind: 'agent' | 'business';
  id: string;
  userId: string;
  name: string;
}

interface EvalContext {
  currency: string;
  countryCode: string;
  rail: string;
  earner: EarnerInfo;
  itemCount: number;
  paidSalePercentOrderIds: string[];
}

@Injectable()
export class RepresentativeCompensationService {
  private readonly logger = new Logger(RepresentativeCompensationService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly configurationsService: ConfigurationsService,
    private readonly referralPyramidService: ReferralPyramidService,
    private readonly accountsService: AccountsService
  ) {}

  async evaluateForBusinessSafe(businessId: string): Promise<void> {
    try {
      await this.evaluate(businessId);
    } catch (error: any) {
      this.logger.error(
        `Compensation business ${businessId} failed: ${error.message}`
      );
    }
  }

  async evaluateForOrderSafe(orderId: string, businessId: string): Promise<void> {
    try {
      await this.evaluate(businessId, orderId);
    } catch (error: any) {
      this.logger.error(
        `Compensation order ${orderId} failed: ${error.message}`
      );
    }
  }

  async evaluateForBusiness(businessId: string): Promise<CompensationCreditResult> {
    return this.evaluate(businessId);
  }

  async evaluateForOrder(
    orderId: string,
    businessId: string
  ): Promise<CompensationCreditResult> {
    return this.evaluate(businessId, orderId);
  }

  async sweepPending(): Promise<CompensationCreditResult> {
    const totals = this.emptyResult();
    if (!(await this.isEnabled())) return totals;
    this.addTotals(totals, await this.retryOpenEvents());
    for (const businessId of await this.listCandidateBusinessIds()) {
      this.addTotals(totals, await this.evaluate(businessId));
    }
    for (const order of await this.listUnpaidCompletedOrders()) {
      this.addTotals(totals, await this.evaluate(order.business_id, order.id));
    }
    return totals;
  }

  async previewPending(countryCode?: string): Promise<CompensationPreviewRow[]> {
    if (!(await this.isEnabled())) return [];
    const rows: CompensationPreviewRow[] = [];
    const wanted = countryCode?.toUpperCase();
    for (const businessId of await this.listCandidateBusinessIds()) {
      for (const row of await this.previewBusiness(businessId)) {
        if (wanted && row.countryCode !== wanted) continue;
        rows.push(row);
      }
    }
    return rows;
  }

  async previewForReferrer(params: {
    agentId?: string;
    businessId?: string;
    userId: string;
  }): Promise<{
    payableCount: number;
    amountPerReferral: number;
    projectedAmount: number;
    currency: string;
  }> {
    const country = await this.paymentRoutingService.getUserCountryCode(
      params.userId
    );
    const currency = currencyForReferralPayout(country);
    if (!(await this.isEnabled())) {
      return {
        payableCount: 0,
        amountPerReferral: 0,
        projectedAmount: 0,
        currency,
      };
    }
    let payableCount = 0;
    let projectedAmount = 0;
    for (const businessId of await this.listReferredBusinessIds(params)) {
      const pending = await this.previewBusiness(businessId);
      const sum = pending.reduce((acc, row) => acc + row.amount, 0);
      if (sum > 0) {
        payableCount += 1;
        projectedAmount += sum;
      }
    }
    return {
      payableCount,
      amountPerReferral: payableCount ? projectedAmount / payableCount : 0,
      projectedAmount,
      currency,
    };
  }

  async listEvents(params: {
    countryCode?: string;
    limit?: number;
  }): Promise<CompensationEventRow[]> {
    const query = `
      query ListCompensationEvents(
        $where: representative_compensation_events_bool_exp!
        $limit: Int!
      ) {
        representative_compensation_events(
          where: $where
          order_by: { created_at: desc }
          limit: $limit
        ) {
          id rule_code amount gross_milestone_amount currency country_code
          status item_count sale_amount created_at business_id
          triggering_order_id earner_agent_id earner_business_id
          business { id name }
        }
      }
    `;
    const where: Record<string, unknown> = {};
    if (params.countryCode) {
      where.country_code = { _eq: params.countryCode.toUpperCase() };
    }
    const result = await this.hasuraSystemService.executeQuery(query, {
      where,
      limit: params.limit ?? 100,
    });
    return result?.representative_compensation_events ?? [];
  }

  private async evaluate(
    businessId: string,
    triggeringOrderId?: string
  ): Promise<CompensationCreditResult> {
    const result = this.emptyResult();
    if (!(await this.isEnabled())) return result;
    const snapshot = await this.loadSnapshot(businessId);
    if (!this.isEligible(snapshot)) {
      result.skipped += 1;
      return result;
    }
    const context = await this.buildContext(snapshot, triggeringOrderId);
    if (!context) {
      result.skipped += 1;
      return result;
    }
    const actions = evaluateCompensation(context.input);
    if (actions.length === 0) {
      result.skipped += 1;
      return result;
    }
    for (const action of actions) {
      const credited = await this.creditAction(snapshot, context, action);
      if (credited === true) result.credited += 1;
      else if (credited === false) result.failed += 1;
      else result.skipped += 1;
    }
    return result;
  }

  private async previewBusiness(
    businessId: string
  ): Promise<CompensationPreviewRow[]> {
    const snapshot = await this.loadSnapshot(businessId);
    if (!this.isEligible(snapshot)) return [];
    const context = await this.buildContext(snapshot);
    if (!context) return [];
    const actions = [
      ...evaluateCompensation(context.input),
      ...this.pendingSalePercentActions(context),
    ];
    return actions.map((action) => ({
      businessId: snapshot.id,
      businessName: snapshot.name,
      ruleCode: action.ruleCode,
      amount: action.amount,
      currency: context.eval.currency,
      countryCode: context.eval.countryCode,
      itemCount: context.eval.itemCount,
      orderId: action.orderId,
      earnerKind: context.eval.earner.kind,
      earnerId: context.eval.earner.id,
      earnerUserId: context.eval.earner.userId,
      earnerName: context.eval.earner.name,
    }));
  }

  private pendingSalePercentActions(context: {
    input: Parameters<typeof evaluateCompensation>[0];
    eval: EvalContext;
  }): CompensationAction[] {
    const skipIds = new Set([
      ...(context.input.onboardingTriggerOrderIds ?? []),
      ...context.eval.paidSalePercentOrderIds,
    ]);
    const actions: CompensationAction[] = [];
    for (const sale of context.input.completedSales) {
      if (skipIds.has(sale.id)) continue;
      if (sale.currency !== context.input.payoutCurrency) continue;
      const extra = evaluateCompensation({
        ...context.input,
        triggeringOrderId: sale.id,
      });
      for (const action of extra) {
        if (action.ruleCode !== SALE_PERCENT) continue;
        if (actions.some((row) => row.orderId === action.orderId)) continue;
        actions.push(action);
      }
    }
    return actions;
  }

  private isEligible(snapshot: BusinessSnapshot | null): snapshot is BusinessSnapshot {
    if (!snapshot) return false;
    if (snapshot.created_at < BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE) return false;
    const agentReferred = Boolean(snapshot.referred_by_agent_id);
    const businessReferred = Boolean(snapshot.referred_by_business_id);
    if (!agentReferred && !businessReferred) return false;
    if (businessReferred && !agentReferred) {
      return snapshot.lifecycle_status === 'active';
    }
    return true;
  }

  private async buildContext(
    snapshot: BusinessSnapshot,
    triggeringOrderId?: string
  ): Promise<{
    input: Parameters<typeof evaluateCompensation>[0];
    eval: EvalContext;
  } | null> {
    const earner = this.earnerFrom(snapshot);
    if (!earner) return null;
    const countryCode = (
      (await this.paymentRoutingService.getUserCountryCode(earner.userId)) ||
      'CM'
    ).toUpperCase();
    const currency = currencyForReferralPayout(countryCode);
    const [sales, events, legacy, config, rail] = await Promise.all([
      this.loadCompletedSales(snapshot.id),
      this.loadEvents(snapshot.id),
      this.loadLegacyAmount(snapshot.id),
      this.loadMarketConfig(countryCode, currency),
      this.paymentRoutingService.resolveRailForUser(earner.userId),
    ]);
    const liveEvents = events.filter((event) => event.status !== 'failed');
    const alreadyPaidOnboarding =
      legacy +
      liveEvents
        .filter((event) =>
          (ONBOARDING_RULES as readonly string[]).includes(event.rule_code)
        )
        .reduce((sum, event) => sum + Number(event.amount), 0);
    const onboardingTriggerOrderIds = liveEvents
      .filter(
        (event) =>
          (ONBOARDING_RULES as readonly string[]).includes(event.rule_code) &&
          event.triggering_order_id
      )
      .map((event) => event.triggering_order_id as string);
    const catalogOnboardingAt = liveEvents
      .filter(
        (event) =>
          (ONBOARDING_RULES as readonly string[]).includes(event.rule_code) &&
          !event.triggering_order_id &&
          event.created_at
      )
      .map((event) => event.created_at as string)
      .sort()
      .pop();
    if (catalogOnboardingAt) {
      for (const sale of sales) {
        if (sale.completedAt && sale.completedAt <= catalogOnboardingAt) {
          onboardingTriggerOrderIds.push(sale.id);
        }
      }
    }
    const paidSalePercentOrderIds = liveEvents
      .filter(
        (event) => event.rule_code === SALE_PERCENT && event.triggering_order_id
      )
      .map((event) => event.triggering_order_id as string);
    return {
      input: {
        approvedItemCount: snapshot.items_aggregate.aggregate.count,
        completedSales: sales,
        payoutCurrency: currency,
        alreadyPaidOnboarding,
        hasAgentReferrer: Boolean(snapshot.referred_by_agent_id),
        hasBusinessReferrer: Boolean(snapshot.referred_by_business_id),
        alreadyPaidBusinessReferral: liveEvents.some(
          (event) => event.rule_code === BUSINESS_REFERRAL_10_ITEMS
        ),
        triggeringOrderId,
        onboardingTriggerOrderIds,
        config,
      },
      eval: {
        currency,
        countryCode,
        rail,
        earner,
        itemCount: snapshot.items_aggregate.aggregate.count,
        paidSalePercentOrderIds,
      },
    };
  }

  private earnerFrom(snapshot: BusinessSnapshot): EarnerInfo | null {
    if (snapshot.referring_agent?.user_id) {
      const user = snapshot.referring_agent.user;
      const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
      return {
        kind: 'agent',
        id: snapshot.referring_agent.id,
        userId: snapshot.referring_agent.user_id,
        name: name || 'Agent',
      };
    }
    if (snapshot.referring_business?.user_id) {
      return {
        kind: 'business',
        id: snapshot.referring_business.id,
        userId: snapshot.referring_business.user_id,
        name: snapshot.referring_business.name || 'Business',
      };
    }
    return null;
  }

  private async creditAction(
    snapshot: BusinessSnapshot,
    context: NonNullable<Awaited<ReturnType<RepresentativeCompensationService['buildContext']>>>,
    action: CompensationAction
  ): Promise<boolean | null> {
    const claimed = await this.claimEvent(snapshot, context, action);
    if (!claimed) return null;
    if (claimed.status === 'credited') return null;
    return this.fulfillEvent(claimed, snapshot, context, action);
  }

  private async fulfillEvent(
    event: EventClaim,
    snapshot: BusinessSnapshot,
    context: NonNullable<Awaited<ReturnType<RepresentativeCompensationService['buildContext']>>>,
    action: CompensationAction
  ): Promise<boolean> {
    try {
      if (action.ruleCode === SALE_PERCENT) {
        return this.creditSalePercent(event, snapshot, context, action);
      }
      return this.creditMilestone(event, snapshot, context, action);
    } catch (error: any) {
      this.logger.error(`Credit ${event.id} failed: ${error.message}`);
      await this.markEvent(event.id, 'failed');
      return false;
    }
  }

  private async creditMilestone(
    event: EventClaim,
    snapshot: BusinessSnapshot,
    context: NonNullable<Awaited<ReturnType<RepresentativeCompensationService['buildContext']>>>,
    action: CompensationAction
  ): Promise<boolean> {
    const earner = context.eval.earner;
    const result = await this.referralPyramidService.distributeReferralBonus({
      grossAmount: action.amount,
      earner: {
        kind: earner.kind,
        id: earner.id,
        userId: earner.userId,
        name: earner.name,
      },
      referred: { kind: 'business', id: snapshot.id, name: snapshot.name },
      preferPersonalAccount: earner.kind === 'agent',
      currency: context.eval.currency,
      compensationEventId: event.id,
    });
    if (result.credited <= 0) {
      await this.markEvent(event.id, 'failed');
      return false;
    }
    await this.markEvent(event.id, 'credited', {
      account_transaction_id: result.transactionIds[0] ?? null,
    });
    return true;
  }

  private async creditSalePercent(
    event: EventClaim,
    snapshot: BusinessSnapshot,
    context: NonNullable<Awaited<ReturnType<RepresentativeCompensationService['buildContext']>>>,
    action: CompensationAction
  ): Promise<boolean> {
    const earner = context.eval.earner;
    const accountId = await this.findEarnerAccountId(
      earner.userId,
      earner.kind === 'business' ? earner.id : null,
      context.eval.currency
    );
    if (!accountId) {
      await this.markEvent(event.id, 'failed');
      return false;
    }
    const existing =
      (await this.accountsService.findDepositByReference(
        accountId,
        event.reference_id
      )) ??
      (await this.accountsService.findDepositByReferenceId(event.reference_id));
    let transactionId = existing?.id ?? null;
    if (!transactionId) {
      const tx = await this.accountsService.registerTransaction({
        accountId,
        amount: action.amount,
        transactionType: 'deposit',
        memo: `1% sale commission for ${snapshot.name}`,
        referenceId: event.reference_id,
      });
      if (!tx.success || !tx.transactionId) {
        await this.markEvent(event.id, 'failed');
        return false;
      }
      transactionId = tx.transactionId;
    }
    await this.markEvent(event.id, 'credited', {
      account_id: accountId,
      account_transaction_id: transactionId,
    });
    return true;
  }

  private async claimEvent(
    snapshot: BusinessSnapshot,
    context: NonNullable<Awaited<ReturnType<RepresentativeCompensationService['buildContext']>>>,
    action: CompensationAction
  ): Promise<EventClaim | null> {
    const referenceId = referralReferenceUuid(
      `comp:${action.ruleCode}:${snapshot.id}:${action.orderId ?? 'none'}`
    );
    const mutation = `
      mutation InsertCompensationEvent(
        $object: representative_compensation_events_insert_input!
      ) {
        insert_representative_compensation_events_one(object: $object) {
          id reference_id status
        }
      }
    `;
    const earner = context.eval.earner;
    try {
      const result = await this.hasuraSystemService.executeMutation(mutation, {
        object: {
          rule_code: action.ruleCode,
          earner_agent_id: earner.kind === 'agent' ? earner.id : null,
          earner_business_id: earner.kind === 'business' ? earner.id : null,
          earner_user_id: earner.userId,
          business_id: snapshot.id,
          triggering_order_id: action.orderId,
          amount: action.amount,
          gross_milestone_amount: action.grossMilestoneAmount,
          currency: context.eval.currency,
          country_code: context.eval.countryCode,
          rail: context.eval.rail,
          item_count: context.eval.itemCount,
          sale_amount: action.saleAmount,
          status: 'pending',
          reference_id: referenceId,
        },
      });
      return result?.insert_representative_compensation_events_one ?? null;
    } catch (error: any) {
      if (!this.isUniqueViolation(error)) throw error;
      return this.findExistingEvent(action.ruleCode, snapshot.id, action.orderId);
    }
  }

  private async findExistingEvent(
    ruleCode: CompensationRuleCode,
    businessId: string,
    orderId: string | null
  ): Promise<EventClaim | null> {
    const where =
      ruleCode === SALE_PERCENT
        ? { rule_code: { _eq: ruleCode }, triggering_order_id: { _eq: orderId } }
        : { rule_code: { _eq: ruleCode }, business_id: { _eq: businessId } };
    const query = `
      query ExistingCompensationEvent(
        $where: representative_compensation_events_bool_exp!
      ) {
        representative_compensation_events(where: $where, limit: 1) {
          id reference_id status
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { where });
    return result?.representative_compensation_events?.[0] ?? null;
  }

  private async markEvent(
    id: string,
    status: 'credited' | 'failed',
    extra?: {
      account_id?: string | null;
      account_transaction_id?: string | null;
    }
  ): Promise<void> {
    const mutation = `
      mutation MarkCompensationEvent(
        $id: uuid!
        $set: representative_compensation_events_set_input!
      ) {
        update_representative_compensation_events_by_pk(
          pk_columns: { id: $id }
          _set: $set
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id,
      set: { status, ...(extra ?? {}) },
    });
  }

  private async retryOpenEvents(): Promise<CompensationCreditResult> {
    const result = this.emptyResult();
    const query = `
      query OpenCompensationEvents {
        representative_compensation_events(
          where: { status: { _in: ["pending", "failed"] } }
          limit: 200
        ) {
          business_id triggering_order_id
        }
      }
    `;
    const rows =
      (await this.hasuraSystemService.executeQuery(query))
        ?.representative_compensation_events ?? [];
    for (const row of rows) {
      if (!row.business_id) {
        result.skipped += 1;
        continue;
      }
      this.addTotals(
        result,
        await this.evaluate(row.business_id, row.triggering_order_id ?? undefined)
      );
    }
    return result;
  }

  private async loadSnapshot(businessId: string): Promise<BusinessSnapshot | null> {
    const query = `
      query CompensationBusiness($id: uuid!) {
        businesses_by_pk(id: $id) {
          id name created_at lifecycle_status
          referred_by_agent_id
          referred_by_business_id
          referring_agent {
            id user_id
            user { first_name last_name }
          }
          referring_business {
            id name user_id
            user { first_name last_name }
          }
          items_aggregate(
            where: {
              status: { _eq: active }
              is_active: { _eq: true }
              moderation_status: { _eq: approved }
            }
          ) { aggregate { count } }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id: businessId,
    });
    return result?.businesses_by_pk ?? null;
  }

  private async loadCompletedSales(businessId: string): Promise<CompletedSale[]> {
    const query = `
      query CompensationSales($businessId: uuid!) {
        orders(
          where: {
            business_id: { _eq: $businessId }
            current_status: { _in: [complete, delivered] }
          }
        ) { id subtotal currency completed_at }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return (result?.orders ?? []).map((row: any) => ({
      id: row.id,
      subtotal: Number(row.subtotal ?? 0),
      currency: String(row.currency ?? ''),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
    }));
  }

  private async loadEvents(
    businessId: string
  ): Promise<
    Array<{
      rule_code: string;
      amount: number;
      status: string;
      triggering_order_id: string | null;
      created_at?: string;
    }>
  > {
    const query = `
      query CompensationEventsForBusiness($businessId: uuid!) {
        representative_compensation_events(
          where: { business_id: { _eq: $businessId } }
        ) { rule_code amount status triggering_order_id created_at }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return result?.representative_compensation_events ?? [];
  }

  private async loadLegacyAmount(businessId: string): Promise<number> {
    const query = `
      query LegacyReferralPayout($businessId: uuid!) {
        business_referral_payouts(where: { business_id: { _eq: $businessId } }) {
          amount
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return (result?.business_referral_payouts ?? []).reduce(
      (sum: number, row: { amount: number }) => sum + Number(row.amount ?? 0),
      0
    );
  }

  private async loadMarketConfig(
    countryCode: string,
    currency: string
  ): Promise<CompensationMarketConfig> {
    const fallback = DEFAULTS[countryCode] ?? { ...DEFAULTS.CM, currency };
    const read = async (key: string, fallbackValue: number) => {
      try {
        const config = await this.configurationsService.getConfigurationByKey(
          key,
          countryCode
        );
        const value = Number(config?.number_value);
        return Number.isFinite(value) && value > 0 ? value : fallbackValue;
      } catch {
        return fallbackValue;
      }
    };
    return {
      currency,
      onboarding10FirstSale: await read(
        'onboarding_10_first_sale_amount',
        fallback.onboarding10FirstSale
      ),
      onboarding25SmallSale: await read(
        'onboarding_25_small_sale_amount',
        fallback.onboarding25SmallSale
      ),
      onboarding25LargeSale: await read(
        'onboarding_25_large_sale_amount',
        fallback.onboarding25LargeSale
      ),
      smallSaleMaxExclusive: await read(
        'onboarding_small_sale_max',
        fallback.smallSaleMaxExclusive
      ),
      largeSaleMaxInclusive: await read(
        'onboarding_large_sale_max',
        fallback.largeSaleMaxInclusive
      ),
      salePercent: await read(
        'sale_only_commission_percent',
        fallback.salePercent
      ),
      businessReferral10Items: await read(
        'business_to_business_referral_amount',
        fallback.businessReferral10Items
      ),
    };
  }

  private async isEnabled(): Promise<boolean> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        'business_referral_payout_enabled'
      );
      return config?.boolean_value === true && config?.status === 'active';
    } catch {
      return false;
    }
  }

  private async listCandidateBusinessIds(): Promise<string[]> {
    const query = `
      query CompensationCandidateBusinesses($cutoff: timestamptz!) {
        businesses(
          where: {
            created_at: { _gte: $cutoff }
            _or: [
              { referred_by_agent_id: { _is_null: false } }
              { referred_by_business_id: { _is_null: false } }
            ]
          }
          limit: 500
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      cutoff: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
    });
    return (result?.businesses ?? []).map((row: { id: string }) => row.id);
  }

  private async listUnpaidCompletedOrders(): Promise<
    Array<{ id: string; business_id: string }>
  > {
    const query = `
      query CompensationUnpaidOrders($cutoff: timestamptz!) {
        orders(
          where: {
            current_status: { _in: [complete, delivered] }
            business: {
              referred_by_agent_id: { _is_null: false }
              created_at: { _gte: $cutoff }
            }
            _not: { representative_compensation_events: {} }
          }
          limit: 200
        ) { id business_id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      cutoff: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
    });
    return result?.orders ?? [];
  }

  private async listReferredBusinessIds(params: {
    agentId?: string;
    businessId?: string;
  }): Promise<string[]> {
    const field = params.agentId
      ? 'referred_by_agent_id'
      : 'referred_by_business_id';
    const id = params.agentId ?? params.businessId;
    const query = `
      query CompensationReferredBusinesses($id: uuid!, $cutoff: timestamptz!) {
        businesses(
          where: { ${field}: { _eq: $id }, created_at: { _gte: $cutoff } }
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id,
      cutoff: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
    });
    return (result?.businesses ?? []).map((row: { id: string }) => row.id);
  }

  private async findEarnerAccountId(
    userId: string,
    businessId: string | null,
    currency: string
  ): Promise<string | null> {
    if (businessId) {
      const businessAccount = await this.findBusinessAccountId(
        businessId,
        userId,
        currency
      );
      if (businessAccount) return businessAccount;
    }
    return this.findPersonalAccountId(userId, currency);
  }

  private async findPersonalAccountId(
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query CompensationPersonalAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location_id: { _is_null: true }
          }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
      currency,
    });
    return result?.accounts?.[0]?.id ?? null;
  }

  private async findBusinessAccountId(
    businessId: string,
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query CompensationBusinessAccount(
        $businessId: uuid!
        $userId: uuid!
        $currency: currency_enum!
      ) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location: { business_id: { _eq: $businessId } }
          }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
      userId,
      currency,
    });
    return result?.accounts?.[0]?.id ?? null;
  }

  private emptyResult(): CompensationCreditResult {
    return { credited: 0, skipped: 0, failed: 0 };
  }

  private addTotals(
    target: CompensationCreditResult,
    extra: CompensationCreditResult
  ): void {
    target.credited += extra.credited;
    target.skipped += extra.skipped;
    target.failed += extra.failed;
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return (
      message.includes('uniqueness violation') ||
      message.includes('unique constraint') ||
      message.includes('uq_rce_')
    );
  }
}
