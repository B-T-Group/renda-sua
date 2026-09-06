jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { createClient } from 'redis';
import { LockoutService } from './lockout.service';

const createClientMock = createClient as jest.Mock;

function redisAbortError(): Error {
  const error = new Error();
  error.stack = [
    'Error',
    '    at AbortSignal.? (node_modules/redis/node_modules/@redis/client/lib/client/commands-queue.ts:298:13)',
  ].join('\n');
  return error;
}

function createRedisApi() {
  return {
    isReady: true,
    isOpen: true,
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
}

describe('LockoutService Redis abort handling', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const services: LockoutService[] = [];

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await Promise.all(services.splice(0).map((service) => service.onModuleDestroy()));
    jest.clearAllMocks();
  });

  async function createService(redisApi = createRedisApi()) {
    createClientMock.mockReturnValue(redisApi);
    const service = new LockoutService({
      get: jest.fn((key: string) =>
        key === 'redis' ? { host: 'localhost', port: 6379 } : undefined
      ),
    } as any);
    services.push(service);
    await Promise.resolve();
    const pendingConnect = redisApi.connect.mock.results[0]?.value;
    if (pendingConnect) await pendingConnect;
    return { service, redisApi };
  }

  it('falls back to memory in development when Redis GET aborts', async () => {
    process.env.NODE_ENV = 'development';
    const { service, redisApi } = await createService();
    redisApi.get.mockRejectedValue(redisAbortError());

    await expect(service.isLockedOut('user@example.com')).resolves.toBe(false);
    await service.recordFailure('user@example.com');
    await expect(service.isLockedOut('user@example.com')).resolves.toBe(false);
  });

  it('returns 503 in production when Redis GET aborts', async () => {
    process.env.NODE_ENV = 'production';
    const { service, redisApi } = await createService();
    redisApi.get.mockRejectedValue(redisAbortError());

    await expect(service.isLockedOut('user@example.com')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});

describe('LockoutService in-memory thresholds', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let service: LockoutService;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    service = new LockoutService({
      get: jest.fn(() => undefined),
    } as any);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await service.onModuleDestroy();
  });

  it('locks after five failures and reports remaining time', async () => {
    for (let i = 0; i < 4; i += 1) {
      await service.recordFailure(' Shop@Example.COM ');
    }
    await expect(service.isLockedOut('shop@example.com')).resolves.toBe(false);

    await service.recordFailure('shop@example.com');
    await expect(service.isLockedOut('shop@example.com')).resolves.toBe(true);
    await expect(
      service.getRemainingLockoutMs('shop@example.com')
    ).resolves.toBeGreaterThan(0);
  });

  it('clears lockout after a successful login', async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.recordFailure('shop@example.com');
    }
    await service.recordSuccess('shop@example.com');
    await expect(service.isLockedOut('shop@example.com')).resolves.toBe(false);
    await expect(
      service.getRemainingLockoutMs('shop@example.com')
    ).resolves.toBe(0);
  });
});
