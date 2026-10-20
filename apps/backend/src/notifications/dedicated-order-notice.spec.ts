import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';
import {
  buildDedicatedAutoAssignedMessage,
  buildDedicatedConfirmReminderMessage,
  buildDedicatedOfferMessage,
} from './dedicated-order-push.messages';

// test-setup.ts replaces NotificationsService with an empty class; this spec needs the real one.
const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

describe('NotificationsService.sendDedicatedOrderNotice (#594 PR 5)', () => {
  const setup = (pushEnabled: boolean, failInsert = false) => {
    const executeMutation = jest.fn(async () => {
      if (failInsert) throw new Error('db down');
      return { insert_user_messages_one: { id: 'm-1' } };
    });
    const config = { get: jest.fn((key: string) => (key === 'push' ? { enabled: pushEnabled } : undefined)) };
    const none = {} as never;
    const service = new NotificationsService(
      config as unknown as ConfigService,
      { executeMutation } as unknown as HasuraSystemService,
      none,
      none,
      none,
      none,
      none,
      none,
      none
    );
    const push = jest
      .spyOn(service as unknown as { sendPushNotificationByUserId: () => Promise<unknown> }, 'sendPushNotificationByUserId')
      .mockResolvedValue({ webSent: 1, expoSent: 1 });
    return { service, executeMutation, push };
  };
  const params = {
    userId: 'u-1',
    title: 'Confirm the delivery window',
    body: 'Order ORD-1: ...',
    messageType: 'DEDICATED_COVERAGE_CONFIRM_REMINDER',
    orderId: 'o-1',
    event: 'dedicated.confirm_window_reminder',
    persona: 'business' as const,
  };

  it('writes the in-app message on the order and sends the push to the order page', async () => {
    const { service, executeMutation, push } = setup(true);
    await service.sendDedicatedOrderNotice(params);
    expect(executeMutation).toHaveBeenCalledWith(expect.stringContaining('insert_user_messages_one'), {
      object: {
        user_id: 'u-1',
        entity_type: 'order',
        entity_id: 'o-1',
        message_type: 'DEDICATED_COVERAGE_CONFIRM_REMINDER',
        message: 'Order ORD-1: ...',
        message_payload: { path: '/orders/o-1', event: params.event, persona: 'business', orderId: 'o-1' },
      },
    });
    expect(push).toHaveBeenCalledWith('u-1', params.title, params.body, {
      url: '/orders/o-1',
      event: params.event,
      persona: 'business',
      orderId: 'o-1',
    });
  });

  it('push off: in-app only', async () => {
    const { service, executeMutation, push } = setup(false);
    await service.sendDedicatedOrderNotice(params);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('a failed in-app write still pushes and never throws', async () => {
    const { service, push } = setup(true, true);
    await expect(service.sendDedicatedOrderNotice(params)).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('no user: nothing', async () => {
    const { service, executeMutation, push } = setup(true);
    await service.sendDedicatedOrderNotice({ ...params, userId: '' });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('dedicated order copy (#594 PR 5)', () => {
  it('auto-assignment, offer and reminder in English and French', () => {
    expect(buildDedicatedAutoAssignedMessage({ orderNumber: 'ORD-1', storeName: 'Chez Mama', slotKey: 'evening', preferredLanguage: 'en' })).toEqual({
      title: 'Delivery assigned',
      body: 'Order ORD-1 from Chez Mama (Evening) is assigned to you as its dedicated agent',
    });
    expect(
      buildDedicatedAutoAssignedMessage({ orderNumber: 'ORD-1', storeName: 'Chez Mama', slotKey: 'evening', preferredLanguage: 'fr' }).body
    ).toBe('Commande ORD-1 de Chez Mama (Soir) vous est attribuée comme livreur dédié');
    expect(buildDedicatedOfferMessage({ storeName: 'Chez Mama', slotKey: 'morning', preferredLanguage: 'en' })).toEqual({
      title: 'Dedicated delivery available',
      body: 'Pickup: Chez Mama (Morning) - Tap to respond',
    });
    expect(buildDedicatedOfferMessage({ storeName: 'Chez Mama', slotKey: 'morning', preferredLanguage: 'fr' }).body).toBe(
      'Retrait : Chez Mama (Matin) - Touchez pour répondre'
    );
    expect(buildDedicatedConfirmReminderMessage({ orderNumber: 'ORD-1', slotKey: 'afternoon', date: '2026-10-20', preferredLanguage: 'en' })).toEqual({
      title: 'Confirm the delivery window',
      body: 'Order ORD-1: a dedicated agent covers Afternoon on 2026-10-20. Confirm the window so they are sent.',
    });
  });
});
