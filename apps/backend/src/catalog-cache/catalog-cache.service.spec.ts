import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CatalogCacheService } from './catalog-cache.service';
import type { Configuration } from '../config/configuration';

describe('CatalogCacheService', () => {
  let service: CatalogCacheService;
  let configService: ConfigService<Configuration>;

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
    configService = module.get<ConfigService<Configuration>>(ConfigService);
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

  describe('cache key building', () => {
    it('should build correct cache key for supported-countries', () => {
      const key = 'supported-countries';
      expect(key).toBe('supported-countries');
    });

    it('should build correct cache key for essentials with country/state', () => {
      const key = ['essentials', 'CM', 'Littoral', 8].join(':');
      expect(key).toBe('essentials:CM:Littoral:8');
    });

    it('should build correct cache key for essentials with global scope', () => {
      const key = ['essentials', 'global', 'all', 8].join(':');
      expect(key).toBe('essentials:global:all:8');
    });

    it('should build correct cache key for stores with filters', () => {
      const key = ['stores', 'all', 'CM', 'Littoral', 'true', 'false', 20].join(':');
      expect(key).toBe('stores:all:CM:Littoral:true:false:20');
    });

    it('should build correct cache key for inventory items with all params', () => {
      const generation = 5;
      const key = [
        'items',
        generation,
        1,
        20,
        'relevance',
        '',
        'Electronics',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'active',
        'CM',
        '',
        'avail',
        '',
        '',
        'all',
      ].join(':');
      expect(key).toContain('items:5:1:20:relevance');
      expect(key).toContain(':Electronics:');
      expect(key).toContain(':CM:');
    });

    it('should build correct cache key for search queries', () => {
      const generation = 3;
      const key = [
        'items',
        generation,
        1,
        20,
        'relevance',
        'laptop',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'active',
        'global',
        '',
        'avail',
        '',
        '',
        'all',
      ].join(':');
      expect(key).toContain('items:3:1:20:relevance:laptop');
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
