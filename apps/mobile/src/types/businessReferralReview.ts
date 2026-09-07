export type PayoutReviewStatus = 'pending' | 'approved' | 'rejected';
export type ItemQualityMark = 'good' | 'bad';

export interface ReferralReviewAgent {
  agentId: string;
  agentCode: string | null;
  firstName: string;
  lastName: string;
}

export interface ReferralReviewItemImage {
  id: string;
  imageUrl: string;
  displayOrder: number;
}

export interface ReferralReviewInventory {
  id: string;
  quantity: number;
  locationId: string | null;
  locationName: string | null;
}

export interface ReferralReviewItem {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  status: string;
  isActive: boolean;
  moderationStatus: string;
  createdAt: string;
  updatedAt: string | null;
  qualityMark: ItemQualityMark | null;
  images: ReferralReviewItemImage[];
  inventory: ReferralReviewInventory[];
}

export interface BusinessReferralReviewDetail {
  businessId: string;
  businessName: string;
  createdAt: string;
  isPaid: boolean;
  payoutReviewStatus: PayoutReviewStatus;
  rejectionReason: string | null;
  goodItemCount: number;
  badItemCount: number;
  reviewedAt: string | null;
  agent: ReferralReviewAgent;
  items: ReferralReviewItem[];
}

export interface SubmitReferralReviewBody {
  decision: 'approve' | 'reject';
  rejectionReason?: string;
  itemMarks: Array<{ itemId: string; quality: ItemQualityMark }>;
}
