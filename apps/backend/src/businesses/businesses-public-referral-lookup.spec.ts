jest.mock('../business-referrals/business-referrals.service', () => ({
  BusinessReferralsService: jest.fn(),
}));
jest.mock('../business-referral-payouts/referral-projected-payout.service', () => ({
  ReferralProjectedPayoutService: jest.fn(),
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: jest.fn(),
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';

describe('BusinessesController.getBusinessByReferralCode', () => {
  const build = (lookup: Record<string, unknown> | null) => {
    const findBusinessByCode = jest.fn().mockResolvedValue(lookup);
    const controller = new BusinessesController(
      {
        normalizeReferralCode: (code: string) => {
          const normalized = code.trim().toUpperCase();
          return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
        },
        findBusinessByCode,
      } as any,
      {} as any,
      {} as any
    );
    return { controller, findBusinessByCode };
  };

  const lookup = {
    businessId: 'biz-1',
    businessName: 'Renda Shop',
    userId: 'owner-1',
    userEmail: 'owner.besong@example.com',
    userFirstName: 'Samuel',
    userLastName: 'Besong',
    ai_tokens: 40,
    ai_reel_tokens: 7,
    lifecycleStatus: 'active',
  };

  it('returns only the business name, not the owner or token balances', async () => {
    const { controller } = build(lookup);
    const res = await controller.getBusinessByReferralCode(' ab12cd ');

    expect(res).toEqual({
      success: true,
      businessCode: 'AB12CD',
      businessName: 'Renda Shop',
    });
    expect(JSON.stringify(res)).not.toMatch(/Besong|owner\.besong|owner-1|ai_tokens|"40"/);
  });

  it('404s a suspended business without echoing the lookup', async () => {
    const { controller } = build({ ...lookup, lifecycleStatus: 'suspended' });
    const error = await controller
      .getBusinessByReferralCode('AB12CD')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toMatchObject({ error: 'Business not found' });
    expect(JSON.stringify(error.getResponse())).not.toMatch(/Renda Shop|Besong|owner\.besong/);
  });

  it('400s a bad code before looking the business up', async () => {
    const { controller, findBusinessByCode } = build(lookup);
    const error = await controller.getBusinessByReferralCode('nope').catch((caught) => caught);

    expect(error.getStatus()).toBe(400);
    expect(findBusinessByCode).not.toHaveBeenCalled();
  });
});
