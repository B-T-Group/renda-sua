import { ForbiddenException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppInboundService } from '../notifications/orchestration/whatsapp-inbound.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

describe('WhatsAppWebhookController', () => {
  const verifyToken = 'test-verify-token';
  let controller: WhatsAppWebhookController;
  let res: { status: jest.Mock; type: jest.Mock; send: jest.Mock };
  let inbound: {
    assertValidSignature: jest.Mock;
    handleWebhookBody: jest.Mock;
  };

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue({ webhookVerifyToken: verifyToken }),
    } as unknown as ConfigService;
    inbound = {
      assertValidSignature: jest.fn(),
      handleWebhookBody: jest
        .fn()
        .mockResolvedValue({ received: true as const }),
    };
    controller = new WhatsAppWebhookController(
      configService,
      inbound as unknown as WhatsAppInboundService
    );
    res = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('returns hub.challenge when verification succeeds', () => {
    controller.verifyWebhook('subscribe', verifyToken, '12345', res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('text/plain');
    expect(res.send).toHaveBeenCalledWith('12345');
  });

  it('rejects invalid verify token', () => {
    expect(() =>
      controller.verifyWebhook('subscribe', 'wrong', '12345', res as any)
    ).toThrow(ForbiddenException);
  });

  it('acknowledges POST events via inbound service with raw body', async () => {
    const payload = { object: 'whatsapp_business_account' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const req = { body: rawBody } as any;
    await expect(
      controller.handleWebhook(req, 'sha256=abc')
    ).resolves.toEqual({ received: true });
    expect(inbound.assertValidSignature).toHaveBeenCalledWith(
      rawBody,
      'sha256=abc'
    );
    expect(inbound.handleWebhookBody).toHaveBeenCalledWith(payload);
  });

  it('rejects non-buffer POST body', async () => {
    await expect(
      controller.handleWebhook({ body: { object: 'x' } } as any, undefined)
    ).rejects.toBeInstanceOf(HttpException);
  });
});
