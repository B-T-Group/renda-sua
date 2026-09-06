import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { SmsService } from '../sms/sms.service';
import { OrderRecipientNotificationsService } from './order-recipient-notifications.service';
import { WhatsAppChannel } from './orchestration/channels/whatsapp.channel';

const THIRD_PARTY_ORDER = {
  id: 'order-1',
  order_number: 'ORD-20260905-000001',
  recipient_name: 'Awa Ndong',
  recipient_phone: '+24177123456',
  recipient_notify_whatsapp: false,
  is_third_party_recipient: true,
  payer_name: 'Marie Obame',
  payer_phone: '+15145550000',
  fulfillment_country: 'GA',
  fulfillment_method: 'delivery',
  business: { name: 'Chez Nkoghe' },
};

describe('OrderRecipientNotificationsService', () => {
  let hasura: { executeQuery: jest.Mock };
  let sms: { sendSms: jest.Mock };
  let whatsApp: { send: jest.Mock };
  let service: OrderRecipientNotificationsService;

  function build(order: unknown = THIRD_PARTY_ORDER, smsEnabled = true) {
    hasura = {
      executeQuery: jest.fn().mockResolvedValue({ orders_by_pk: order }),
    };
    sms = { sendSms: jest.fn().mockResolvedValue({ success: true }) };
    whatsApp = { send: jest.fn().mockResolvedValue({ status: 'sent' }) };
    const configService = {
      get: (key: string) => (key === 'sms' ? { enabled: smsEnabled } : undefined),
    } as unknown as ConfigService;

    service = new OrderRecipientNotificationsService(
      hasura as unknown as HasuraSystemService,
      sms as unknown as SmsService,
      whatsApp as unknown as WhatsAppChannel,
      configService
    );
  }

  beforeEach(() => build());

  describe('notifyStatusChange', () => {
    it('texts the recipient in French for a Gabonese delivery', async () => {
      await service.notifyStatusChange('order-1', 'out_for_delivery');

      expect(sms.sendSms).toHaveBeenCalledTimes(1);
      const [{ to, message }] = sms.sendSms.mock.calls[0];
      expect(to).toBe('+24177123456');
      expect(message).toContain('ORD-20260905-000001');
      expect(message).toContain('code de livraison');
    });

    it('names the payer in the order-placed message', async () => {
      await service.notifyStatusChange('order-1', 'pending');

      expect(sms.sendSms.mock.calls[0][0].message).toContain('Marie Obame');
      expect(sms.sendSms.mock.calls[0][0].message).toContain('Chez Nkoghe');
    });

    it('uses WhatsApp instead of SMS when the recipient opted in', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });

      await service.notifyStatusChange('order-1', 'out_for_delivery');

      expect(whatsApp.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+24177123456',
          locale: 'fr',
          payload: {
            templateKey: 'recipient_out_for_delivery',
            variables: {
              orderNumber: 'ORD-20260905-000001',
            },
          },
        })
      );
      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('uses appealed dedicated templates for placed / enroute / ready', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });

      await service.notifyStatusChange('order-1', 'pending');
      expect(whatsApp.send.mock.calls[0][0].payload).toEqual({
        templateKey: 'recipient_order_placed',
        variables: {
          payerName: 'Marie Obame',
          storeName: 'Chez Nkoghe',
          orderNumber: 'ORD-20260905-000001',
        },
      });

      await service.notifyStatusChange('order-1', 'ready_for_pickup');
      expect(whatsApp.send.mock.calls[1][0].payload).toEqual({
        templateKey: 'recipient_order_ready',
        variables: {
          orderNumber: 'ORD-20260905-000001',
          storeName: 'Chez Nkoghe',
        },
      });
    });

    it('uses the recipient update template for confirmed/delivered/cancelled', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });

      await service.notifyStatusChange('order-1', 'confirmed');

      expect(whatsApp.send.mock.calls[0][0].payload).toEqual({
        templateKey: 'recipient_order_update',
        variables: {
          orderNumber: 'ORD-20260905-000001',
          statusLabel: 'confirmée',
        },
      });
    });
    it('falls back to SMS when the WhatsApp send fails', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });
      whatsApp.send.mockResolvedValue({ status: 'failed', error: 'nope' });

      await service.notifyStatusChange('order-1', 'complete');

      expect(sms.sendSms).toHaveBeenCalledTimes(1);
    });

    it('falls back to SMS when the WhatsApp channel throws', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });
      whatsApp.send.mockRejectedValue(new Error('graph down'));

      await service.notifyStatusChange('order-1', 'complete');

      expect(sms.sendSms).toHaveBeenCalledTimes(1);
    });

    it('stays silent when the recipient is the payer', async () => {
      build({ ...THIRD_PARTY_ORDER, is_third_party_recipient: false });

      await service.notifyStatusChange('order-1', 'out_for_delivery');

      expect(sms.sendSms).not.toHaveBeenCalled();
      expect(whatsApp.send).not.toHaveBeenCalled();
    });

    it('stays silent when the recipient phone duplicates the payer phone', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_phone: '15145550000' });

      await service.notifyStatusChange('order-1', 'out_for_delivery');

      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('ignores statuses the recipient does not need', async () => {
      await service.notifyStatusChange('order-1', 'assigned_to_agent');

      expect(hasura.executeQuery).not.toHaveBeenCalled();
      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('does not send the same milestone twice', async () => {
      await service.notifyStatusChange('order-1', 'confirmed');
      await service.notifyStatusChange('order-1', 'confirmed');

      expect(sms.sendSms).toHaveBeenCalledTimes(1);
    });

    it('swallows a Hasura lookup failure', async () => {
      build();
      hasura.executeQuery.mockRejectedValue(new Error('hasura down'));

      await expect(
        service.notifyStatusChange('order-1', 'complete')
      ).resolves.toBeUndefined();
      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('swallows an SMS provider failure', async () => {
      sms.sendSms.mockRejectedValue(new Error('orange down'));

      await expect(
        service.notifyStatusChange('order-1', 'complete')
      ).resolves.toBeUndefined();
    });

    it('skips SMS entirely when SMS_ENABLED is off', async () => {
      build(THIRD_PARTY_ORDER, false);

      await service.notifyStatusChange('order-1', 'complete');

      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('writes English copy for an English-speaking fulfillment country', async () => {
      build({ ...THIRD_PARTY_ORDER, fulfillment_country: 'US' });

      await service.notifyStatusChange('order-1', 'complete');

      expect(sms.sendSms.mock.calls[0][0].message).toContain('delivered');
    });
  });

  describe('notifyDeliveryPin', () => {
    it('texts the PIN to the recipient so they can verify the agent', async () => {
      await service.notifyDeliveryPin('order-1', '4821');

      expect(sms.sendSms.mock.calls[0][0].message).toContain('4821');
      expect(sms.sendSms.mock.calls[0][0].to).toBe('+24177123456');
    });

    it('uses the approved authentication template on WhatsApp', async () => {
      build({ ...THIRD_PARTY_ORDER, recipient_notify_whatsapp: true });

      await service.notifyDeliveryPin('order-1', '4821');

      expect(whatsApp.send.mock.calls[0][0].payload).toEqual({
        templateKey: 'delivery_pin',
        variables: { pin: '4821' },
      });
    });

    it('does nothing without a PIN', async () => {
      await service.notifyDeliveryPin('order-1', '  ');

      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });

    it('does not resend the same PIN', async () => {
      await service.notifyDeliveryPin('order-1', '4821');
      await service.notifyDeliveryPin('order-1', '4821');

      expect(sms.sendSms).toHaveBeenCalledTimes(1);
    });
  });
});
