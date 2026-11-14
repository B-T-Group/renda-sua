import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import { RENTAL_NOT_RECEIVED_BUSINESS_BODY } from './rental-push.messages';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';

const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

function setup(pushEnabled: boolean) {
  const executeMutation = jest.fn(async () => ({ insert_user_messages_one: { id: 'm-1' } }));
  const listUsersWithRoles = jest.fn(async () => [
    { userId: 's1', email: 's1@rendasua.com', preferredLanguage: 'en', country: null, roles: ['support'] },
    { userId: 's2', email: 's2@rendasua.com', preferredLanguage: 'fr', country: null, roles: ['superuser'] },
    { userId: 's3', email: 's3@rendasua.com', preferredLanguage: 'en', country: null, roles: ['order_manager'] },
  ]);
  const config = {
    get: jest.fn((key: string) => (key === 'push' ? { enabled: pushEnabled } : undefined)),
  };
  const none = {} as never;
  const service = new NotificationsService(
    config as unknown as ConfigService,
    { executeMutation } as unknown as HasuraSystemService,
    none,
    { listUsersWithRoles } as never,
    none,
    none,
    none,
    none,
    none
  );
  const push = jest
    .spyOn(service as unknown as { sendPushNotificationByUserId: () => Promise<unknown> }, 'sendPushNotificationByUserId')
    .mockResolvedValue({ webSent: 1, expoSent: 1 });
  const email = jest
    .spyOn(service as unknown as { sendSimpleLifecycleEmail: () => Promise<unknown> }, 'sendSimpleLifecycleEmail')
    .mockResolvedValue(undefined);
  return { service, executeMutation, push, email };
}

describe('rental not-received notices', () => {
  const previousAdmin = process.env.ADMIN_NOTIFICATION_EMAIL;

  afterEach(() => {
    if (previousAdmin === undefined) delete process.env.ADMIN_NOTIFICATION_EMAIL;
    else process.env.ADMIN_NOTIFICATION_EMAIL = previousAdmin;
  });

  it('writes the exact English sentence to the business in-app row, push, and email', async () => {
    const { service, executeMutation, push, email } = setup(true);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: 'biz@shop.test',
      preferred_language: 'en',
    });
    await service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' });
    expect(executeMutation).toHaveBeenCalledWith(expect.stringContaining('insert_user_messages_one'), {
      object: expect.objectContaining({
        user_id: 'bu1',
        entity_type: 'rental_booking',
        entity_id: 'b1',
        message_type: 'RENTAL_NOT_RECEIVED',
        message: RENTAL_NOT_RECEIVED_BUSINESS_BODY.en,
      }),
    });
    expect(push).toHaveBeenCalledWith(
      'bu1',
      'Item not received',
      RENTAL_NOT_RECEIVED_BUSINESS_BODY.en,
      expect.objectContaining({ type: 'rental_not_received', url: '/rentals/bookings/b1?persona=business' })
    );
    expect(email).toHaveBeenCalledWith({
      to: 'biz@shop.test',
      subject: 'Item not received',
      html: `<p>${RENTAL_NOT_RECEIVED_BUSINESS_BODY.en}</p>`,
    });
  });

  it('uses the exact French sentence for a French business', async () => {
    const { service, executeMutation, push, email } = setup(true);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: 'biz@shop.test',
      preferred_language: 'fr',
    });
    await service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' });
    expect(executeMutation.mock.calls[0][1].object.message).toBe(RENTAL_NOT_RECEIVED_BUSINESS_BODY.fr);
    expect(push).toHaveBeenCalledWith('bu1', 'Article non reçu', RENTAL_NOT_RECEIVED_BUSINESS_BODY.fr, expect.any(Object));
    expect(email).toHaveBeenCalledWith(expect.objectContaining({ html: `<p>${RENTAL_NOT_RECEIVED_BUSINESS_BODY.fr}</p>` }));
  });

  it('skips the push when push is off and still writes the in-app row and email', async () => {
    const { service, executeMutation, push, email } = setup(false);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: 'biz@shop.test',
      preferred_language: 'en',
    });
    await service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('emails the shared support inbox in English and pushes each moderator', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const { service, email, push } = setup(true);
    await service.notifySupportRentalNotReceived({
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'Drill',
    });
    expect(email).toHaveBeenCalledWith({
      to: 'support@rendasua.com',
      subject: 'Renter has not received the item',
      html: '<p>RB-1 · Drill. The renter says they have not received the item. No refund or cancellation.</p><p>Review it at /admin/rental-inspections.</p>',
    });
    expect(push).toHaveBeenCalledTimes(3);
    expect(push).toHaveBeenCalledWith(
      's2',
      'Article non remis au locataire',
      expect.stringContaining('Aucun remboursement ni annulation.'),
      expect.objectContaining({ type: 'rental_not_received_support', url: '/admin/rental-inspections' })
    );
  });

  it('skips every channel when the business user id is blank', async () => {
    const { service, executeMutation, push, email } = setup(true);
    await service.sendBusinessRentalNotReceived({ businessUserId: '  ', bookingId: 'b1' });
    await service.sendBusinessRentalNotReceived({ businessUserId: '', bookingId: 'b1' });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('still writes the in-app row and English push when the business has no email', async () => {
    const { service, executeMutation, push, email } = setup(true);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: null,
      preferred_language: null,
    });
    await service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      'bu1',
      'Item not received',
      RENTAL_NOT_RECEIVED_BUSINESS_BODY.en,
      expect.any(Object)
    );
    expect(email).not.toHaveBeenCalled();
  });

  it('treats fr-CM as French and swallows a delivery failure', async () => {
    const { service, executeMutation } = setup(true);
    const lookup = jest
      .spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail')
      .mockResolvedValue({ email: 'biz@shop.test', preferred_language: 'fr-CM' });
    await service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' });
    expect(executeMutation.mock.calls[0][1].object.message).toBe(RENTAL_NOT_RECEIVED_BUSINESS_BODY.fr);

    lookup.mockRejectedValue(new Error('hasura down'));
    await expect(
      service.sendBusinessRentalNotReceived({ businessUserId: 'bu1', bookingId: 'b1' })
    ).resolves.toBeUndefined();
  });

  it('escapes the item name and fills a blank booking in the support email', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const { service, email } = setup(false);
    await service.notifySupportRentalNotReceived({
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'Drill & <saw>',
    });
    const html = email.mock.calls[0][0].html as string;
    expect(html).toContain('Drill &amp; &lt;saw&gt;');
    expect(html).not.toContain('<saw>');

    await service.notifySupportRentalNotReceived({
      bookingId: 'b1',
      bookingNumber: '',
      rentalItemName: '',
    });
    expect(email.mock.calls[1][0].html).toContain('— · Rental.');
  });

  it('sends the support email to ADMIN_NOTIFICATION_EMAIL when that is set', async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = 'ops@rendasua.com';
    const { service, email } = setup(false);
    await service.notifySupportRentalNotReceived({
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'Drill',
    });
    expect(email).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@rendasua.com' }));
  });
});
