import { isOnboardingFirstSaleRule, SALE_PERCENT } from '../representative-compensation/compensation-rules';
import type { ReferredBusinessFollowUp } from '../business-referrals/referred-business-followup.util';
import type {
  ObjectiveKey,
  ObjectiveMetric,
  ObjectiveProgress,
} from '../payment-programs/payment-schedule-progress.service';
import { OBJECTIVE_TIE_ORDER } from '../payment-programs/payment-schedule-progress.service';
import type {
  EarningItem,
  MarketAmounts,
  MerchantReferralInput,
  PayBoard,
  PayBoardStatusFilter,
  PayBoardSummary,
  ScheduleAssignmentInput,
  ScheduleObjectiveView,
} from './agent-pay-board.types';

export interface PayBoardEventRow {
  businessId: string | null;
  amount: number;
  currency: string;
  status: string;
  ruleCode: string;
}

export interface OnboardingClaim {
  status: 'credited' | 'pending' | 'failed';
  amount: number;
  currency: string;
}

export interface IndexedPayExtras {
  salePercentByBusiness: Record<string, number>;
  salePercentEarned: number;
  onboardingByBusiness: Record<string, OnboardingClaim>;
  merchantPending: number;
  scheduleEarned: number;
  scheduleEarnedByAssignment: Record<string, number>;
  deliveryEarned: number;
}

export interface PayBoardQuery {
  agentId: string;
  userId: string;
  country: string | null;
  status: PayBoardStatusFilter;
}

export function fallbackMarketAmounts(currency: string): MarketAmounts {
  if (currency === 'CAD') {
    return { currency, selfSaleAmount: 25, otherBuyerAmount: 25, salePercent: 1 };
  }
  return { currency, selfSaleAmount: 5000, otherBuyerAmount: 7500, salePercent: 1 };
}

export function parsePayBoardStatus(value?: string): PayBoardStatusFilter {
  if (value === 'paid' || value === 'all') return value;
  return 'unpaid';
}

export function filterPayBoardItems(
  items: EarningItem[],
  status: PayBoardStatusFilter
): EarningItem[] {
  if (status === 'all') return items;
  return items.filter((item) => item.paymentStatus === status);
}

export function merchantNextStep(input: MerchantReferralInput): EarningItem['nextStep'] {
  if (input.onboardingStatus === 'credited' || input.legacyPaid) return 'paid';
  if (input.onboardingStatus === 'pending' || input.onboardingStatus === 'failed') {
    return 'awaiting_payout';
  }
  if (isWindowClosed(input.windowEndsAt)) return 'window_closed';
  if (input.itemsApproved < input.minItems) return 'add_items';
  return 'reach_sales';
}

export function toMerchantItem(input: MerchantReferralInput): EarningItem {
  const nextStep = merchantNextStep(input);
  const paid = nextStep === 'paid';
  return {
    id: `merchant_referral:${input.businessId}`,
    kind: 'merchant_referral',
    paymentStatus: paid ? 'paid' : 'unpaid',
    title: input.businessName,
    currency: input.currency,
    deadline: input.windowEndsAt,
    nextStep,
    structure: merchantStructure(input, paid),
  };
}

export function toScheduleItem(input: ScheduleAssignmentInput): EarningItem | null {
  if (!input.objectives.length) return null;
  const met = input.objectives.every((row) => row.percent >= 100);
  return scheduleEarningItem(input, met);
}

export function objectivesFromProgress(progress: ObjectiveProgress): ScheduleObjectiveView[] {
  return OBJECTIVE_TIE_ORDER.flatMap((key) => objectiveRow(key, progress[key]));
}

export function merchantItemFromFollowUp(
  business: ReferredBusinessFollowUp,
  amounts: MarketAmounts,
  extras: Pick<IndexedPayExtras, 'salePercentByBusiness' | 'onboardingByBusiness'>
): EarningItem {
  return toMerchantItem(merchantInput(business, amounts, extras));
}

export function indexPayBoardExtras(input: {
  currency: string;
  events: PayBoardEventRow[];
  deliveryEarned: number;
  scheduleRuns: Array<{ assignmentId: string; amount: number; currency: string }>;
}): IndexedPayExtras {
  const events = foldCompensationEvents(input.events, input.currency);
  const runs = foldScheduleRuns(input.scheduleRuns, input.currency);
  return { ...events, ...runs, deliveryEarned: input.deliveryEarned };
}

export function sumPaidOnboarding(items: EarningItem[], currency: string): number {
  return items.reduce((sum, item) => sum + paidOnboardingAmount(item, currency), 0);
}

export function buildPayBoardSummary(input: {
  currency: string;
  items: EarningItem[];
  merchantEarned: number;
  merchantPending: number;
  salePercentEarned: number;
  scheduleEarned: number;
  deliveryEarned: number;
}): PayBoardSummary {
  const sources = paySources(input);
  return {
    currency: input.currency,
    earnedAmount: sources.reduce((sum, source) => sum + source.earnedAmount, 0),
    pendingAmount: sources.reduce((sum, source) => sum + source.pendingAmount, 0),
    counts: countPayItems(input.items),
    sources,
  };
}

export function assemblePayBoard(
  items: EarningItem[],
  status: PayBoardStatusFilter,
  summary: PayBoardSummary
): PayBoard {
  return { summary, items: filterPayBoardItems(items, status) };
}

function merchantStructure(input: MerchantReferralInput, paid: boolean) {
  return {
    type: 'merchant_referral' as const,
    businessId: input.businessId,
    selfSaleAmount: input.selfSaleAmount,
    otherBuyerAmount: input.otherBuyerAmount,
    salePercent: input.salePercent,
    salePercentEarned: input.salePercentEarned,
    onboarding: onboardingView(input, paid),
  };
}

function onboardingView(input: MerchantReferralInput, paid: boolean) {
  const step = merchantNextStep(input);
  return {
    status: onboardingViewStatus(step),
    paidAmount: paid ? input.paidAmount : null,
    paidAt: paid ? input.paidAt : null,
    minItems: input.minItems,
    itemsApproved: input.itemsApproved,
    minSalesTotal: input.minSalesTotal,
    salesTotal: input.salesTotal,
    windowEndsAt: input.windowEndsAt,
  };
}

function onboardingViewStatus(step: EarningItem['nextStep']) {
  if (step === 'paid') return 'paid' as const;
  if (step === 'window_closed') return 'window_expired' as const;
  return 'pending' as const;
}

function scheduleEarningItem(input: ScheduleAssignmentInput, met: boolean): EarningItem {
  return {
    id: `payment_schedule:${input.id}`,
    kind: 'payment_schedule',
    paymentStatus: met ? 'paid' : 'unpaid',
    title: input.title,
    currency: input.currency,
    deadline: input.deadline,
    nextStep: met ? 'objectives_met' : 'meet_objectives',
    structure: scheduleStructure(input),
  };
}

function scheduleStructure(input: ScheduleAssignmentInput) {
  return {
    type: 'payment_schedule' as const,
    assignmentId: input.id,
    stipendAmount: input.stipendAmount,
    frequency: input.frequency,
    earnedAmount: input.postedAmount,
    objectives: input.objectives,
    overallPercent: input.overallPercent,
  };
}

function objectiveRow(key: ObjectiveKey, metric: ObjectiveMetric): ScheduleObjectiveView[] {
  if (metric.target == null || metric.target <= 0) return [];
  return [{ key, actual: metric.actual, target: metric.target, percent: metric.percent ?? 0 }];
}

function isWindowClosed(windowEndsAt: string | null): boolean {
  if (!windowEndsAt) return false;
  const ends = Date.parse(windowEndsAt);
  return Number.isFinite(ends) && ends < Date.now();
}

function merchantInput(
  business: ReferredBusinessFollowUp,
  amounts: MarketAmounts,
  extras: Pick<IndexedPayExtras, 'salePercentByBusiness' | 'onboardingByBusiness'>
): MerchantReferralInput {
  const claim = extras.onboardingByBusiness[business.businessId];
  const paid = business.commission.status === 'paid';
  return {
    ...amounts,
    ...requirementFields(business),
    businessId: business.businessId,
    businessName: business.businessName,
    currency: business.commission.currency || amounts.currency,
    salePercentEarned: extras.salePercentByBusiness[business.businessId] ?? 0,
    onboardingStatus: resolveClaimStatus(paid, claim?.status),
    paidAmount: paid ? claim?.amount ?? business.commission.paidAmount : null,
    paidAt: business.commission.paidAt,
    legacyPaid: paid && claim == null,
  };
}

function requirementFields(business: ReferredBusinessFollowUp) {
  const requirements = business.commission.requirements;
  return {
    itemsApproved: requirements.itemsApproved,
    minItems: requirements.minItems,
    salesTotal: requirements.salesTotal,
    minSalesTotal: requirements.minSalesTotal,
    windowEndsAt: requirements.windowEndsAt,
  };
}

function resolveClaimStatus(
  paid: boolean,
  claimStatus?: OnboardingClaim['status']
): MerchantReferralInput['onboardingStatus'] {
  if (paid || claimStatus === 'credited') return 'credited';
  if (claimStatus === 'pending' || claimStatus === 'failed') return claimStatus;
  return 'none';
}

function foldCompensationEvents(events: PayBoardEventRow[], currency: string) {
  const salePercentByBusiness: Record<string, number> = {};
  const onboardingByBusiness: Record<string, OnboardingClaim> = {};
  let salePercentEarned = 0;
  for (const event of events) {
    salePercentEarned += creditedSaleInCurrency(event, currency);
    addBusinessSalePercent(salePercentByBusiness, event);
    if (isOnboardingFirstSaleRule(event.ruleCode)) rememberOnboarding(onboardingByBusiness, event);
  }
  return {
    salePercentByBusiness,
    salePercentEarned,
    onboardingByBusiness,
    merchantPending: pendingOnboarding(onboardingByBusiness, currency),
  };
}

function creditedSaleInCurrency(event: PayBoardEventRow, currency: string): number {
  if (!isCreditedSalePercent(event) || event.currency !== currency) return 0;
  return event.amount;
}

function addBusinessSalePercent(map: Record<string, number>, event: PayBoardEventRow) {
  if (!isCreditedSalePercent(event) || !event.businessId) return;
  map[event.businessId] = (map[event.businessId] ?? 0) + event.amount;
}

function isCreditedSalePercent(event: PayBoardEventRow): boolean {
  return event.ruleCode === SALE_PERCENT && event.status === 'credited';
}

function rememberOnboarding(map: Record<string, OnboardingClaim>, event: PayBoardEventRow) {
  const status = normalizeClaim(event.status);
  if (!event.businessId || !status) return;
  if (map[event.businessId]?.status === 'credited') return;
  map[event.businessId] = { status, amount: event.amount, currency: event.currency };
}

function normalizeClaim(status: string): OnboardingClaim['status'] | null {
  if (status === 'credited' || status === 'pending' || status === 'failed') return status;
  return null;
}

function pendingOnboarding(map: Record<string, OnboardingClaim>, currency: string): number {
  return Object.values(map).reduce((sum, claim) => {
    if (claim.currency !== currency) return sum;
    if (claim.status !== 'pending' && claim.status !== 'failed') return sum;
    return sum + claim.amount;
  }, 0);
}

function foldScheduleRuns(
  runs: Array<{ assignmentId: string; amount: number; currency: string }>,
  currency: string
) {
  const scheduleEarnedByAssignment: Record<string, number> = {};
  let scheduleEarned = 0;
  for (const run of runs) {
    const current = scheduleEarnedByAssignment[run.assignmentId] ?? 0;
    scheduleEarnedByAssignment[run.assignmentId] = current + run.amount;
    if (run.currency === currency) scheduleEarned += run.amount;
  }
  return { scheduleEarned, scheduleEarnedByAssignment };
}

function paidOnboardingAmount(item: EarningItem, currency: string): number {
  if (item.kind !== 'merchant_referral' || item.currency !== currency) return 0;
  if (item.structure.type !== 'merchant_referral') return 0;
  return item.structure.onboarding.paidAmount ?? 0;
}

function countPayItems(items: EarningItem[]): { unpaid: number; paid: number } {
  const paid = items.filter((item) => item.paymentStatus === 'paid').length;
  return { paid, unpaid: items.length - paid };
}

function paySources(input: {
  merchantEarned: number;
  merchantPending: number;
  salePercentEarned: number;
  scheduleEarned: number;
  deliveryEarned: number;
}): PayBoardSummary['sources'] {
  return [
    source('merchant_referral', input.merchantEarned, input.merchantPending),
    source('sale_percent', input.salePercentEarned, 0),
    source('payment_schedule', input.scheduleEarned, 0),
    source('delivery_commission', input.deliveryEarned, 0),
  ];
}

function source(
  kind: PayBoardSummary['sources'][number]['kind'],
  earnedAmount: number,
  pendingAmount: number
) {
  return { kind, earnedAmount, pendingAmount };
}
