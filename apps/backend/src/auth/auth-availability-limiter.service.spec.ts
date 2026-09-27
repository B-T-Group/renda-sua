import { HttpStatus } from '@nestjs/common';
import { AuthAvailabilityLimiterService } from './auth-availability-limiter.service';

function createService(): AuthAvailabilityLimiterService {
  return new AuthAvailabilityLimiterService({
    get: jest.fn().mockReturnValue(undefined),
  } as never);
}

describe('AuthAvailabilityLimiterService (in-memory)', () => {
  const services: AuthAvailabilityLimiterService[] = [];

  afterEach(async () => {
    await Promise.all(services.map((s) => s.onModuleDestroy()));
    services.length = 0;
  });

  function track(service: AuthAvailabilityLimiterService) {
    services.push(service);
    return service;
  }

  it('allows checks until the daily cap is reached', async () => {
    const service = track(createService());
    const ip = '203.0.113.10';
    for (let i = 0; i < 50; i += 1) {
      await expect(service.assertAndRecordCheck(ip)).resolves.toBeUndefined();
    }
    await expect(service.assertAndRecordCheck(ip)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: { code: 'AVAILABILITY_RATE_LIMITED' },
    });
  });

  it('tracks caps per IP independently', async () => {
    const service = track(createService());
    for (let i = 0; i < 50; i += 1) {
      await service.assertAndRecordCheck('1.1.1.1');
    }
    await expect(service.assertAndRecordCheck('2.2.2.2')).resolves.toBeUndefined();
  });

  it('drops checks older than 24 hours from the cap', async () => {
    const service = track(createService());
    const ip = '203.0.113.50';
    const stale = Date.now() - 25 * 60 * 60 * 1000;
    (service as unknown as { counters: Map<string, number[]> }).counters.set(
      `auth:availability:ip:${ip}:24h`,
      Array.from({ length: 50 }, () => stale)
    );
    await expect(service.assertAndRecordCheck(ip)).resolves.toBeUndefined();
  });

  it('shares one daily bucket for missing and blank IPs', async () => {
    const service = track(createService());
    for (let i = 0; i < 50; i += 1) {
      await service.assertAndRecordCheck(i % 2 === 0 ? '   ' : null);
    }
    await expect(service.assertAndRecordCheck('')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: { code: 'AVAILABILITY_RATE_LIMITED' },
    });
    await expect(
      service.assertAndRecordCheck('198.51.100.8')
    ).resolves.toBeUndefined();
  });
});
