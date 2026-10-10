export type PayBoardStatus = 'unpaid' | 'paid' | 'all';

export type PaySegment = 'commissions' | 'objectives' | 'wallet';

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
  | 'delivery_commission';

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
  selfSaleAmount: number;
  otherBuyerAmount: number;
  salePercent: number;
  salePercentEarned: number;
  onboarding: MerchantOnboardingView;
}

export type ScheduleObjectiveKey =
  | 'itemSales'
  | 'rentals'
  | 'clientSignups'
  | 'merchantRecruitments'
  | 'agentRecruitments';

export interface ScheduleObjectiveView {
  key: ScheduleObjectiveKey;
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
  kind: string;
  paymentStatus: 'paid' | 'unpaid';
  title: string;
  currency: string;
  deadline: string | null;
  nextStep: string;
  structure: MerchantReferralStructure | PaymentScheduleStructure | { type: string };
}

export interface PayBoard {
  summary: PayBoardSummary;
  items: EarningItem[];
}
