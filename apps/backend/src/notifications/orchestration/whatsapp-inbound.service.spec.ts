import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppInboundService } from './whatsapp-inbound.service';

describe('WhatsAppInboundService', () => {
  const inbox = {
    persistInbound: jest.fn().mockResolvedValue('msg-1'),
    markByWamid: jest.fn().mockResolvedValue(undefined),
  };
  const replyService = { handleInboundText: jest.fn() };
  const analytics = { markByProviderMessageId: jest.fn() };

  function buildService(appSecret = 'secret') {
    const configService = {
      get: jest.fn().mockReturnValue({ appSecret }),
    } as unknown as ConfigService;
    return new WhatsAppInboundService(
      configService,
      analytics as any,
      replyService as any,
      inbox as any
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects webhook when app secret is not configured', () => {
    const service = buildService('');
    expect(() =>
      service.assertValidSignature(Buffer.from('{}'), 'sha256=abc')
    ).toThrow(ForbiddenException);
  });

  it('persists inbound then routes text commands', async () => {
    const service = buildService();
    await service.handleWebhookBody({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15557654321',
                    id: 'wamid.in.1',
                    type: 'text',
                    text: { body: 'STOP' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(inbox.persistInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        waId: '15557654321',
        wamid: 'wamid.in.1',
        body: 'STOP',
        bumpUnread: true,
      })
    );
    expect(replyService.handleInboundText).toHaveBeenCalledWith({
      fromPhone: '15557654321',
      text: 'STOP',
      messageId: 'wamid.in.1',
    });
  });

  it('stores delivery status in analytics and inbox', async () => {
    const service = buildService();
    const value = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '15551234567', phone_number_id: '123' },
      statuses: [
        {
          id: 'wamid.abc',
          status: 'delivered',
          timestamp: '1710000000',
          recipient_id: '15557654321',
        },
      ],
    };

    await service.handleWebhookBody({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value }] }],
    });

    expect(analytics.markByProviderMessageId).toHaveBeenCalledWith(
      'wamid.abc',
      'delivered',
      value
    );
    expect(inbox.markByWamid).toHaveBeenCalledWith(
      'wamid.abc',
      'delivered',
      undefined
    );
  });

  it('persists non-text inbound without routing commands', async () => {
    const service = buildService();
    await service.handleWebhookBody({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15557654321',
                    id: 'wamid.img',
                    type: 'image',
                    image: { id: 'media-1' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(inbox.persistInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        body: '[Image]',
      })
    );
    expect(replyService.handleInboundText).not.toHaveBeenCalled();
  });
});
