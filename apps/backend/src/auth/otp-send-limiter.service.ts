import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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
import { AuthOtpConfig, Configuration } from '../config/configuration';
import {
  buildOtpIdentifier,
  hashOtpDestination,
  normalizeOtpDestination,
  OtpSendLimiterInput,
  OtpSendTiming,
  OtpSendViolation,
  pruneSendTimestamps,
} from './otp-send-limiter.util';

export { buildOtpIdentifier, normalizeOtpDestination };

interface CooldownState {
  resendAvailableAt: number;
  switchUsed: boolean;
}

const WINDOW_10M_MS = 10 * 60 * 1000;
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_1H_MS = 60 * 60 * 1000;

@Injectable()
export class OtpSendLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(OtpSendLimiterService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly counters = new Map<string, number[]>();
  private readonly cooldowns = new Map<string, CooldownState>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.initializeRedis().catch((err) =>
      this.logger.warn(
        'Redis unavailable for OTP send limiter, using in-memory store',
        err
      )
    );
    this.cleanupTimer = setInterval(() => this.cleanupInMemory(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  isEnforcementEnabled(): boolean {
    return this.authOtp().sendCapsEnabled;
  }

  async assertCanSend(input: OtpSendLimiterInput): Promise<void> {
    const violation = await this.evaluateSend(input);
    if (!violation) return;
    this.logWouldBlock(input, violation);
    if (this.isEnforcementEnabled()) this.throwViolation(violation);
  }

  async recordSend(input: OtpSendLimiterInput): Promise<OtpSendTiming> {
    const now = Date.now();
    const timing = this.buildTiming(now);
    await this.persistCounters(input, now);
    if (this.isEnforcementEnabled()) {
      await this.updateCooldown(
        input,
        now,
        this.authOtp().resendCooldownSeconds * 1000
      );
    }
    return timing;
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    await this.disconnectClient();
  }

  private authOtp(): AuthOtpConfig {
    return (
      this.configService.get('authOtp', { infer: true }) || {
        sendCapsEnabled: false,
        codeTtlSeconds: 600,
        resendCooldownSeconds: 120,
        destinationCap10Min: 3,
        destinationCap24H: 10,
        identifierCap10Min: 3,
        identifierCap24H: 10,
        ipCap1Hour: 30,
      }
    );
  }

  private buildTiming(now: number): OtpSendTiming {
    const cfg = this.authOtp();
    return {
      codeExpiresAt: new Date(now + cfg.codeTtlSeconds * 1000).toISOString(),
      resendAvailableAt: new Date(
        now + cfg.resendCooldownSeconds * 1000
      ).toISOString(),
    };
  }

  private async evaluateSend(
    input: OtpSendLimiterInput
  ): Promise<OtpSendViolation | null> {
    const now = Date.now();
    if (this.isEnforcementEnabled()) {
      const cooldownViolation = await this.evaluateCooldown(input, now);
      if (cooldownViolation) return cooldownViolation;
    }
    return this.evaluateCaps(input, now);
  }

  private async evaluateCooldown(
    input: OtpSendLimiterInput,
    now: number
  ): Promise<OtpSendViolation | null> {
    const state = await this.readCooldown(input.identifier);
    if (!state || now >= state.resendAvailableAt) return null;
    if (input.isChannelSwitch && !state.switchUsed) return null;
    return this.cooldownViolation(state.resendAvailableAt, now);
  }

  private async evaluateCaps(
    input: OtpSendLimiterInput,
    now: number
  ): Promise<OtpSendViolation | null> {
    const cfg = this.authOtp();
    const ip = this.normalizeIp(input.ip);
    const checks: Array<{ key: string; windowMs: number; limit: number }> = [
      { key: this.counterKey('dest', input.destination, '10m'), windowMs: WINDOW_10M_MS, limit: cfg.destinationCap10Min },
      { key: this.counterKey('dest', input.destination, '24h'), windowMs: WINDOW_24H_MS, limit: cfg.destinationCap24H },
      { key: this.counterKey('id', input.identifier, '10m'), windowMs: WINDOW_10M_MS, limit: cfg.identifierCap10Min },
      { key: this.counterKey('id', input.identifier, '24h'), windowMs: WINDOW_24H_MS, limit: cfg.identifierCap24H },
      { key: this.counterKey('ip', ip, '1h'), windowMs: WINDOW_1H_MS, limit: cfg.ipCap1Hour },
    ];
    for (const check of checks) {
      const count = await this.readCounterCount(check.key, check.windowMs, now);
      if (count >= check.limit) {
        return this.rateLimitViolation(check.windowMs, now);
      }
    }
    return null;
  }

  private async persistCounters(
    input: OtpSendLimiterInput,
    now: number
  ): Promise<void> {
    const ip = this.normalizeIp(input.ip);
    const keys = [
      this.counterKey('dest', input.destination, '10m'),
      this.counterKey('dest', input.destination, '24h'),
      this.counterKey('id', input.identifier, '10m'),
      this.counterKey('id', input.identifier, '24h'),
      this.counterKey('ip', ip, '1h'),
    ];
    await Promise.all(keys.map((key) => this.appendCounter(key, now)));
  }

  private async updateCooldown(
    input: OtpSendLimiterInput,
    now: number,
    cooldownMs: number
  ): Promise<void> {
    const existing = await this.readCooldown(input.identifier);
    const inCooldown = existing && now < existing.resendAvailableAt;
    const switchUsed =
      inCooldown && input.isChannelSwitch ? true : inCooldown ? existing!.switchUsed : false;
    const next: CooldownState = {
      resendAvailableAt: now + cooldownMs,
      switchUsed,
    };
    await this.writeCooldown(input.identifier, next);
  }

  private cooldownViolation(resendAvailableAtMs: number, now: number): OtpSendViolation {
    const retryAfterSeconds = Math.max(1, Math.ceil((resendAvailableAtMs - now) / 1000));
    return {
      code: 'OTP_RESEND_COOLDOWN',
      error: 'Please wait before requesting another code',
      retryAfterSeconds,
      resendAvailableAt: new Date(resendAvailableAtMs).toISOString(),
    };
  }

  private rateLimitViolation(windowMs: number, now: number): OtpSendViolation {
    const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    return {
      code: 'OTP_SEND_RATE_LIMITED',
      error: 'Too many verification codes sent. Try again later.',
      retryAfterSeconds,
      resendAvailableAt: new Date(now + windowMs).toISOString(),
    };
  }

  private throwViolation(violation: OtpSendViolation): never {
    throw new HttpException(
      { success: false, ...violation },
      HttpStatus.TOO_MANY_REQUESTS,
      {
        headers: { 'Retry-After': String(violation.retryAfterSeconds) },
      } as Record<string, unknown>
    );
  }

  private logWouldBlock(
    input: OtpSendLimiterInput,
    violation: OtpSendViolation
  ): void {
    this.logger.warn(
      `OTP send would block (${violation.code}) dest=${hashOtpDestination(input.destination)} id=${hashOtpDestination(input.identifier)} ip=${this.normalizeIp(input.ip)}`
    );
  }

  private counterKey(scope: string, value: string, window: string): string {
    return `otp:send:${scope}:${value}:${window}`;
  }

  private cooldownKey(identifier: string): string {
    return `otp:cooldown:id:${identifier}`;
  }

  private normalizeIp(ip?: string | null): string {
    const trimmed = String(ip || '').trim();
    return trimmed || 'unknown';
  }

  private async readCounterCount(
    key: string,
    windowMs: number,
    now: number
  ): Promise<number> {
    return this.withStore(
      async () => this.readCounterCountRedis(key, windowMs, now),
      () => this.readCounterCountMemory(key, windowMs, now)
    );
  }

  private async appendCounter(key: string, now: number): Promise<void> {
    await this.withStore(
      () => this.appendCounterRedis(key, now),
      () => {
        this.appendCounterMemory(key, now);
      }
    );
  }

  private async readCooldown(identifier: string): Promise<CooldownState | null> {
    return this.withStore(
      () => this.readCooldownRedis(identifier),
      () => this.cooldowns.get(identifier) || null
    );
  }

  private async writeCooldown(
    identifier: string,
    state: CooldownState
  ): Promise<void> {
    await this.withStore(
      () => this.writeCooldownRedis(identifier, state),
      () => {
        this.cooldowns.set(identifier, state);
      }
    );
  }

  private readCounterCountMemory(
    key: string,
    windowMs: number,
    now: number
  ): number {
    const list = this.counters.get(key) || [];
    const pruned = pruneSendTimestamps(list, windowMs, now);
    this.counters.set(key, pruned);
    return pruned.length;
  }

  private appendCounterMemory(key: string, now: number): void {
    const list = this.counters.get(key) || [];
    list.push(now);
    this.counters.set(key, list);
  }

  private async readCounterCountRedis(
    key: string,
    windowMs: number,
    now: number
  ): Promise<number> {
    const raw = await this.redisClient!.get(key);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    const pruned = pruneSendTimestamps(list, windowMs, now);
    if (pruned.length !== list.length) {
      await this.redisClient!.setEx(
        key,
        Math.ceil(windowMs / 1000),
        JSON.stringify(pruned)
      );
    }
    return pruned.length;
  }

  private async appendCounterRedis(key: string, now: number): Promise<void> {
    const raw = await this.redisClient!.get(key);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    list.push(now);
    await this.redisClient!.setEx(
      key,
      Math.ceil(WINDOW_24H_MS / 1000),
      JSON.stringify(list)
    );
  }

  private async readCooldownRedis(
    identifier: string
  ): Promise<CooldownState | null> {
    const raw = await this.redisClient!.get(this.cooldownKey(identifier));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CooldownState;
    } catch {
      return null;
    }
  }

  private async writeCooldownRedis(
    identifier: string,
    state: CooldownState
  ): Promise<void> {
    const cfg = this.authOtp();
    await this.redisClient!.setEx(
      this.cooldownKey(identifier),
      cfg.resendCooldownSeconds * 2,
      JSON.stringify(state)
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
      `Redis OTP limiter command failed: ${err?.message || err?.name || 'unknown'}`
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
      `Redis OTP limiter connect retry ${attempt}: ${err?.message || 'unknown'}`
    );
  }

  private assertRedisConfigured(): void {
    if (this.isProduction()) {
      throw new Error(
        'Redis is required in production for OTP send limiter. In-memory fallback is disabled in prod.'
      );
    }
    this.logger.log(
      'Redis not configured, using in-memory OTP send limiter (dev only)'
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
    this.logger.log(
      `Redis OTP send limiter connected (${redis.host}:${redis.port})`
    );
  }

  private onRedisError(
    err: any,
    redis: { host: string; port: number }
  ): void {
    const detail = `${err?.message || String(err)} (${formatRedisHostLabel(redis)})`;
    if (isRedisConnectionNoise(err)) {
      this.logger.warn(`Redis client error: ${detail}`);
      return;
    }
    this.logger.error(`Redis client error: ${detail}`);
  }

  private handleConnectFailure(error: any): void {
    if (this.isProduction()) {
      throw new Error(`Redis connection failed in production: ${error.message}`);
    }
    this.logger.warn(
      'Failed to connect to Redis for OTP send limiter, using in-memory store (dev only):',
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

  private cleanupInMemory(): void {
    const now = Date.now();
    for (const [key, list] of this.counters.entries()) {
      const pruned = pruneSendTimestamps(list, WINDOW_24H_MS, now);
      if (pruned.length) this.counters.set(key, pruned);
      else this.counters.delete(key);
    }
    for (const [key, state] of this.cooldowns.entries()) {
      if (now >= state.resendAvailableAt) this.cooldowns.delete(key);
    }
  }
}
