import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CatalogCacheService } from './catalog-cache.service';

function enableRedis(
  service: CatalogCacheService,
  redis: { get?: jest.Mock; setEx?: jest.Mock; del?: jest.Mock; incr?: jest.Mock }
) {
  const client = {
    isReady: true,
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    ...redis,
  };
  Object.assign(service as any, {
    enabled: true,
    redisUnhealthy: false,
    redisClient: client,
  });
  return client;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('CatalogCacheService', () => {
  let service: CatalogCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'catalogCache') {
                return { enabled: false };
              }
              if (key === 'redis') {
                return { host: '', port: 6379 };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CatalogCacheService>(CatalogCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when cache is disabled', () => {
    it('should return null on get', async () => {
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });

    it('should not throw on set', async () => {
      await expect(
        service.set('test-key', 'test-value', { ttlSeconds: 60 })
      ).resolves.not.toThrow();
    });

    it('should compute value when cache is disabled', async () => {
      const computeFn = jest.fn().mockResolvedValue({ data: 'test' });
      const result = await service.getOrCompute('test-key', computeFn, {
        ttlSeconds: 60,
      });

      expect(result).toEqual({ data: 'test' });
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it('should return timestamp as generation when cache is disabled', async () => {
      const gen = await service.getGeneration('test-scope');
      expect(gen).toBe(0);
    });

    it('should return timestamp when incrementing generation with cache disabled', async () => {
      const gen = await service.incrementGeneration('test-scope');
      expect(typeof gen).toBe('number');
      expect(gen).toBeGreaterThan(0);
    });
  });

  describe('getOrCompute', () => {
    it('should call compute function and return result when cache is disabled', async () => {
      const computeFn = jest.fn().mockResolvedValue({ success: true, data: [] });
      const result = await service.getOrCompute('test-key', computeFn, {
        ttlSeconds: 60,
      });

      expect(result).toEqual({ success: true, data: [] });
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it('should handle compute function errors', async () => {
      const computeFn = jest.fn().mockRejectedValue(new Error('Compute failed'));
      await expect(
        service.getOrCompute('test-key', computeFn, { ttlSeconds: 60 })
      ).rejects.toThrow('Compute failed');
    });

    it('returns a parsed cache hit without recomputing', async () => {
      const redis = enableRedis(service, {
        get: jest.fn().mockResolvedValue(JSON.stringify({ cached: true })),
      });
      const computeFn = jest.fn();

      await expect(
        service.getOrCompute('items:1', computeFn, { ttlSeconds: 60 })
      ).resolves.toEqual({ cached: true });
      expect(computeFn).not.toHaveBeenCalled();
      expect(redis.get).toHaveBeenCalledWith('catalog:items:1');
    });

    it('recomputes when cached JSON is corrupt', async () => {
      const redis = enableRedis(service, {
        get: jest.fn().mockResolvedValue('{not-json'),
        setEx: jest.fn().mockResolvedValue('OK'),
      });
      const computeFn = jest.fn().mockResolvedValue({ fresh: true });

      await expect(
        service.getOrCompute('items:1', computeFn, { ttlSeconds: 45 })
      ).resolves.toEqual({ fresh: true });
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(redis.setEx).toHaveBeenCalledWith(
        'catalog:items:1',
        45,
        JSON.stringify({ fresh: true })
      );
    });

    it('coalesces concurrent misses onto a single compute', async () => {
      enableRedis(service, {
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue('OK'),
      });
      let resolveCompute: (value: { id: string }) => void = () => undefined;
      const computeFn = jest.fn(
        () =>
          new Promise<{ id: string }>((resolve) => {
            resolveCompute = resolve;
          })
      );

      const first = service.getOrCompute('items:1', computeFn, { ttlSeconds: 60 });
      await flushMicrotasks();
      const second = service.getOrCompute('items:1', computeFn, {
        ttlSeconds: 60,
      });
      resolveCompute({ id: 'shared' });

      await expect(Promise.all([first, second])).resolves.toEqual([
        { id: 'shared' },
        { id: 'shared' },
      ]);
      expect(computeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('generation management', () => {
    it('should return 0 for getGeneration when cache is disabled', async () => {
      const gen = await service.getGeneration('global');
      expect(gen).toBe(0);
    });

    it('should return timestamp for incrementGeneration when cache is disabled', async () => {
      const gen = await service.incrementGeneration('global');
      expect(typeof gen).toBe('number');
      expect(gen).toBeGreaterThan(Date.now() - 1000);
    });
  });
});
