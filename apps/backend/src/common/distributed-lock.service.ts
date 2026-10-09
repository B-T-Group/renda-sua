import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { RedisClientType } from 'redis';
import type { Configuration } from '../config/configuration';
import {
  createAppRedisClient,
  isRedisConnectionNoise,
  sleepMs,
} from './redis-client.util';

const RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
const POLL_MS = 50;
/** After a failed connect, don't redial (and stall callers) for this long. */
const CONNECT_BACKOFF_MS = 30_000;

/**
 * Small mutex: `SET key token NX PX ttl` on Redis (shared by every backend instance),
 * with an in-process fallback when Redis is not configured or unreachable (dev, or a
 * Redis blip). The fallback only guards a single instance; callers that need strict
 * cross-instance exclusion pass `requireShared: true` and skip when Redis is down.
 */
@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private client: RedisClientType | null = null;
  private connecting: Promise<void> | null = null;
  private lastConnectFailureAt = 0;
  private readonly local = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly configService: ConfigService<Configuration>) {}

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    await client?.quit().catch(() => undefined);
  }

  /** Returns a release function, or null when someone else holds the lock. */
  async tryAcquire(
    key: string,
    ttlMs: number,
    options: { requireShared?: boolean } = {}
  ): Promise<(() => Promise<void>) | null> {
    const token = randomUUID();
    const redis = await this.redis();
    if (redis) {
      try {
        const ok = await redis.set(`lock:${key}`, token, { NX: true, PX: ttlMs });
        if (ok !== 'OK') return null;
        return () => this.releaseRedis(redis, key, token);
      } catch (error) {
        this.warn(error);
      }
    }
    if (options.requireShared) {
      this.logger.warn(`lock ${key}: shared lock unavailable (Redis down), skipping`);
      return null;
    }
    return this.acquireLocal(key, token, ttlMs);
  }

  /** Waits up to `waitMs` for the lock, then gives up (returns null). */
  async acquire(
    key: string,
    ttlMs: number,
    waitMs: number
  ): Promise<(() => Promise<void>) | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      const release = await this.tryAcquire(key, ttlMs);
      if (release) return release;
      if (Date.now() >= deadline) return null;
      await sleepMs(POLL_MS);
    }
  }

  private acquireLocal(
    key: string,
    token: string,
    ttlMs: number
  ): (() => Promise<void>) | null {
    const now = Date.now();
    const held = this.local.get(key);
    if (held && held.expiresAt > now) return null;
    this.local.set(key, { token, expiresAt: now + ttlMs });
    return async () => {
      if (this.local.get(key)?.token === token) this.local.delete(key);
    };
  }

  private async releaseRedis(
    redis: RedisClientType,
    key: string,
    token: string
  ): Promise<void> {
    try {
      await redis.eval(RELEASE_SCRIPT, { keys: [`lock:${key}`], arguments: [token] });
    } catch (error) {
      this.warn(error);
    }
  }

  private async redis(): Promise<RedisClientType | null> {
    if (this.client?.isReady) return this.client;
    const config = this.configService.get('redis', { infer: true });
    if (!config?.host) return null;
    const backingOff = Date.now() - this.lastConnectFailureAt < CONNECT_BACKOFF_MS;
    if (!this.client && !backingOff) {
      this.connecting ??= this.connect(config).finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting?.catch(() => undefined);
    return this.client?.isReady ? this.client : null;
  }

  private async connect(config: {
    host: string;
    port: number;
    password?: string;
  }): Promise<void> {
    const client = createAppRedisClient(config);
    client.on('error', (error) => this.warn(error));
    try {
      await client.connect();
      this.client = client;
    } catch (error) {
      await client.quit().catch(() => undefined);
      this.lastConnectFailureAt = Date.now();
      this.warn(error);
    }
  }

  private warn(error: unknown): void {
    const message = (error as { message?: string })?.message ?? String(error);
    if (isRedisConnectionNoise(error)) {
      this.logger.warn(`lock redis: ${message}`);
      return;
    }
    this.logger.error(`lock redis: ${message}`);
  }
}
