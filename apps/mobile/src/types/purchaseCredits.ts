export type PurchaseCreditApplicability =
  | 'any_store'
  | 'partner_businesses'
  | 'specific_business';

export interface PurchaseCreditGrant {
  id: string;
  currency: string;
  amount: number;
  remaining_amount: number;
  applicability: PurchaseCreditApplicability | string;
  business_id: string | null;
  expires_at: string | null;
  memo: string | null;
  source?: string | null;
  source_id?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  business?: { id: string; name: string } | null;
  redemptions?: Array<{
    id: string;
    order_id?: string;
    amount: number;
    created_at: string;
  }>;
}

export interface PaymentProgramsMeResponse {
  facilities: unknown[];
  grants: PurchaseCreditGrant[];
  assignments: unknown[];
}

export interface PurchaseCreditPreview {
  total: number;
  currency: string;
  allocations?: Array<{
    amount: number;
    applicability: string;
    businessId: string | null;
  }>;
}

export type PurchaseCreditShopTarget =
  | { kind: 'browse' }
  | { kind: 'partners' }
  | { kind: 'store'; businessId: string };
