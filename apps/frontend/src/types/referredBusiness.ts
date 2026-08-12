export type ReferredBusinessFollowUpStatus =
  | 'contract_pending'
  | 'payment_setup_pending'
  | 'active'
  | 'suspended';

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
}
