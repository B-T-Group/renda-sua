import { currencyForReferralPayout } from '../business-referral-payouts/business-referral-payout.constants';
import {
  BUSINESS_REFERRAL_10_ITEMS,
  ONBOARDING_10_FIRST_SALE,
  ONBOARDING_10_ITEMS,
  defaultOnboardingMinSaleTotal,
  inWindowSaleTotal,
  onboardingWindowEndsAt,
} from '../representative-compensation/compensation-rules';

export type ReferredBusinessLifecycle =
  | 'created'
  | 'contract_signed'
  | 'active'
  | 'suspended';

export type ReferredBusinessFollowUpStatus =
  | 'contract_pending'
  | 'payment_setup_pending'
  | 'active'
  | 'suspended';

export type ReferredBusinessCommissionStatus =
  | 'paid'
  | 'pending'
  | 'window_expired';

export type ReferredBusinessReferrerKind = 'agent' | 'business';

export interface ReferredBusinessCommissionRequirements {
  itemsApproved: number;
  minItems: number;
  salesTotal: number;
  minSalesTotal: number;
  windowEndsAt: string | null;
  requiresSale: boolean;
}

export interface ReferredBusinessCommission {
  status: ReferredBusinessCommissionStatus;
  paidAmount: number | null;
  currency: string | null;
  paidAt: string | null;
  requirements: ReferredBusinessCommissionRequirements;
}

export interface ReferredBusinessFollowUp {
  businessId: string;
  businessName: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  phone?: string | null;
  email?: string | null;
  lifecycleStatus: ReferredBusinessLifecycle;
  followUpStatus: ReferredBusinessFollowUpStatus;
  itemsApproved: number;
  itemsRejected: number;
  itemsPending: number;
  createdAt: string;
  commission: ReferredBusinessCommission;
}

export interface ReferredBusinessRow {
  id: string;
  name?: string | null;
  lifecycle_status?: string | null;
  created_at?: string | null;
  referred_by_agent_id?: string | null;
  referred_by_business_id?: string | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
    country?: string | null;
  } | null;
  items_approved?: { aggregate?: { count?: number } };
  items_rejected?: { aggregate?: { count?: number } };
  items_pending?: { aggregate?: { count?: number } };
  payment_accounts?: Array<{
    provider?: string | null;
    capability_status?: string | null;
  }>;
  representative_compensation_events?: Array<{
    amount?: number | null;
    currency?: string | null;
    status?: string | null;
    rule_code?: string | null;
    created_at?: string | null;
  }>;
  business_referral_payouts?: Array<{
    amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
  }>;
  completed_orders?: Array<{
    subtotal?: number | null;
    currency?: string | null;
    completed_at?: string | null;
  }>;
}

const LIFECYCLE: ReferredBusinessLifecycle[] = [
  'created',
  'contract_signed',
  'active',
  'suspended',
];

export function normalizeLifecycle(
  value: string | null | undefined
): ReferredBusinessLifecycle {
  const raw = String(value ?? '').toLowerCase();
  if ((LIFECYCLE as string[]).includes(raw)) {
    return raw as ReferredBusinessLifecycle;
  }
  return 'created';
}

export function isPaymentCapabilityVerified(
  accounts:
    | Array<{ provider?: string | null; capability_status?: string | null }>
    | undefined
): boolean {
  return (accounts ?? []).some((a) => a.capability_status === 'verified');
}

export function deriveFollowUpStatus(
  lifecycle: ReferredBusinessLifecycle,
  paymentVerified: boolean
): ReferredBusinessFollowUpStatus {
  if (lifecycle === 'suspended') return 'suspended';
  if (lifecycle === 'created') return 'contract_pending';
  return paymentVerified ? 'active' : 'payment_setup_pending';
}

export function inferReferrerKind(
  row: ReferredBusinessRow,
  fallback: ReferredBusinessReferrerKind = 'agent'
): ReferredBusinessReferrerKind {
  if (row.referred_by_agent_id) return 'agent';
  if (row.referred_by_business_id) return 'business';
  return fallback;
}

function oneTimeRuleCode(kind: ReferredBusinessReferrerKind): string {
  return kind === 'agent' ? ONBOARDING_10_FIRST_SALE : BUSINESS_REFERRAL_10_ITEMS;
}

function findPaidCommission(
  row: ReferredBusinessRow,
  kind: ReferredBusinessReferrerKind
): { amount: number; currency: string; paidAt: string | null } | null {
  const rule = oneTimeRuleCode(kind);
  const event = (row.representative_compensation_events ?? []).find(
    (e) => e.rule_code === rule && e.status === 'credited'
  );
  if (event) {
    return {
      amount: Number(event.amount ?? 0),
      currency: String(event.currency ?? ''),
      paidAt: event.created_at ?? null,
    };
  }
  if (kind !== 'agent') return null;
  const legacy = row.business_referral_payouts?.[0];
  if (!legacy) return null;
  return {
    amount: Number(legacy.amount ?? 0),
    currency: String(legacy.currency ?? ''),
    paidAt: legacy.created_at ?? null,
  };
}

function inWindowSalesForRow(row: ReferredBusinessRow, currency: string): number {
  return inWindowSaleTotal({
    completedSales: (row.completed_orders ?? []).map((order, index) => ({
      id: String(index),
      subtotal: Number(order.subtotal ?? 0),
      currency: String(order.currency ?? ''),
      completedAt: order.completed_at ?? undefined,
    })),
    payoutCurrency: currency,
    onboardedAt: row.created_at ?? undefined,
  });
}

export function mapCommission(
  row: ReferredBusinessRow,
  referrerKind?: ReferredBusinessReferrerKind,
  minSalesTotal?: number
): ReferredBusinessCommission {
  const kind = inferReferrerKind(row, referrerKind ?? 'agent');
  const currency = currencyForReferralPayout(row.user?.country ?? null);
  const requiresSale = kind === 'agent';
  const itemsApproved = Number(row.items_approved?.aggregate?.count ?? 0);
  const configuredMin =
    minSalesTotal ?? defaultOnboardingMinSaleTotal(currency);
  const requirements: ReferredBusinessCommissionRequirements = {
    itemsApproved,
    minItems: ONBOARDING_10_ITEMS,
    salesTotal: requiresSale ? inWindowSalesForRow(row, currency) : 0,
    minSalesTotal: requiresSale ? configuredMin : 0,
    windowEndsAt: requiresSale ? onboardingWindowEndsAt(row.created_at) : null,
    requiresSale,
  };
  return commissionFromState(row, kind, currency, requirements);
}

function commissionFromState(
  row: ReferredBusinessRow,
  kind: ReferredBusinessReferrerKind,
  currency: string,
  requirements: ReferredBusinessCommissionRequirements
): ReferredBusinessCommission {
  const paid = findPaidCommission(row, kind);
  if (paid) {
    return {
      status: 'paid',
      paidAmount: paid.amount,
      currency: paid.currency || currency,
      paidAt: paid.paidAt,
      requirements,
    };
  }
  return unpaidCommission(currency, requirements);
}

function unpaidCommission(
  currency: string,
  requirements: ReferredBusinessCommissionRequirements
): ReferredBusinessCommission {
  const windowEnded =
    Boolean(requirements.windowEndsAt) &&
    Date.parse(requirements.windowEndsAt as string) < Date.now();
  const expired = requirements.requiresSale && windowEnded;
  return {
    status: expired ? 'window_expired' : 'pending',
    paidAmount: null,
    currency,
    paidAt: null,
    requirements,
  };
}

export function mapReferredBusinessRow(
  row: ReferredBusinessRow,
  referrerKind?: ReferredBusinessReferrerKind,
  minSalesTotal?: number
): ReferredBusinessFollowUp {
  const lifecycle = normalizeLifecycle(row.lifecycle_status);
  return {
    businessId: row.id,
    businessName: row.name?.trim() || 'Business',
    ownerFirstName: row.user?.first_name ?? undefined,
    ownerLastName: row.user?.last_name ?? undefined,
    phone: row.user?.phone_number ?? null,
    email: row.user?.email ?? null,
    lifecycleStatus: lifecycle,
    followUpStatus: deriveFollowUpStatus(
      lifecycle,
      isPaymentCapabilityVerified(row.payment_accounts)
    ),
    itemsApproved: Number(row.items_approved?.aggregate?.count ?? 0),
    itemsRejected: Number(row.items_rejected?.aggregate?.count ?? 0),
    itemsPending: Number(row.items_pending?.aggregate?.count ?? 0),
    createdAt: row.created_at ?? '',
    commission: mapCommission(row, referrerKind, minSalesTotal),
  };
}

export async function mapReferredBusinesses(
  rows: ReferredBusinessRow[],
  referrerKind: ReferredBusinessReferrerKind | undefined,
  readMinSaleTotal: (country: string) => Promise<number | null>
): Promise<ReferredBusinessFollowUp[]> {
  const totals = await minSaleTotalsByCountry(rows, readMinSaleTotal);
  return rows.map((row) => {
    const country = (row.user?.country ?? '').toUpperCase();
    return mapReferredBusinessRow(row, referrerKind, totals.get(country));
  });
}

async function minSaleTotalsByCountry(
  rows: ReferredBusinessRow[],
  readMinSaleTotal: (country: string) => Promise<number | null>
): Promise<Map<string, number>> {
  const countries = [
    ...new Set(
      rows.map((row) => (row.user?.country ?? '').toUpperCase()).filter(Boolean)
    ),
  ];
  const totals = new Map<string, number>();
  await Promise.all(
    countries.map(async (country) => {
      const configured = await readMinSaleTotal(country);
      const currency = currencyForReferralPayout(country);
      totals.set(
        country,
        configured != null && Number.isFinite(configured) && configured >= 0
          ? configured
          : defaultOnboardingMinSaleTotal(currency)
      );
    })
  );
  return totals;
}

export const REFERRED_BUSINESSES_LIST_SELECTION = `
  id
  name
  lifecycle_status
  created_at
  referred_by_agent_id
  referred_by_business_id
  user {
    first_name
    last_name
    phone_number
    email
    country
  }
  items_approved: items_aggregate(
    where: { moderation_status: { _eq: approved } }
  ) { aggregate { count } }
  items_rejected: items_aggregate(
    where: { moderation_status: { _eq: rejected } }
  ) { aggregate { count } }
  items_pending: items_aggregate(
    where: {
      moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
    }
  ) { aggregate { count } }
  payment_accounts { provider capability_status }
  representative_compensation_events(
    where: {
      rule_code: {
        _in: ["onboarding_10_first_sale", "business_referral_10_items"]
      }
    }
  ) {
    amount
    currency
    status
    rule_code
    created_at
  }
  business_referral_payouts { amount currency created_at }
  completed_orders: orders(
    where: { current_status: { _in: [complete, delivered] } }
  ) { subtotal currency completed_at }
`;
