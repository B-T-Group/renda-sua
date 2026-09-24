import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';
import { Configuration } from '../config/configuration';
import {
  connectRedisWithRetry,
  createAppRedisClient,
  formatRedisHostLabel,
  isRedisConnectionNoise,
  waitForRedisReady,
} from '../common/redis-client.util';
import { redisCommandOrFallback } from '../common/redis-error.util';
import type { OtpChannel } from './otp-channel.util';

export interface LoginFlowV2Record {
  userId: string;
  channel: OtpChannel;
  email: string;
  phone: string;
}

const FLOW_KEY_PREFIX = 'auth:flow:v2:';
export const AUTH_FLOW_V2_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthFlowV2StoreService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthFlowV2StoreService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly inMemory = new Map<
    string,
    { json: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.initializeRedis().catch((err) =>
      this.logger.warn('Redis unavailable for auth flow v2 store', err)
    );
    const timer = setInterval(() => this.pruneMemory(), 60_000);
    timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient?.quit().catch(() => undefined);
  }

  async save(
    flowId: string,
    record: LoginFlowV2Record,
    ttlSec = AUTH_FLOW_V2_TTL_SECONDS
  ): Promise<void> {
    const json = JSON.stringify(record);
    const key = FLOW_KEY_PREFIX + flowId;
    await this.withStore(
      async () => {
        await this.redisClient!.setEx(key, ttlSec, json);
      },
      () => {
        this.inMemory.set(key, {
          json,
          expiresAt: Date.now() + ttlSec * 1000,
        });
      }
    );
  }

  async get(flowId: string): Promise<LoginFlowV2Record | null> {
    const key = FLOW_KEY_PREFIX + flowId;
    const json = await this.withStore(
      async () => {
        const raw = await this.redisClient!.get(key);
        return raw ?? null;
      },
      () => {
        const entry = this.inMemory.get(key);
        if (!entry || entry.expiresAt <= Date.now()) {
          this.inMemory.delete(key);
          return null;
        }
        return entry.json;
      }
    );
    if (!json) return null;
    try {
      return JSON.parse(json) as LoginFlowV2Record;
    } catch {
      return null;
    }
  }

  async delete(flowId: string): Promise<void> {
    const key = FLOW_KEY_PREFIX + flowId;
    await this.withStore(
      async () => {
        await this.redisClient!.del(key);
      },
      () => {
        this.inMemory.delete(key);
      }
    );
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemory) {
      if (entry.expiresAt <= now) this.inMemory.delete(key);
    }
  }

  private isProduction(): boolean {
    return (process.env.NODE_ENV || 'development') === 'production';
  }

  private canUseRedis(): boolean {
    return !this.redisUnhealthy && Boolean(this.redisClient?.isReady);
  }

  private markRedisUnhealthy(error: unknown): void {
    if (!this.isProduction()) this.redisUnhealthy = true;
    const err = error as { message?: string };
    this.logger.warn(`Auth flow v2 Redis failed: ${err?.message || 'unknown'}`);
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
      subscribe: (onReady) => {
        this.redisClient!.on('ready', onReady);
        return () => this.redisClient!.off('ready', onReady);
      },
    });
  }

  private async initializeRedis(): Promise<void> {
    const redis = this.configService.get('redis');
    if (!redis?.host) return;
    try {
      await connectRedisWithRetry({
        connect: () => this.connectRedis(redis),
        onRetry: (attempt, error) => {
          const err = error as { message?: string };
          this.logger.warn(
            `Auth flow v2 Redis retry ${attempt}: ${err?.message || 'unknown'}`
          );
        },
      });
    } catch (error: any) {
      this.logger.warn(
        `Auth flow v2 Redis unavailable: ${error?.message || error}`
      );
    }
  }

  private async connectRedis(redis: {
    host: string;
    port: number;
    password?: string;
  }): Promise<void> {
    this.redisClient = createAppRedisClient(redis);
    this.redisClient.on('error', (err: any) => {
      if (!isRedisConnectionNoise(err)) {
        this.logger.warn(`Auth flow v2 Redis error: ${err?.message}`);
      }
    });
    await this.redisClient.connect();
    this.logger.log(
      `Auth flow v2 store connected (${formatRedisHostLabel(redis)})`
    );
  }
}
