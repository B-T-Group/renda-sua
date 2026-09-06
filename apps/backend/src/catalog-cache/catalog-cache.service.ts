import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';
import {
  connectRedisWithRetry,
  createAppRedisClient,
  waitForRedisReady,
} from '../common/redis-client.util';
import { redisCommandOrFallback } from '../common/redis-error.util';
import type { Configuration } from '../config/configuration';

export interface CatalogCacheOptions {
  ttlSeconds: number;
  compress?: boolean;
}

@Injectable()
export class CatalogCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogCacheService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly enabled: boolean;
  private readonly pendingRequests = new Map<string, Promise<string | null>>();

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.enabled = this.configService.get('catalogCache')?.enabled ?? false;
    if (this.enabled) {
      this.initializeRedis().catch((err) =>
        this.logger.warn('Redis unavailable, catalog cache disabled', err)
      );
    } else {
      this.logger.log('Catalog cache disabled by CATALOG_REDIS_CACHE_ENABLED flag');
    }
  }

  private async initializeRedis(): Promise<void> {
    const redis = this.configService.get('redis');
    if (!redis?.host) {
      this.logger.warn('Redis not configured, catalog cache disabled');
      return;
    }
    await this.connectWithRetry(redis);
  }

  private async connectWithRetry(redis: {
    host: string;
    port: number;
    password?: string;
  }): Promise<void> {
    try {
      await connectRedisWithRetry({
        connect: () => this.connectRedis(redis),
        onRetry: (attempt, error) => this.logConnectRetry(attempt, error),
      });
    } catch (error: any) {
      this.logger.warn('Failed to connect to Redis for catalog cache:', error.message);
    }
  }

  private logConnectRetry(attempt: number, error: unknown): void {
    const err = error as { message?: string };
    this.logger.warn(
      `Redis catalog cache connect retry ${attempt}: ${err?.message || 'unknown'}`
    );
  }

  private async connectRedis(redis: {
    host: string;
    port: number;
    password?: string;
  }): Promise<void> {
    await this.disconnectClient();
    this.redisClient = createAppRedisClient(redis);
    this.redisClient.on('error', (err: any) => this.onRedisError(err, redis));
    await this.redisClient.connect();
    this.logger.log(`Redis catalog cache connected (${redis.host}:${redis.port})`);
  }

  private onRedisError(err: any, redis: { host: string; port: number }): void {
    this.logger.error(
      `Redis catalog cache error: ${err?.message || String(err)} (host=${redis.host}:${redis.port})`
    );
  }

  private async disconnectClient(): Promise<void> {
    if (!this.redisClient) return;
    const client = this.redisClient;
    this.redisClient = null;
    await client.quit().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnectClient();
  }

  private canUseRedis(): boolean {
    return this.enabled && !this.redisUnhealthy && Boolean(this.redisClient?.isReady);
  }

  private markRedisUnhealthy(error: unknown): void {
    this.redisUnhealthy = true;
    const err = error as { message?: string; name?: string };
    this.logger.warn(
      `Redis catalog cache command failed: ${err?.message || err?.name || 'unknown'}`
    );
  }

  private waitUntilReady(): Promise<boolean> {
    if (!this.redisClient) return Promise.resolve(false);
    return waitForRedisReady({
      isReady: () => this.canUseRedis(),
      subscribe: (onReady) => this.subscribeReady(onReady),
    });
  }

  private subscribeReady(onReady: () => void): () => void {
    const client = this.redisClient;
    if (!client) return () => undefined;
    client.on('ready', onReady);
    return () => client.off('ready', onReady);
  }

  async get(key: string): Promise<string | null> {
    if (!this.canUseRedis()) {
      return null;
    }

    try {
      const value = await redisCommandOrFallback({
        canUseRedis: this.canUseRedis(),
        failClosed: false,
        redisOp: () => this.redisClient!.get(`catalog:${key}`),
        fallbackOp: () => null,
        onError: (error) => this.markRedisUnhealthy(error),
        waitForReady: () => this.waitUntilReady(),
      });
      return value;
    } catch (error: any) {
      this.logger.error(`Cache get failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, options: CatalogCacheOptions): Promise<void> {
    if (!this.canUseRedis()) {
      return;
    }

    try {
      await redisCommandOrFallback({
        canUseRedis: this.canUseRedis(),
        failClosed: false,
        redisOp: () =>
          this.redisClient!.setEx(`catalog:${key}`, options.ttlSeconds, value),
        fallbackOp: () => undefined,
        onError: (error) => this.markRedisUnhealthy(error),
        waitForReady: () => this.waitUntilReady(),
      });
    } catch (error: any) {
      this.logger.error(`Cache set failed for key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.canUseRedis()) {
      return;
    }

    try {
      await redisCommandOrFallback({
        canUseRedis: this.canUseRedis(),
        failClosed: false,
        redisOp: () => this.redisClient!.del(`catalog:${key}`),
        fallbackOp: () => undefined,
        onError: (error) => this.markRedisUnhealthy(error),
        waitForReady: () => this.waitUntilReady(),
      });
    } catch (error: any) {
      this.logger.error(`Cache delete failed for key ${key}: ${error.message}`);
    }
  }

  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    options: CatalogCacheOptions
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T;
      } catch (error: any) {
        this.logger.warn(`Failed to parse cached value for ${key}: ${error.message}`);
      }
    }

    const pending = this.pendingRequests.get(key);
    if (pending) {
      try {
        const result = await pending;
        if (result !== null) {
          return JSON.parse(result) as T;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to parse pending result for ${key}: ${error.message}`);
      }
    }

    const computePromise = (async () => {
      try {
        const result = await compute();
        const serialized = JSON.stringify(result);
        await this.set(key, serialized, options);
        return serialized;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, computePromise);
    const result = await computePromise;
    return JSON.parse(result) as T;
  }

  async incrementGeneration(scope: string): Promise<number> {
    if (!this.canUseRedis()) {
      return Date.now();
    }

    try {
      const newGen = await redisCommandOrFallback({
        canUseRedis: this.canUseRedis(),
        failClosed: false,
        redisOp: () => this.redisClient!.incr(`catalog:gen:${scope}`),
        fallbackOp: () => Date.now(),
        onError: (error) => this.markRedisUnhealthy(error),
        waitForReady: () => this.waitUntilReady(),
      });
      return newGen;
    } catch (error: any) {
      this.logger.error(
        `Failed to increment generation for ${scope}: ${error.message}`
      );
      return Date.now();
    }
  }

  async getGeneration(scope: string): Promise<number> {
    if (!this.canUseRedis()) {
      return 0;
    }

    try {
      const gen = await redisCommandOrFallback({
        canUseRedis: this.canUseRedis(),
        failClosed: false,
        redisOp: async () => {
          const value = await this.redisClient!.get(`catalog:gen:${scope}`);
          return value ? parseInt(value, 10) : 0;
        },
        fallbackOp: () => 0,
        onError: (error) => this.markRedisUnhealthy(error),
        waitForReady: () => this.waitUntilReady(),
      });
      return gen;
    } catch (error: any) {
      this.logger.error(`Failed to get generation for ${scope}: ${error.message}`);
      return 0;
    }
  }
}
