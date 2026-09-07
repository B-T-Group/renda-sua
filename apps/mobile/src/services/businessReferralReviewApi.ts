import { apiRequest } from './apiClient';
import type {
  BusinessReferralReviewDetail,
  SubmitReferralReviewBody,
} from '../types/businessReferralReview';

export async function fetchBusinessReferralReviewDetail(
  businessId: string
): Promise<BusinessReferralReviewDetail> {
  return apiRequest<BusinessReferralReviewDetail>(
    `/admin/business-referral-reviews/${businessId}`,
    { method: 'GET' }
  );
}

export async function submitBusinessReferralReview(
  businessId: string,
  body: SubmitReferralReviewBody
): Promise<{ success: true; status: string }> {
  return apiRequest<{ success: true; status: string }>(
    `/admin/business-referral-reviews/${businessId}/submit`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export const businessReferralReviewApi = {
  fetchDetail: fetchBusinessReferralReviewDetail,
  submit: submitBusinessReferralReview,
};
