export type ReferredBusinessFollowUpStatus =
  | 'contract_pending'
  | 'payment_setup_pending'
  | 'active'
  | 'suspended';

export type ReferredBusinessCommissionStatus =
  | 'paid'
  | 'pending'
  | 'window_expired';

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
  lifecycleStatus: string;
  followUpStatus: ReferredBusinessFollowUpStatus;
  itemsApproved: number;
  itemsRejected: number;
  itemsPending: number;
  createdAt: string;
  commission?: ReferredBusinessCommission;
}
