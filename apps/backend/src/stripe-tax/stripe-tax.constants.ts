/** Stripe Tax Code: General - Tangible Goods (default for marketplace items). */
export const STRIPE_TAX_CODE_GENERAL_TANGIBLE = 'txcd_99999999';

/** Stripe Tax code for a general service (the Rendasua service fee). */
export const STRIPE_TAX_CODE_GENERAL_SERVICES = 'txcd_10000000';

/** Stripe Tax Code: Shipping (delivery fees). */
export const STRIPE_TAX_CODE_SHIPPING = 'txcd_92010001';

/**
 * `void`: tax was estimated at checkout but the order was cancelled/expired before
 * the payment was captured, so no tax was ever collected.
 */
export type OrderTaxStatus = 'none' | 'estimated' | 'finalized' | 'void';

export interface StripeTaxCodeRow {
  id: string;
  name: string;
  description: string | null;
  requirements: Record<string, unknown> | null;
  group_name: string | null;
  is_active: boolean;
  synced_at: string;
}

export interface MerchantStripeTaxCodeDto {
  id: string;
  name: string;
  description: string | null;
  groupName: string | null;
}

export interface StripeCheckoutTaxLineItem {
  name: string;
  unitAmount: number;
  quantity: number;
  taxCode: string;
  reference?: string;
}

export interface StripeTaxAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}
