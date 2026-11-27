export const RENTALS_COMMISSION_FLAG = 'rentals_commission_enabled';
export const EARLY_ADOPTER_RATE_KEY = 'rental_commission_early_adopter_rate_bps';
export const EARLY_ADOPTER_MONTHS_KEY = 'rental_commission_early_adopter_months';
export const EARLY_ADOPTER_ENROL_UNTIL_KEY = 'rental_commission_early_adopter_enrol_until';
export const EARLY_ADOPTER_CAMPAIGN = 'early_adopter_2026';

export type CommissionScope = 'default' | 'country' | 'category' | 'merchant' | 'promo';

export type CommissionStatus = 'not_applicable' | 'quoted' | 'earned' | 'reversed' | 'waived';

export interface CommissionRuleRow {
  id: string;
  scope: CommissionScope;
  business_id: string | null;
  rental_category_id: string | null;
  country_code: string | null;
  campaign_code: string | null;
  rate_bps: number;
  effective_from: string;
  effective_to: string | null;
  status: 'active' | 'ended';
  reason?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface CommissionRuleContext {
  businessId: string;
  categoryId: string | null;
  country: string | null;
}

export interface ResolvedCommissionRate {
  rateBps: number;
  source: CommissionScope;
  ruleId: string | null;
  campaignCode: string | null;
  promoEndsAt?: string | null;
}

export interface CommissionQuoteInput extends CommissionRuleContext {
  currency: string;
  total: number;
}

export interface CommissionQuote extends CommissionQuoteInput {
  rate: ResolvedCommissionRate;
  baseAmount: number;
  commissionAmount: number;
  merchantPayoutAmount: number;
}

export interface CommissionBookingFields {
  id: string;
  currency: string;
  commission_status?: string | null;
  commission_rate_bps?: number | null;
  commission_base_amount?: number | string | null;
  commission_amount?: number | string | null;
  merchant_payout_amount?: number | string | null;
  commission_campaign_code?: string | null;
  total_amount?: number | string | null;
  business?: { user_id?: string | null } | null;
}
