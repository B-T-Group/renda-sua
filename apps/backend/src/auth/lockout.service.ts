import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';
import { Configuration } from '../config/configuration';
import {
  connectRedisWithRetry,
  createAppRedisClient,
  waitForRedisReady,
} from '../common/redis-client.util';
import { redisCommandOrFallback } from '../common/redis-error.util';

interface LockoutEntry {
  attempts: number;
  lockedUntil?: number;
}

/**
 * Login attempt tracking and lockout service.
 * Uses Redis in production for multi-pod consistency.
 * Falls back to in-memory for local/development only.
 */
@Injectable()
export class LockoutService implements OnModuleDestroy {
  private readonly logger = new Logger(LockoutService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly inMemoryStore = new Map<string, LockoutEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly LOCKOUT_TTL_SECONDS = Math.ceil(this.ATTEMPT_WINDOW_MS / 1000);

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.initializeRedis().catch((err) =>
      this.logger.warn('Redis unavailable for lockout service, using in-memory store', err)
    );
    this.cleanupTimer = setInterval(() => this.cleanupInMemory(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  private isProduction(): boolean {
    return (process.env.NODE_ENV || 'development') === 'production';
  }

  isStoreReady(): boolean {
    return this.canUseRedis();
  }

  private canUseRedis(): boolean {
    return !this.redisUnhealthy && Boolean(this.redisClient?.isReady);
  }

  private markRedisUnhealthy(error: unknown): void {
    if (!this.isProduction()) this.redisUnhealthy = true;
    const err = error as { message?: string; name?: string };
    this.logger.warn(
      `Redis lockout command failed: ${err?.message || err?.name || 'unknown'}`
    );
  }

  private withStore<T>(
    redisOp: () => Promise<T>,
    fallbackOp: () => T | Promise<T>
  ): Promise<T> {
    return redisCommandOrFallback({
      canUseRedis: this.canUseRedis(),
      failClosed: this.isProduction(),
      redisOp,
      fallbackOp,
      onError: (error) => this.markRedisUnhealthy(error),
      waitForReady: () => this.waitUntilReady(),
    });
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

  private async initializeRedis() {
    const redis = this.configService.get('redis');
    if (!redis?.host) {
      this.assertRedisConfigured();
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
      this.handleConnectFailure(error);
    }
  }

  private logConnectRetry(attempt: number, error: unknown): void {
    const err = error as { message?: string };
    this.logger.warn(
      `Redis lockout connect retry ${attempt}: ${err?.message || 'unknown'}`
    );
  }

  private assertRedisConfigured(): void {
    if (this.isProduction()) {
      throw new Error(
        'Redis is required in production for lockout service. In-memory fallback is disabled in prod.'
      );
    }
    this.logger.log('Redis not configured, using in-memory lockout store (dev only)');
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
    this.logger.log(`Redis lockout service connected (${redis.host}:${redis.port})`);
  }

  private onRedisError(
    err: any,
    redis: { host: string; port: number }
  ): void {
    this.logger.error(
      `Redis client error: ${err?.message || String(err)} (host=${redis.host}:${redis.port})`
    );
  }

  private handleConnectFailure(error: any): void {
    if (this.isProduction()) {
      throw new Error(`Redis connection failed in production: ${error.message}`);
    }
    this.logger.warn(
      'Failed to connect to Redis for lockout service, using in-memory store (dev only):',
      error.message
    );
    void this.disconnectClient();
  }

  private async disconnectClient(): Promise<void> {
    if (!this.redisClient) return;
    const client = this.redisClient;
    this.redisClient = null;
    await client.quit().catch(() => undefined);
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    await this.disconnectClient();
  }

  async isLockedOut(identifier: string): Promise<boolean> {
    const key = this.normalizeKey(identifier);
    return this.withStore(
      () => this.lockedOutFromRedis(key),
      () => this.lockedOutFromMemory(key)
    );
  }

  private async lockedOutFromRedis(key: string): Promise<boolean> {
    const data = await this.redisClient!.get(`lockout:${key}`);
    if (!data) return false;
    return this.entryIsLocked(this.parseEntry(data), async () => {
      await this.redisClient!.del(`lockout:${key}`);
    });
  }

  private lockedOutFromMemory(key: string): boolean {
    const entry = this.inMemoryStore.get(key);
    if (!entry) return false;
    return this.entryIsLocked(entry, () => {
      this.inMemoryStore.delete(key);
    });
  }

  private entryIsLocked(
    entry: LockoutEntry | null,
    onExpired: () => void | Promise<void>
  ): boolean {
    if (!entry?.lockedUntil) return false;
    if (Date.now() < entry.lockedUntil) return true;
    void onExpired();
    return false;
  }

  private parseEntry(data: string): LockoutEntry | null {
    try {
      return JSON.parse(data) as LockoutEntry;
    } catch {
      return null;
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.normalizeKey(identifier);
    await this.withStore(
      () => this.recordFailureRedis(key),
      () => this.recordFailureMemory(key)
    );
  }

  private async recordFailureRedis(key: string): Promise<void> {
    const data = await this.redisClient!.get(`lockout:${key}`);
    const existing = data ? this.parseEntry(data) : null;
    const entry = this.incrementAttempts(existing || { attempts: 0 });
    await this.redisClient!.setEx(
      `lockout:${key}`,
      this.LOCKOUT_TTL_SECONDS,
      JSON.stringify(entry)
    );
  }

  private recordFailureMemory(key: string): void {
    const entry = this.incrementAttempts(
      this.inMemoryStore.get(key) || { attempts: 0 }
    );
    this.inMemoryStore.set(key, entry);
    const expireTimer = setTimeout(
      () => this.expireMemoryIfUnlocked(key),
      this.ATTEMPT_WINDOW_MS
    );
    expireTimer.unref();
  }

  private incrementAttempts(entry: LockoutEntry): LockoutEntry {
    entry.attempts += 1;
    if (entry.attempts >= this.MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + this.LOCKOUT_DURATION_MS;
      this.logger.warn(`Identifier locked out after ${entry.attempts} attempts`);
    }
    return entry;
  }

  private expireMemoryIfUnlocked(key: string): void {
    const current = this.inMemoryStore.get(key);
    if (current && !current.lockedUntil) this.inMemoryStore.delete(key);
  }

  async recordSuccess(identifier: string): Promise<void> {
    const key = this.normalizeKey(identifier);
    await this.withStore(
      async () => {
        await this.redisClient!.del(`lockout:${key}`);
      },
      () => {
        this.inMemoryStore.delete(key);
      }
    );
  }

  async getRemainingLockoutMs(identifier: string): Promise<number> {
    const key = this.normalizeKey(identifier);
    return this.withStore(
      () => this.remainingMsFromRedis(key),
      () => this.remainingMsFromMemory(key)
    );
  }

  private async remainingMsFromRedis(key: string): Promise<number> {
    const data = await this.redisClient!.get(`lockout:${key}`);
    return data ? this.remainingMs(this.parseEntry(data)) : 0;
  }

  private remainingMsFromMemory(key: string): number {
    return this.remainingMs(this.inMemoryStore.get(key) || null);
  }

  private remainingMs(entry: LockoutEntry | null): number {
    if (!entry?.lockedUntil) return 0;
    return Math.max(0, entry.lockedUntil - Date.now());
  }

  private normalizeKey(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private cleanupInMemory(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.inMemoryStore.entries()) {
      if (entry.lockedUntil && entry.lockedUntil < now) {
        this.inMemoryStore.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired in-memory lockout entries`);
    }
  }
}
