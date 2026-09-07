export type PerformancePeriodUnit = 'week' | 'month' | 'year';
export type PerformancePeriodEdge = 'current' | 'last';

export type TopAgentMetric = 'deliveries' | 'business_referrals';

export interface PerformanceWindow {
  from: string;
  to: string;
}

export interface PerformanceSummary {
  countryCode: string | null;
  from: string;
  to: string;
  businessesEnrolled: number;
  clientsAdded: number;
  agentsAdded: number;
  saleItemsAdded: number;
  rentalItemsAdded: number;
}

export interface ReferredBusinessSummary {
  businessId: string;
  businessName: string;
  itemCount: number;
  score: number;
  createdAt: string;
  payoutReviewStatus?: 'pending' | 'approved' | 'rejected';
  payoutReviewRejectionReason?: string | null;
  isPaid?: boolean;
  /** Credited compensation for this shop in the selected window. */
  earnedAmount?: number;
}

export interface TopAgentEntry {
  agentId: string;
  agentCode: string | null;
  firstName: string;
  lastName: string;
  count: number;
  inventoryItemsCount?: number;
  itemsPerReferral?: number;
  stockedReferralCount?: number;
  meetsGoldenRatio?: boolean;
  referredBusinesses?: ReferredBusinessSummary[];
  /** Projected next payout = approved unpaid stocked × per-referral amount. */
  projectedPayoutAmount?: number;
  projectedPayoutCurrency?: string;
  /** Credited representative compensation in the selected window. */
  earnedAmount?: number;
  earnedCurrency?: string;
  /** Higher commission tier when users.internal is true. */
  isInternal?: boolean;
}

/** Target average sale items per referred business. */
export const GOLDEN_ITEMS_PER_REFERRAL = 10;

export interface PerformanceMarket {
  countryCode: string;
  countryName: string;
}
