import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppInboundService } from './whatsapp-inbound.service';

describe('WhatsAppInboundService', () => {
  it('rejects webhook when app secret is not configured', () => {
    const configService = {
      get: jest.fn().mockReturnValue({ appSecret: '' }),
    } as unknown as ConfigService;
    const service = new WhatsAppInboundService(
      configService,
      { markByProviderMessageId: jest.fn() } as any,
      { handleInboundText: jest.fn() } as any
    );
    expect(() =>
      service.assertValidSignature(Buffer.from('{}'), 'sha256=abc')
    ).toThrow(ForbiddenException);
  });

  it('stores the full Meta change value in analytics meta', async () => {
    const markByProviderMessageId = jest.fn().mockResolvedValue(undefined);
    const service = new WhatsAppInboundService(
      { get: jest.fn() } as unknown as ConfigService,
      { markByProviderMessageId } as any,
      { handleInboundText: jest.fn() } as any
    );
    const value = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '15551234567', phone_number_id: '123' },
      statuses: [
        {
          id: 'wamid.abc',
          status: 'delivered',
          timestamp: '1710000000',
          recipient_id: '15557654321',
          conversation: { id: 'conv-1', origin: { type: 'utility' } },
          pricing: { billable: true, category: 'utility' },
        },
      ],
    };

    await service.handleWebhookBody({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value }] }],
    });

    expect(markByProviderMessageId).toHaveBeenCalledWith(
      'wamid.abc',
      'delivered',
      value
    );
  });
});
