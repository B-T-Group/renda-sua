import { api } from './apiClient';
import type { ReferredBusinessFollowUp } from '../types/referredBusiness';

export interface UserReferralsSummary {
  success: boolean;
  referralCode: string;
  referralAmount: number;
  currency: string;
  countryCode: string | null;
  minApprovedItems: number;
  referredCount: number;
  referredBusinessCount?: number;
  paidCount: number;
  internal?: boolean;
  agentCode?: string;
  businessCode?: string;
}

export const referralsApi = {
  getSummary: () =>
    api.get<UserReferralsSummary>('/users/me/referred-businesses-summary'),
  listReferredBusinesses: () =>
    api.get<{
      success: boolean;
      businesses: ReferredBusinessFollowUp[];
    }>('/users/me/referred-businesses'),
  lookupByCode: (code: string) =>
    api.get<{
      success: boolean;
      referralCode: string;
      fullName: string;
      firstName?: string;
      kind?: 'user' | 'agent' | 'business';
    }>(`/users/public/by-referral-code/${encodeURIComponent(code)}`),
};
