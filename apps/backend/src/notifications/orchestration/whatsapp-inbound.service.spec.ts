import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppInboundService } from './whatsapp-inbound.service';

describe('WhatsAppInboundService', () => {
  const inbox = {
    persistInbound: jest.fn().mockResolvedValue({
      messageId: 'msg-1',
      conversationId: 'conv-1',
    }),
    markByWamid: jest.fn().mockResolvedValue(undefined),
  };
  const replyService = { handleInboundText: jest.fn() };
  const analytics = { markByProviderMessageId: jest.fn() };
  const notifications = {
    notifyWhatsAppInboxInbound: jest.fn().mockResolvedValue(undefined),
  };

  function buildService(appSecret = 'secret') {
    const configService = {
      get: jest.fn().mockReturnValue({ appSecret }),
    } as unknown as ConfigService;
    return new WhatsAppInboundService(
      configService,
      analytics as any,
      replyService as any,
      inbox as any,
      notifications as any
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
    expect(notifications.notifyWhatsAppInboxInbound).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      preview: 'STOP',
      customerPhone: '15557654321',
    });
  });

  it('does not push staff when the inbound message is a duplicate wamid', async () => {
    inbox.persistInbound.mockResolvedValueOnce(null);
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
                    id: 'wamid.dup',
                    type: 'text',
                    text: { body: 'hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(notifications.notifyWhatsAppInboxInbound).not.toHaveBeenCalled();
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

  it('stores image captions as the inbox preview', async () => {
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
                    id: 'wamid.img.cap',
                    type: 'image',
                    image: { id: 'media-2', caption: 'Storefront' },
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
        body: 'Storefront',
      })
    );
  });

  it('routes interactive button replies', async () => {
    const service = buildService();
    replyService.handleInteractiveReply = jest.fn();
    await service.handleWebhookBody({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15557654321',
                    id: 'wamid.btn',
                    type: 'interactive',
                    context: { id: 'wamid.out.order-b' },
                    interactive: {
                      type: 'button_reply',
                      button_reply: { id: 'confirm', title: 'Confirm' },
                    },
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
        type: 'interactive',
        body: 'Confirm (confirm)',
      })
    );
    expect(replyService.handleInteractiveReply).toHaveBeenCalledWith({
      fromPhone: '15557654321',
      buttonId: 'confirm',
      buttonTitle: 'Confirm',
      messageId: 'wamid.btn',
      contextMessageId: 'wamid.out.order-b',
    });
  });

  it('routes template quick-reply button taps', async () => {
    const service = buildService();
    replyService.handleInteractiveReply = jest.fn();
    await service.handleWebhookBody({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15557654321',
                    id: 'wamid.tpl.btn',
                    type: 'button',
                    button: { text: 'Confirmer', payload: 'Confirmer' },
                    context: { id: 'wamid.out.order-c' },
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
        type: 'interactive',
        body: 'Confirmer',
      })
    );
    expect(replyService.handleInteractiveReply).toHaveBeenCalledWith({
      fromPhone: '15557654321',
      buttonId: 'Confirmer',
      buttonTitle: 'Confirmer',
      messageId: 'wamid.tpl.btn',
      contextMessageId: 'wamid.out.order-c',
    });
  });
});
