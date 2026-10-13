import type { ObjectiveKey } from '../payment-programs/payment-schedule-progress.service';

export type PayBoardStatusFilter = 'unpaid' | 'paid' | 'all' | 'expired';

export type PayBoardNextStep =
  | 'add_items'
  | 'reach_sales'
  | 'awaiting_payout'
  | 'window_closed'
  | 'paid'
  | 'meet_objectives'
  | 'objectives_met';

export type PaySourceKind =
  | 'merchant_referral'
  | 'sale_percent'
  | 'payment_schedule'
  | 'delivery_commission'
  | 'portfolio_commission';

export interface PayBoardSource {
  kind: PaySourceKind;
  earnedAmount: number;
  pendingAmount: number;
}

export interface PayBoardSummary {
  currency: string;
  earnedAmount: number;
  pendingAmount: number;
  counts: { unpaid: number; paid: number };
  sources: PayBoardSource[];
}

export interface MerchantOnboardingView {
  status: 'paid' | 'pending' | 'window_expired';
  paidAmount: number | null;
  paidAt: string | null;
  minItems: number;
  itemsApproved: number;
  minSalesTotal: number;
  salesTotal: number;
  windowEndsAt: string | null;
}

export interface MerchantReferralStructure {
  type: 'merchant_referral';
  businessId: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  selfSaleAmount: number;
  otherBuyerAmount: number;
  salePercent: number;
  salePercentEarned: number;
  onboarding: MerchantOnboardingView;
}

export interface ScheduleObjectiveView {
  key: ObjectiveKey;
  actual: number;
  target: number;
  percent: number;
}

export interface PaymentScheduleStructure {
  type: 'payment_schedule';
  assignmentId: string;
  stipendAmount: number;
  frequency: string;
  earnedAmount: number;
  objectives: ScheduleObjectiveView[];
  overallPercent: number | null;
}

export interface EarningItem {
  id: string;
  kind: 'merchant_referral' | 'payment_schedule';
  paymentStatus: 'paid' | 'unpaid';
  title: string;
  currency: string;
  deadline: string | null;
  nextStep: PayBoardNextStep;
  structure: MerchantReferralStructure | PaymentScheduleStructure;
}

export interface PayBoard {
  summary: PayBoardSummary;
  items: EarningItem[];
  portfolio?: PortfolioCommissionView | null;
}

export interface PortfolioCommissionTier {
  minMonthlySales: number;
  maxMonthlySales: number | null;
  bonusPercent: number;
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
  tiers: PortfolioCommissionTier[];
  activationAmount: number;
  fastStartAmount: number;
  quarterlyAmount: number;
  courierAmount: number;
  ambassadorAmount: number;
  month: PortfolioCommissionMonth | null;
}

export interface MarketAmounts {
  currency: string;
  selfSaleAmount: number;
  otherBuyerAmount: number;
  salePercent: number;
}

export type OnboardingClaimStatus = 'credited' | 'pending' | 'failed' | 'none';

export interface MerchantReferralInput {
  businessId: string;
  businessName: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  selfSaleAmount: number;
  otherBuyerAmount: number;
  salePercent: number;
  salePercentEarned: number;
  itemsApproved: number;
  minItems: number;
  salesTotal: number;
  minSalesTotal: number;
  windowEndsAt: string | null;
  onboardingStatus: OnboardingClaimStatus;
  paidAmount: number | null;
  paidAt: string | null;
  legacyPaid: boolean;
}

export interface ScheduleAssignmentInput {
  id: string;
  title: string;
  currency: string;
  stipendAmount: number;
  frequency: string;
  deadline: string | null;
  postedAmount: number;
  overallPercent: number | null;
  objectives: ScheduleObjectiveView[];
}
