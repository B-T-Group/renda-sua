import {
  parseReferralRejectionFromNotification,
  parseReferralRejectionPayload,
} from './parseReferralRejectionPayload';

describe('parseReferralRejectionPayload', () => {
  it('parses rejection push data', () => {
    const parsed = parseReferralRejectionPayload({
      event: 'business_referral_review_rejected',
      businessId: 'b1',
      businessName: 'Demo',
      rejectionReason: 'Poor photos',
      reviewId: 'r1',
    });
    expect(parsed).toEqual({
      businessId: 'b1',
      businessName: 'Demo',
      rejectionReason: 'Poor photos',
      reviewId: 'r1',
    });
  });

  it('returns null for unrelated events', () => {
    expect(
      parseReferralRejectionPayload({ event: 'business_referral_credit' })
    ).toBeNull();
    expect(
      parseReferralRejectionPayload({ event: 'pickup_reminder' })
    ).toBeNull();
  });

  it('requires rejection event even when title/body look like a rejection', () => {
    expect(
      parseReferralRejectionFromNotification({
        title: 'Referral payout rejected',
        body: 'Referral for Demo was rejected: Poor photos',
        data: {},
      })
    ).toBeNull();
  });

  it('does not treat pickup reminders as referral rejections', () => {
    expect(
      parseReferralRejectionFromNotification({
        title: 'Rappel de collecte',
        body: 'Commande 94732957 à récupérer avant 0:16. Rendez-vous chez Virtual Sales.',
        data: {
          event: 'pickup_reminder',
          orderId: 'o1',
          orderNumber: '94732957',
        },
      })
    ).toBeNull();
  });

  it('parses when data includes the rejection event', () => {
    const parsed = parseReferralRejectionFromNotification({
      title: 'Referral payout rejected',
      body: 'Referral for Demo was rejected: Poor photos',
      data: {
        event: 'business_referral_review_rejected',
        businessId: 'b1',
        businessName: 'Demo',
        rejectionReason: 'Poor photos',
        reviewId: 'r1',
      },
    });
    expect(parsed).toEqual({
      businessId: 'b1',
      businessName: 'Demo',
      rejectionReason: 'Poor photos',
      reviewId: 'r1',
    });
  });
});
