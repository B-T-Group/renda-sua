import { ConflictException, HttpException } from '@nestjs/common';
import { BusinessReferralReviewService } from './business-referral-review.service';

describe('BusinessReferralReviewService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const notificationsService = {
    sendInternalPushByUserId: jest.fn(),
  };

  const referredBusiness = {
    id: 'business-1',
    name: 'Demo Store',
    created_at: '2026-05-01T00:00:00Z',
    referred_by_agent_id: 'agent-1',
    referred_by_business_id: null as string | null,
    referring_agent: {
      id: 'agent-1',
      agent_code: 'ABC123',
      user: {
        id: 'user-1',
        first_name: 'Ann',
        last_name: 'Agent',
        preferred_language: 'en',
      },
    },
    referring_business: null,
    business_referral_payouts: [] as Array<{ id: string }>,
    business_referral_reviews: [] as Array<Record<string, unknown>>,
    items: [
      {
        id: 'item-1',
        name: 'Widget',
        description: 'A widget',
        price: 100,
        currency: 'XAF',
        status: 'active',
        is_active: true,
        moderation_status: 'approved',
        created_at: '2026-05-02T00:00:00Z',
        updated_at: null,
        item_images: [{ id: 'img-1', image_url: 'https://example.com/a.jpg', display_order: 0 }],
        business_inventories: [],
      },
    ],
  };

  let service: BusinessReferralReviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessReferralReviewService(
      hasuraSystemService as never,
      notificationsService as never
    );
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: referredBusiness,
    });
  });

  it('rejects submit when referral already paid', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: {
        ...referredBusiness,
        business_referral_payouts: [{ id: 'payout-1' }],
      },
    });

    await expect(
      service.submit('business-1', 'mod-1', {
        decision: 'approve',
        itemMarks: [{ itemId: 'item-1', quality: 'good' }],
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires rejection reason on reject', async () => {
    await expect(
      service.submit('business-1', 'mod-1', {
        decision: 'reject',
        rejectionReason: '   ',
        itemMarks: [],
      })
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('submits review atomically with marks and notifies on reject', async () => {
    hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('SubmitBusinessReferralReview')) {
        return {
          delete_business_referral_review_item_marks: { affected_rows: 0 },
          insert_business_referral_reviews_one: { id: 'review-1', status: 'rejected' },
        };
      }
      if (mutation.includes('InsertReferralReviewRejectionMessage')) {
        return { insert_user_messages_one: { id: 'msg-1' } };
      }
      return { affected_rows: 1 };
    });

    const result = await service.submit('business-1', 'mod-1', {
      decision: 'reject',
      rejectionReason: 'Low quality photos',
      itemMarks: [
        { itemId: 'item-1', quality: 'bad' },
        { itemId: 'item-2', quality: 'good' },
      ],
    });

    expect(result).toEqual({ success: true, status: 'rejected' });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SubmitBusinessReferralReview'),
      expect.objectContaining({
        businessId: 'business-1',
        object: expect.objectContaining({
          status: 'rejected',
          rejection_reason: 'Low quality photos',
          good_item_count: 1,
          bad_item_count: 1,
          item_marks: {
            data: [
              { item_id: 'item-1', quality: 'bad' },
              { item_id: 'item-2', quality: 'good' },
            ],
          },
        }),
      })
    );
    expect(notificationsService.sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.stringContaining('Low quality photos'),
      expect.objectContaining({ event: 'business_referral_review_rejected' })
    );
  });

  it('notifies agent on approve without writing rejection message', async () => {
    hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('SubmitBusinessReferralReview')) {
        return {
          delete_business_referral_review_item_marks: { affected_rows: 0 },
          insert_business_referral_reviews_one: { id: 'review-1', status: 'approved' },
        };
      }
      return { affected_rows: 1 };
    });

    const result = await service.submit('business-1', 'mod-1', {
      decision: 'approve',
      itemMarks: [{ itemId: 'item-1', quality: 'good' }],
    });

    expect(result.status).toBe('approved');
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('InsertReferralReviewRejectionMessage'),
      expect.anything()
    );
    expect(notificationsService.sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ event: 'business_referral_review_approved' })
    );
  });
});

