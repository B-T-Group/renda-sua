import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';
import {
  connectRedisWithRetry,
  createAppRedisClient,
  formatRedisHostLabel,
  isRedisConnectionNoise,
  waitForRedisReady,
} from '../common/redis-client.util';
import { redisCommandOrFallback } from '../common/redis-error.util';
import { Configuration } from '../config/configuration';
import { countInWindow, pruneSendTimestamps } from './otp-send-limiter.util';

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const DAILY_CAP_PER_IP = 50;

@Injectable()
export class AuthAvailabilityLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthAvailabilityLimiterService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly counters = new Map<string, number[]>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.initializeRedis().catch((err) =>
      this.logger.warn(
        'Redis unavailable for availability limiter, using in-memory store',
        err
      )
    );
    this.cleanupTimer = setInterval(() => this.cleanupInMemory(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async assertAndRecordCheck(ip?: string | null): Promise<void> {
    const key = this.counterKey(ip);
    const now = Date.now();
    const count = await this.readCount(key, now);
    if (count >= DAILY_CAP_PER_IP) {
      this.throwDailyCap();
    }
    await this.appendCheck(key, now);
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    await this.disconnectClient();
  }

  private throwDailyCap(): never {
    throw new HttpException(
      {
        success: false,
        error: 'Too many availability checks. Try again later.',
        code: 'AVAILABILITY_RATE_LIMITED',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private counterKey(ip?: string | null): string {
    const trimmed = String(ip || '').trim();
    return `auth:availability:ip:${trimmed || 'unknown'}:24h`;
  }

  private async readCount(key: string, now: number): Promise<number> {
    return this.withStore(
      () => this.readCountRedis(key, now),
      () => this.readCountMemory(key, now)
    );
  }

  private async appendCheck(key: string, now: number): Promise<void> {
    await this.withStore(
      () => this.appendCheckRedis(key, now),
      () => {
        this.appendCheckMemory(key, now);
      }
    );
  }

  private readCountMemory(key: string, now: number): number {
    return countInWindow(this.counters.get(key) || [], WINDOW_24H_MS, now);
  }

  private appendCheckMemory(key: string, now: number): void {
    const list = this.counters.get(key) || [];
    list.push(now);
    this.counters.set(key, list);
  }

  private async readCountRedis(key: string, now: number): Promise<number> {
    const raw = await this.redisClient!.get(key);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    return countInWindow(list, WINDOW_24H_MS, now);
  }

  private async appendCheckRedis(key: string, now: number): Promise<void> {
    const raw = await this.redisClient!.get(key);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    list.push(now);
    const pruned = pruneSendTimestamps(list, WINDOW_24H_MS, now);
    await this.redisClient!.setEx(
      key,
      Math.ceil(WINDOW_24H_MS / 1000),
      JSON.stringify(pruned)
    );
  }

  private cleanupInMemory(): void {
    const now = Date.now();
    for (const [key, list] of this.counters.entries()) {
      const pruned = pruneSendTimestamps(list, WINDOW_24H_MS, now);
      if (pruned.length === 0) this.counters.delete(key);
      else this.counters.set(key, pruned);
    }
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

  private isProduction(): boolean {
    return (process.env.NODE_ENV || 'development') === 'production';
  }

  private canUseRedis(): boolean {
    return !this.redisUnhealthy && Boolean(this.redisClient?.isReady);
  }

  private markRedisUnhealthy(error: unknown): void {
    if (!this.isProduction()) this.redisUnhealthy = true;
    const err = error as { message?: string; name?: string };
    this.logger.warn(
      `Redis availability limiter failed: ${err?.message || err?.name || 'unknown'}`
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

  private async initializeRedis() {
    const redis = this.configService.get('redis');
    if (!redis?.host) {
      if (this.isProduction()) {
        throw new Error(
          'Redis is required in production for auth availability limiter.'
        );
      }
      return;
    }
    try {
      await connectRedisWithRetry({
        connect: () => this.connectRedis(redis),
        onRetry: (attempt, error) => {
          const err = error as { message?: string };
          this.logger.warn(
            `Redis availability limiter connect retry ${attempt}: ${err?.message || 'unknown'}`
          );
        },
      });
    } catch (error: any) {
      if (this.isProduction()) {
        throw new Error(
          `Redis connection failed in production: ${error.message}`
        );
      }
      this.logger.warn(
        'Failed to connect Redis for availability limiter, using in-memory store:',
        error.message
      );
      await this.disconnectClient();
    }
  }

  private async connectRedis(redis: {
    host: string;
    port: number;
    password?: string;
  }): Promise<void> {
    await this.disconnectClient();
    this.redisClient = createAppRedisClient(redis);
    this.redisClient.on('error', (err: any) => {
      const detail = `${err?.message || String(err)} (${formatRedisHostLabel(redis)})`;
      if (isRedisConnectionNoise(err)) {
        this.logger.warn(`Redis client error: ${detail}`);
        return;
      }
      this.logger.error(`Redis client error: ${detail}`);
    });
    await this.redisClient.connect();
    this.logger.log(
      `Redis auth availability limiter connected (${redis.host}:${redis.port})`
    );
  }

  private async disconnectClient(): Promise<void> {
    if (!this.redisClient) return;
    const client = this.redisClient;
    this.redisClient = null;
    await client.quit().catch(() => undefined);
  }
}
