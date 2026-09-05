jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

describe('BusinessReferralPayoutsService weekly sweep', () => {
  it('delegates new credits to the compensation sweeper', async () => {
    const sweepPending = jest.fn(async () => ({
      credited: 1,
      skipped: 0,
      failed: 0,
    }));
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('IncompleteBusinessReferralPayouts')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });
    const service = new BusinessReferralPayoutsService(
      { executeQuery, executeMutation: jest.fn() } as never,
      {
        resolveRailForUser: jest.fn(),
        getUserCountryCode: jest.fn(),
      } as never,
      {
        getConfigurationByKey: jest.fn(async (key: string) => {
          if (key === 'business_referral_payout_enabled') {
            return { boolean_value: true, status: 'active' };
          }
          return null;
        }),
      } as never,
      { distributeReferralBonus: jest.fn() } as never,
      { sweepPending } as never
    );

    const summary = await service.runWeeklyPayouts();

    expect(sweepPending).toHaveBeenCalled();
    expect(summary.credited).toBe(1);
  });
});
