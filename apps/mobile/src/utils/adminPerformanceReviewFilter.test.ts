import { describe, expect, it } from 'vitest';
import type {
  ReferredBusinessSummary,
  TopAgentEntry,
} from '../types/adminPerformance';
import {
  filterAgentsPendingReview,
  needsReferralReview,
} from './adminPerformanceReviewFilter';

function biz(
  overrides: Partial<ReferredBusinessSummary> & { businessId: string }
): ReferredBusinessSummary {
  return {
    businessName: 'Biz',
    itemCount: 10,
    score: 11,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('adminPerformanceReviewFilter', () => {
  it('treats pending and rejected as needing review', () => {
    expect(needsReferralReview(biz({ businessId: '1' }))).toBe(true);
    expect(
      needsReferralReview(
        biz({ businessId: '2', payoutReviewStatus: 'pending' })
      )
    ).toBe(true);
    expect(
      needsReferralReview(
        biz({ businessId: '3', payoutReviewStatus: 'rejected' })
      )
    ).toBe(true);
  });

  it('hides approved and paid referrals', () => {
    expect(
      needsReferralReview(
        biz({ businessId: '1', payoutReviewStatus: 'approved' })
      )
    ).toBe(false);
    expect(
      needsReferralReview(
        biz({
          businessId: '2',
          payoutReviewStatus: 'pending',
          isPaid: true,
        })
      )
    ).toBe(false);
  });

  it('drops agents with only approved referrals', () => {
    const agents: TopAgentEntry[] = [
      {
        agentId: 'a1',
        agentCode: 'AAA',
        firstName: 'Ann',
        lastName: 'A',
        count: 1,
        referredBusinesses: [
          biz({ businessId: '1', payoutReviewStatus: 'approved' }),
        ],
      },
      {
        agentId: 'a2',
        agentCode: 'BBB',
        firstName: 'Bob',
        lastName: 'B',
        count: 2,
        referredBusinesses: [
          biz({ businessId: '2', payoutReviewStatus: 'approved' }),
          biz({ businessId: '3', payoutReviewStatus: 'pending' }),
        ],
      },
    ];
    const filtered = filterAgentsPendingReview(agents);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].agentId).toBe('a2');
    expect(filtered[0].referredBusinesses).toHaveLength(1);
    expect(filtered[0].referredBusinesses?.[0].businessId).toBe('3');
  });
});
