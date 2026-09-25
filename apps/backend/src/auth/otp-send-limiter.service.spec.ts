jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { OtpSendLimiterService } from './otp-send-limiter.service';
import { AuthOtpConfig } from '../config/configuration';

const baseConfig: AuthOtpConfig = {
  sendCapsEnabled: true,
  codeTtlSeconds: 600,
  resendCooldownSeconds: 120,
  destinationCap10Min: 3,
  destinationCap24H: 10,
  identifierCap10Min: 3,
  identifierCap24H: 10,
  ipCap1Hour: 30,
};

function createLimiter(
  overrides: Partial<AuthOtpConfig> = {}
): OtpSendLimiterService {
  const authOtp = { ...baseConfig, ...overrides };
  const service = new OtpSendLimiterService({
    get: jest.fn((key: string) => {
      if (key === 'authOtp') return authOtp;
      if (key === 'redis') return undefined;
      return undefined;
    }),
  } as never);
  return service;
}

describe('OtpSendLimiterService (in-memory)', () => {
  const services: OtpSendLimiterService[] = [];

  afterEach(async () => {
    await Promise.all(services.splice(0).map((s) => s.onModuleDestroy()));
    jest.useRealTimers();
  });

  function track(service: OtpSendLimiterService) {
    services.push(service);
    return service;
  }

  async function sendThree(
    service: OtpSendLimiterService,
    input: {
      destination: string;
      identifier: string;
      ip?: string;
    }
  ) {
    for (let i = 0; i < 3; i++) {
      await service.assertCanSend({ ...input, isChannelSwitch: false });
      await service.recordSend({ ...input, isChannelSwitch: false });
      jest.advanceTimersByTime(130_000);
    }
  }

  it('blocks the 4th send to the same destination within 10 minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter());
    const input = {
      destination: 'user@example.com',
      identifier: 'email:user@example.com',
      ip: '1.2.3.4',
    };
    await sendThree(service, input);
    await expect(
      service.assertCanSend({ ...input, isChannelSwitch: false })
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: expect.objectContaining({ code: 'OTP_SEND_RATE_LIMITED' }),
    });
  });

  it('tracks identifier across different destinations (channel switch)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter());
    const identifier = 'email:a@b.com|phone:+237600000001';
    await sendThree(service, {
      destination: 'a@b.com',
      identifier,
      ip: '9.9.9.9',
    });
    await expect(
      service.assertCanSend({
        destination: '+237600000001',
        identifier,
        ip: '9.9.9.9',
        isChannelSwitch: true,
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_SEND_RATE_LIMITED' }),
    });
  });

  it('blocks when the IP hourly cap is exceeded', async () => {
    const service = track(createLimiter({ ipCap1Hour: 2 }));
    const ip = '5.6.7.8';
    for (let i = 0; i < 2; i++) {
      await service.assertCanSend({
        destination: `user${i}@example.com`,
        identifier: `email:user${i}@example.com`,
        ip,
        isChannelSwitch: false,
      });
      await service.recordSend({
        destination: `user${i}@example.com`,
        identifier: `email:user${i}@example.com`,
        ip,
        isChannelSwitch: false,
      });
    }
    await expect(
      service.assertCanSend({
        destination: 'other@example.com',
        identifier: 'email:other@example.com',
        ip,
        isChannelSwitch: false,
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_SEND_RATE_LIMITED' }),
    });
  });

  it('enforces resend cooldown and allows one channel switch', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter());
    const identifier = 'email:user@example.com|phone:+237600000001';
    const base = { identifier, ip: '1.1.1.1' as const };
    await service.assertCanSend({
      ...base,
      destination: 'user@example.com',
      isChannelSwitch: false,
    });
    await service.recordSend({
      ...base,
      destination: 'user@example.com',
      isChannelSwitch: false,
    });

    await expect(
      service.assertCanSend({
        ...base,
        destination: 'user@example.com',
        isChannelSwitch: false,
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_RESEND_COOLDOWN' }),
    });

    await service.assertCanSend({
      ...base,
      destination: '+237600000001',
      isChannelSwitch: true,
    });
    await service.recordSend({
      ...base,
      destination: '+237600000001',
      isChannelSwitch: true,
    });

    await expect(
      service.assertCanSend({
        ...base,
        destination: 'user@example.com',
        isChannelSwitch: true,
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_RESEND_COOLDOWN' }),
    });
  });

  it('blocks after the 24h identifier cap', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter({ identifierCap24H: 2 }));
    const input = {
      destination: 'user@example.com',
      identifier: 'email:user@example.com',
      ip: '3.3.3.3',
    };
    for (let i = 0; i < 2; i++) {
      await service.assertCanSend({ ...input, isChannelSwitch: false });
      await service.recordSend({ ...input, isChannelSwitch: false });
      jest.advanceTimersByTime(130_000);
    }
    await expect(
      service.assertCanSend({ ...input, isChannelSwitch: false })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OTP_SEND_RATE_LIMITED' }),
    });
  });

  it('only logs when caps are disabled', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter({ sendCapsEnabled: false }));
    const warn = jest.spyOn(service['logger'], 'warn');
    const input = {
      destination: 'user@example.com',
      identifier: 'email:user@example.com',
      ip: '1.1.1.1',
    };
    await sendThree(service, input);
    await expect(
      service.assertCanSend({ ...input, isChannelSwitch: false })
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0] || '')).not.toContain('user@example.com');
  });

  it('returns timing fields from recordSend', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter());
    const timing = await service.recordSend({
      destination: 'user@example.com',
      identifier: 'email:user@example.com',
      ip: '1.1.1.1',
      isChannelSwitch: false,
    });
    expect(timing).toEqual({
      codeExpiresAt: '2026-01-01T12:10:00.000Z',
      resendAvailableAt: '2026-01-01T12:02:00.000Z',
    });
  });

  it('sets Retry-After on enforced violations', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const service = track(createLimiter());
    const input = {
      destination: 'user@example.com',
      identifier: 'email:user@example.com',
      ip: '1.1.1.1',
    };
    await service.recordSend({ ...input, isChannelSwitch: false });
    try {
      await service.assertCanSend({ ...input, isChannelSwitch: false });
      fail('expected cooldown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.getResponse()).toMatchObject({
        code: 'OTP_RESEND_COOLDOWN',
        retryAfterSeconds: 120,
      });
    }
  });
});
