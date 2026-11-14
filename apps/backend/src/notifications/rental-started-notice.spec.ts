import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';

const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

describe('business rental started notice', () => {
  it('writes the in-app row when push is disabled', async () => {
    const config = { get: jest.fn(() => ({ enabled: false })) };
    const none = {} as never;
    const service = new NotificationsService(
      config as unknown as ConfigService,
      { executeMutation: jest.fn(), executeQuery: jest.fn() } as unknown as HasuraSystemService,
      none,
      none,
      none,
      none,
      none,
      none,
      none
    );
    const target = service as unknown as {
      languageFor: () => Promise<string>;
      insertRentalUserMessage: (...args: unknown[]) => Promise<void>;
      sendPushNotificationByUserId: () => Promise<void>;
      sendBusinessRentalStarted: (params: unknown) => Promise<void>;
    };
    jest.spyOn(target, 'languageFor').mockResolvedValue('en');
    const insert = jest.spyOn(target, 'insertRentalUserMessage').mockResolvedValue(undefined);
    const push = jest.spyOn(target, 'sendPushNotificationByUserId').mockResolvedValue(undefined);
    await target.sendBusinessRentalStarted({
      businessUserId: 'biz-user',
      rentalItemName: 'JBL PartyBox 310',
      bookingId: 'b1',
      renterName: 'Amina',
      endAt: '2026-11-19T01:00:00.000Z',
      countryCode: 'CA',
    });
    expect(insert).toHaveBeenCalledWith(
      'biz-user',
      'b1',
      'RENTAL_STARTED',
      expect.stringContaining('is now in progress'),
      '/rentals/bookings/b1?persona=business',
      'rental_started'
    );
    expect(push).not.toHaveBeenCalled();
  });
});
