import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

describe('WhatsAppWebhookController', () => {
  const verifyToken = 'test-verify-token';
  let controller: WhatsAppWebhookController;
  let res: { status: jest.Mock; type: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue({ webhookVerifyToken: verifyToken }),
    } as unknown as ConfigService;
    controller = new WhatsAppWebhookController(configService);
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

  it('acknowledges POST events without processing', () => {
    expect(controller.handleWebhook({ object: 'whatsapp_business_account' })).toEqual(
      { received: true }
    );
  });
});
