export type PayoutPreviewSkipReason =
  | 'no_referrer'
  | 'no_amount'
  | 'no_account';

export interface PayoutPreviewBeneficiary {
  generation: number;
  kind: 'agent' | 'business';
  id: string;
  userId: string;
  name: string;
  amount: number;
  percent: number | null;
  hasAccount: boolean;
}

export interface PayoutPreviewReferrer {
  kind: 'agent' | 'business';
  id: string;
  userId: string;
  name: string;
}

export interface PayoutPreviewRow {
  referredBusinessId: string;
  referredBusinessName: string;
  itemCount: number;
  referralKind: 'agent' | 'business';
  countryCode: string | null;
  currency: string;
  grossAmount: number;
  payoutConfigKey: string | null;
  wouldCredit: boolean;
  skipReason: PayoutPreviewSkipReason | null;
  pendingRetry: boolean;
  referrer: PayoutPreviewReferrer | null;
  beneficiaries: PayoutPreviewBeneficiary[];
}

export interface PayoutPreviewTotal {
  currency: string;
  count: number;
  gross: number;
}

export interface WeeklyPayoutPreview {
  enabled: boolean;
  cutoffDate: string;
  minItems: number;
  percents: { gen1: number; gen2: number; gen3: number };
  payableCount: number;
  skippedCount: number;
  rows: PayoutPreviewRow[];
  totalsByCurrency: PayoutPreviewTotal[];
}

export interface PreviewEligibleBusiness {
  kind: 'agent' | 'business';
  id: string;
  name: string;
  itemCount: number;
  earner: PayoutPreviewReferrer | null;
  pendingAmount?: number;
  pendingCurrency?: string;
  countryCode?: string;
}

export interface PreviewGross {
  countryCode: string | null;
  currency: string;
  amount: number;
  configKey: string | null;
}

export interface PreviewPendingClaim {
  referredBusinessId: string;
  referredBusinessName: string;
  referralKind: 'agent' | 'business';
  amount: number;
  currency: string;
  earner: PayoutPreviewReferrer | null;
}
