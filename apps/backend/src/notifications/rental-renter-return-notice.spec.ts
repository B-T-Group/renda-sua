import type { ConfigService } from '@nestjs/config';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService as NotificationsServiceType } from './notifications.service';

const { NotificationsService } = jest.requireActual<{
  NotificationsService: new (...args: unknown[]) => NotificationsServiceType;
}>('./notifications.service');

const RETURNED_EN = 'JBL · RB-1. Please check the item and confirm the return.';
const RETURNED_FR = 'JBL · RB-1. Vérifiez l’article et confirmez le retour.';
const HELD_EN =
  'Drill & <saw> · RB-1. The renter reported the return. The business has not confirmed within 24 hours. The deposit is still held.';

function setup(pushEnabled: boolean) {
  const executeMutation = jest.fn(async () => ({ insert_user_messages_one: { id: 'm-1' } }));
  const listUsersWithRoles = jest.fn(async () => [
    { userId: 's1', email: 's1@rendasua.com', preferredLanguage: 'en', country: null, roles: ['support'] },
    { userId: 's2', email: 's2@rendasua.com', preferredLanguage: 'fr', country: null, roles: ['superuser'] },
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
    none,
    none
  );
  const push = jest
    .spyOn(service as unknown as { sendPushNotificationByUserId: () => Promise<unknown> }, 'sendPushNotificationByUserId')
    .mockResolvedValue({ webSent: 1, expoSent: 1 });
  const email = jest
    .spyOn(service as unknown as { sendSimpleLifecycleEmail: () => Promise<unknown> }, 'sendSimpleLifecycleEmail')
    .mockResolvedValue(undefined);
  return { service, executeMutation, push, email, listUsersWithRoles };
}

describe('renter return notices', () => {
  const previousAdmin = process.env.ADMIN_NOTIFICATION_EMAIL;

  afterEach(() => {
    if (previousAdmin === undefined) delete process.env.ADMIN_NOTIFICATION_EMAIL;
    else process.env.ADMIN_NOTIFICATION_EMAIL = previousAdmin;
  });

  it('writes the English sentence in-app and on push, and does not email the business', async () => {
    const { service, executeMutation, push, email } = setup(true);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: 'biz@shop.test',
      preferred_language: 'en',
    });
    await service.sendBusinessRenterReturned({
      businessUserId: 'bu1',
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'JBL',
    });
    expect(executeMutation).toHaveBeenCalledWith(expect.stringContaining('insert_user_messages_one'), {
      object: expect.objectContaining({
        user_id: 'bu1',
        entity_type: 'rental_booking',
        entity_id: 'b1',
        message_type: 'RENTAL_RENTER_RETURN_REPORTED',
        message: RETURNED_EN,
      }),
    });
    expect(push).toHaveBeenCalledWith(
      'bu1',
      'Renter says the item is back',
      RETURNED_EN,
      expect.objectContaining({
        type: 'rental_renter_returned',
        rentalBookingId: 'b1',
        url: '/rentals/bookings/b1?persona=business',
      })
    );
    expect(email).not.toHaveBeenCalled();
  });

  it('uses the French sentence for fr-CM and still writes the row when push is off', async () => {
    const { service, executeMutation, push } = setup(false);
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockResolvedValue({
      email: 'biz@shop.test',
      preferred_language: 'fr-CM',
    });
    await service.sendBusinessRenterReturned({
      businessUserId: 'bu1',
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'JBL',
    });
    expect(executeMutation.mock.calls[0][1].object.message).toBe(RETURNED_FR);
    expect(push).not.toHaveBeenCalled();
  });

  it('writes nothing for a blank business user and swallows a lookup failure', async () => {
    const { service, executeMutation, push } = setup(true);
    await service.sendBusinessRenterReturned({
      businessUserId: '  ',
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'JBL',
    });
    expect(executeMutation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    jest.spyOn(service as unknown as { getUserRowForEmail: () => Promise<unknown> }, 'getUserRowForEmail').mockRejectedValue(new Error('down'));
    await expect(service.sendBusinessRenterReturned({
      businessUserId: 'bu1',
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'JBL',
    })).resolves.toBeUndefined();
  });

  it('emails support in English that the deposit is still held and escapes the item name', async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = 'ops@rendasua.com';
    const { service, email, push, listUsersWithRoles } = setup(true);
    await service.notifySupportRenterReturnUnconfirmed({
      bookingId: 'b1',
      bookingNumber: 'RB-1',
      rentalItemName: 'Drill & <saw>',
    });
    expect(email).toHaveBeenCalledWith({
      to: 'ops@rendasua.com',
      subject: 'Return reported and not confirmed',
      html: `<p>${HELD_EN.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><p>Review it at /admin/rental-inspections.</p>`,
    });
    expect(String(email.mock.calls[0][0].html)).not.toContain('<saw>');
    expect(String(email.mock.calls[0][0].html)).toContain('The deposit is still held.');
    expect(listUsersWithRoles).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      's2',
      'Retour signalé sans confirmation',
      expect.stringContaining('La caution reste retenue.'),
      expect.objectContaining({ type: 'rental_return_report_escalated', url: '/admin/rental-inspections' })
    );
  });

  it('still emails support when push is off and does not look up moderators', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const { service, email, push, listUsersWithRoles } = setup(false);
    await service.notifySupportRenterReturnUnconfirmed({
      bookingId: 'b1',
      bookingNumber: '',
      rentalItemName: '',
    });
    expect(email).toHaveBeenCalledWith(expect.objectContaining({
      to: 'support@rendasua.com',
      subject: 'Return reported and not confirmed',
    }));
    expect(String(email.mock.calls[0][0].html)).toContain('Rental · —. The renter reported the return.');
    expect(push).not.toHaveBeenCalled();
    expect(listUsersWithRoles).not.toHaveBeenCalled();
  });
});
