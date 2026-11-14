import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';

const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

const started = {
  businessUserId: 'biz-user',
  rentalItemName: 'JBL PartyBox 310',
  bookingId: '11111111-1111-4111-8111-111111111111',
  renterName: 'Amina',
  endAt: '2026-11-19T01:00:00.000Z',
  countryCode: 'CA',
};

function noticeService(enabled: boolean, mutate: jest.Mock) {
  const none = {} as never;
  const service = new NotificationsService(
    { get: jest.fn(() => ({ enabled })) } as unknown as ConfigService,
    { executeMutation: mutate, executeQuery: jest.fn() } as unknown as HasuraSystemService,
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
    sendPushNotificationByUserId: () => Promise<void>;
    sendBusinessRentalStarted: (params: typeof started) => Promise<void>;
  };
  jest.spyOn(target, 'languageFor').mockResolvedValue('en');
  const push = jest.spyOn(target, 'sendPushNotificationByUserId').mockResolvedValue(undefined);
  return { target, push };
}

describe('business rental started notice', () => {
  it('writes the in-app row when push is disabled', async () => {
    const mutate = jest.fn().mockResolvedValue({ insert_user_messages_one: { id: 'row-1' } });
    const { target, push } = noticeService(false, mutate);
    await target.sendBusinessRentalStarted(started);
    expect(mutate).toHaveBeenCalledWith(
      expect.stringContaining('on_conflict'),
      expect.objectContaining({
        object: expect.objectContaining({
          notice_idempotency_key: `${started.bookingId}:rental_started`,
        }),
      })
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('sends one push when the insert wins and skips a conflicting replay', async () => {
    const mutate = jest
      .fn()
      .mockResolvedValueOnce({ insert_user_messages_one: { id: 'row-1' } })
      .mockResolvedValueOnce({ insert_user_messages_one: null });
    const { target, push } = noticeService(true, mutate);
    await target.sendBusinessRentalStarted(started);
    await target.sendBusinessRentalStarted(started);
    expect(push).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('does not push when the insert fails', async () => {
    const mutate = jest.fn().mockRejectedValue(new Error('constraint missing'));
    const { target, push } = noticeService(true, mutate);
    await target.sendBusinessRentalStarted(started);
    expect(push).not.toHaveBeenCalled();
  });
});
