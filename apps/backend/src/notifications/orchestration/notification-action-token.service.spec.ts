import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { NotificationActionTokenService } from './notification-action-token.service';

describe('NotificationActionTokenService', () => {
  const secret = 'test-action-token-secret';
  let hasura: {
    executeMutation: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let service: NotificationActionTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    hasura = {
      executeMutation: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'whatsapp') return { appSecret: secret };
        if (key === 'notificationsInternal') return { apiKey: '' };
        return undefined;
      }),
    };
    service = new NotificationActionTokenService(
      configService as never,
      hasura as never
    );
  });

  function signBody(body: string): string {
    return createHmac('sha256', secret).update(body).digest('base64url');
  }

  it('issues a signed token and persists a nonce', async () => {
    hasura.executeMutation.mockResolvedValue({
      insert_notification_action_nonces_one: { nonce: 'n' },
    });

    const token = await service.issue({
      userId: 'user-1',
      action: 'accept_order',
      entityId: 'order-1',
      ttlSeconds: 60,
    });

    const [body, sig] = token.split('.');
    expect(body).toBeTruthy();
    expect(sig).toBe(signBody(body));
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_notification_action_nonces_one'),
      expect.objectContaining({
        object: expect.objectContaining({
          user_id: 'user-1',
          action: 'accept_order',
          entity_id: 'order-1',
        }),
      })
    );

    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    );
    expect(payload.userId).toBe('user-1');
    expect(payload.action).toBe('accept_order');
    expect(payload.entityId).toBe('order-1');
    expect(payload.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('verifies a valid token and consumes the nonce once', async () => {
    hasura.executeMutation
      .mockResolvedValueOnce({
        insert_notification_action_nonces_one: { nonce: 'n' },
      })
      .mockResolvedValueOnce({
        update_notification_action_nonces: { affected_rows: 1 },
      });

    const token = await service.issue({
      userId: 'user-1',
      action: 'accept_order',
      entityId: 'order-1',
    });
    const payload = await service.verify(token);

    expect(payload.userId).toBe('user-1');
    expect(payload.entityId).toBe('order-1');
    expect(hasura.executeMutation).toHaveBeenLastCalledWith(
      expect.stringContaining('update_notification_action_nonces'),
      expect.objectContaining({ userId: 'user-1' })
    );
  });

  it('rejects forged signatures', async () => {
    const body = Buffer.from(
      JSON.stringify({
        userId: 'user-1',
        action: 'accept_order',
        entityId: 'order-1',
        exp: Math.floor(Date.now() / 1000) + 60,
        nonce: 'abc',
      })
    ).toString('base64url');

    await expect(service.verify(`${body}.forged`)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects expired tokens before consuming nonce', async () => {
    const body = Buffer.from(
      JSON.stringify({
        userId: 'user-1',
        action: 'accept_order',
        entityId: 'order-1',
        exp: Math.floor(Date.now() / 1000) - 5,
        nonce: 'abc',
      })
    ).toString('base64url');

    await expect(
      service.verify(`${body}.${signBody(body)}`)
    ).rejects.toThrow('Action token expired');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects replayed or already-used tokens', async () => {
    const body = Buffer.from(
      JSON.stringify({
        userId: 'user-1',
        action: 'accept_order',
        entityId: 'order-1',
        exp: Math.floor(Date.now() / 1000) + 60,
        nonce: 'used-nonce',
      })
    ).toString('base64url');
    hasura.executeMutation.mockResolvedValue({
      update_notification_action_nonces: { affected_rows: 0 },
    });

    await expect(
      service.verify(`${body}.${signBody(body)}`)
    ).rejects.toThrow('Action token already used or invalid');
  });

  it('falls back to notifications internal API key as HMAC secret', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'whatsapp') return { appSecret: '' };
      if (key === 'notificationsInternal') return { apiKey: 'internal-key' };
      return undefined;
    });
    service = new NotificationActionTokenService(
      configService as never,
      hasura as never
    );
    hasura.executeMutation.mockResolvedValue({
      insert_notification_action_nonces_one: { nonce: 'n' },
    });

    const token = await service.issue({
      userId: 'user-1',
      action: 'x',
      entityId: 'y',
    });
    const [body, sig] = token.split('.');
    const expected = createHmac('sha256', 'internal-key')
      .update(body)
      .digest('base64url');
    expect(sig).toBe(expected);
  });

  it('rejects issue/verify when no secret is configured', async () => {
    configService.get.mockReturnValue({ appSecret: '', apiKey: '' });
    service = new NotificationActionTokenService(
      configService as never,
      hasura as never
    );

    await expect(
      service.issue({ userId: 'u', action: 'a', entityId: 'e' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
