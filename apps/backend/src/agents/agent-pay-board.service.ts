import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { currencyForReferralPayout } from '../business-referral-payouts/business-referral-payout.constants';
import type { ReferredBusinessFollowUp } from '../business-referrals/referred-business-followup.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentScheduleConsentService } from '../payment-programs/payment-schedule-consent.service';
import type { ObjectiveProgress } from '../payment-programs/payment-schedule-progress.service';
import {
  LEGACY_ONBOARDING_FIRST_SALE,
  LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY,
  ONBOARDING_X_FIRST_SALE,
  ONBOARDING_X_FIRST_SALE_AMOUNT_KEY,
  ONBOARDING_X_SELF_SALE_AMOUNT_KEY,
  SALE_PERCENT,
} from '../representative-compensation/compensation-rules';
import {
  assemblePayBoard,
  buildPayBoardSummary,
  fallbackMarketAmounts,
  indexPayBoardExtras,
  merchantItemFromFollowUp,
  objectivesFromProgress,
  sumPaidOnboarding,
  toScheduleItem,
  type IndexedPayExtras,
  type PayBoardEventRow,
  type PayBoardQuery,
} from './agent-pay-board.mapper';
import type {
  EarningItem,
  MarketAmounts,
  PayBoard,
  ScheduleAssignmentInput,
} from './agent-pay-board.types';
import { AgentReferralsService } from './agent-referrals.service';

const SALE_PERCENT_KEY = 'sale_only_commission_percent';

interface AcceptedSchedule {
  id: string;
  amount: number;
  currency: string;
  endsAt?: string | null;
  schedule?: { name?: string | null; frequency?: string | null } | null;
  progress: ObjectiveProgress;
}

interface LoadedBoard {
  currency: string;
  country: string | null;
  status: PayBoardQuery['status'];
  businesses: ReferredBusinessFollowUp[];
  extras: IndexedPayExtras;
  schedules: AcceptedSchedule[];
  markets: Map<string, MarketAmounts>;
}

@Injectable()
export class AgentPayBoardService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly referrals: AgentReferralsService,
    @Inject(forwardRef(() => PaymentScheduleConsentService))
    private readonly schedules: PaymentScheduleConsentService,
    private readonly configurations: ConfigurationsService
  ) {}

  async getBoard(input: PayBoardQuery): Promise<PayBoard> {
    const loaded = await this.loadBoard(input);
    const items = composeItems(loaded);
    return assemblePayBoard(items, input.status, summaryFor(loaded, items));
  }

  private async loadBoard(input: PayBoardQuery): Promise<LoadedBoard> {
    const currency = currencyForReferralPayout(input.country);
    const [businesses, extras, schedules] = await Promise.all([
      this.referrals.listReferredBusinesses(input.agentId),
      this.loadExtras(input.agentId, input.userId, currency),
      this.schedules.listAcceptedDetails(input.userId),
    ]);
    return {
      currency,
      country: input.country,
      status: input.status,
      businesses,
      extras,
      schedules,
      markets: await this.marketsFor(businesses, input.country),
    };
  }

  private async loadExtras(agentId: string, userId: string, currency: string) {
    const result = await this.hasura.executeQuery<ExtrasResult>(PAY_BOARD_EXTRAS, {
      agentId,
      userId,
      currency,
    });
    return indexPayBoardExtras({
      currency,
      events: (result.compensation_events ?? []).map(mapEvent),
      deliveryEarned: Number(result.commission_payouts_aggregate?.aggregate?.sum?.amount ?? 0),
      scheduleRuns: (result.payment_schedule_runs ?? []).map(mapRun),
    });
  }

  private async marketsFor(
    businesses: ReferredBusinessFollowUp[],
    agentCountry: string | null
  ): Promise<Map<string, MarketAmounts>> {
    const countries = new Set<string>();
    if (agentCountry) countries.add(agentCountry.toUpperCase());
    for (const business of businesses) {
      if (business.country) countries.add(business.country.toUpperCase());
    }
    const entries = await Promise.all(
      [...countries].map(async (country) => [country, await this.marketAmounts(country)] as const)
    );
    return new Map(entries);
  }

  private async marketAmounts(country: string): Promise<MarketAmounts> {
    const currency = currencyForReferralPayout(country);
    const fallback = fallbackMarketAmounts(currency);
    const [selfSaleAmount, otherBuyerAmount, salePercent] = await Promise.all([
      this.readAmount(country, ONBOARDING_X_SELF_SALE_AMOUNT_KEY, fallback.selfSaleAmount),
      this.readOtherAmount(country, fallback.otherBuyerAmount),
      this.readAmount(country, SALE_PERCENT_KEY, fallback.salePercent),
    ]);
    return { currency, selfSaleAmount, otherBuyerAmount, salePercent };
  }

  private async readOtherAmount(country: string, fallback: number): Promise<number> {
    const current = await this.readAmount(country, ONBOARDING_X_FIRST_SALE_AMOUNT_KEY, 0);
    if (current > 0) return current;
    return this.readAmount(country, LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY, fallback);
  }

  private async readAmount(country: string, key: string, fallback: number): Promise<number> {
    try {
      const config = await this.configurations.getConfigurationByKey(key, country);
      const value = Number(config?.number_value);
      if (!Number.isFinite(value) || value <= 0) return fallback;
      return value;
    } catch {
      return fallback;
    }
  }
}

function composeItems(loaded: LoadedBoard): EarningItem[] {
  const merchants = loaded.businesses.map((business) =>
    merchantItemFromFollowUp(business, amountsFor(loaded, business), loaded.extras)
  );
  const schedules = loaded.schedules
    .map((row) => toScheduleItem(scheduleInput(row, loaded.extras)))
    .filter((item): item is EarningItem => item != null);
  return [...merchants, ...schedules];
}

function amountsFor(loaded: LoadedBoard, business: ReferredBusinessFollowUp): MarketAmounts {
  const country = (business.country ?? loaded.country ?? '').toUpperCase();
  return loaded.markets.get(country) ?? fallbackMarketAmounts(loaded.currency);
}

function summaryFor(loaded: LoadedBoard, items: EarningItem[]) {
  return buildPayBoardSummary({
    currency: loaded.currency,
    items,
    merchantEarned: sumPaidOnboarding(items, loaded.currency),
    merchantPending: loaded.extras.merchantPending,
    salePercentEarned: loaded.extras.salePercentEarned,
    scheduleEarned: loaded.extras.scheduleEarned,
    deliveryEarned: loaded.extras.deliveryEarned,
  });
}

function scheduleInput(row: AcceptedSchedule, extras: IndexedPayExtras): ScheduleAssignmentInput {
  return {
    id: row.id,
    title: row.schedule?.name?.trim() || '',
    currency: row.currency,
    stipendAmount: Number(row.amount),
    frequency: row.schedule?.frequency ?? '',
    deadline: row.endsAt ?? null,
    postedAmount: extras.scheduleEarnedByAssignment[row.id] ?? 0,
    overallPercent: row.progress.overallPercent,
    objectives: objectivesFromProgress(row.progress),
  };
}

function mapEvent(row: EventRow): PayBoardEventRow {
  return {
    businessId: row.business_id ?? null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? ''),
    status: String(row.status ?? ''),
    ruleCode: String(row.rule_code ?? ''),
  };
}

function mapRun(row: RunRow) {
  return {
    assignmentId: String(row.assignment_id ?? ''),
    amount: Number(row.amount ?? 0),
    currency: String(row.assignment?.currency ?? ''),
  };
}

interface EventRow {
  business_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  rule_code?: string | null;
}

interface RunRow {
  assignment_id?: string | null;
  amount?: number | null;
  assignment?: { currency?: string | null } | null;
}

interface ExtrasResult {
  compensation_events?: EventRow[];
  commission_payouts_aggregate?: { aggregate?: { sum?: { amount?: number | null } | null } };
  payment_schedule_runs?: RunRow[];
}

const PAY_BOARD_EXTRAS = `
  query AgentPayBoardExtras($agentId: uuid!, $userId: uuid!, $currency: currency_enum!) {
    compensation_events: representative_compensation_events(
      where: {
        earner_agent_id: { _eq: $agentId }
        status: { _in: ["credited", "pending", "failed"] }
        rule_code: { _in: ["${SALE_PERCENT}", "${ONBOARDING_X_FIRST_SALE}", "${LEGACY_ONBOARDING_FIRST_SALE}"] }
      }
    ) {
      business_id
      amount
      currency
      status
      rule_code
    }
    commission_payouts_aggregate(
      where: {
        recipient_user_id: { _eq: $userId }
        recipient_type: { _eq: "agent" }
        currency: { _eq: $currency }
      }
    ) {
      aggregate { sum { amount } }
    }
    payment_schedule_runs(
      where: {
        status: { _eq: posted }
        assignment: { agent_id: { _eq: $agentId } }
      }
    ) {
      assignment_id
      amount
      assignment { currency }
    }
  }
`;
