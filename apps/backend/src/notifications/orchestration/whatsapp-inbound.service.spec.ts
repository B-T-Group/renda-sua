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
});
