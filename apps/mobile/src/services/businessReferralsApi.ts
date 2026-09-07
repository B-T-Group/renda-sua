import { api } from './apiClient';
import type { ReferralProjectedPayout } from '../types/referralProjectedPayout';

export interface BusinessReferralsSummary {
  success: boolean;
  businessCode: string;
  referralAmount: number;
  currency: string;
  countryCode: string | null;
  minApprovedItems: number;
  referredCount: number;
  paidCount: number;
}

export const businessReferralsApi = {
  getSummary: () =>
    api.get<BusinessReferralsSummary>('/businesses/me/referrals-summary'),
  getReferralPayoutProjection: () =>
    api.get<ReferralProjectedPayout>('/businesses/me/referral-payout-projection'),
  listReferredBusinesses: () =>
    api.get<{
      success: boolean;
      businesses: import('../types/referredBusiness').ReferredBusinessFollowUp[];
    }>('/businesses/me/referred-businesses'),
  lookupByCode: (code: string) =>
    api.get<{
      success: boolean;
      businessCode: string;
      businessName: string;
    }>(`/businesses/public/by-code/${encodeURIComponent(code)}`),
};
