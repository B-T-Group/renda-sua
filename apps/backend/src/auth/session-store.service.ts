import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Configuration } from '../config/configuration';
import {
  connectRedisWithRetry,
  createAppRedisClient,
  sleepMs,
  waitForRedisReady,
} from '../common/redis-client.util';
import { redisCommandOrFallback } from '../common/redis-error.util';

export interface SessionData {
  userId: string;
  auth0RefreshToken: string;
  auth0AccessToken?: string;
  auth0IdToken?: string;
  createdAt: number;
  lastRefreshedAt: number;
  userAgent?: string;
  ipAddress?: string;
  familyId?: string;
  retired?: boolean;
  retiredAt?: number;
  rotatedTo?: string;
}

const ROTATION_GRACE_MS = 15_000;

function isRecentRotation(data: SessionData): boolean {
  if (!data.rotatedTo || !data.retiredAt) return false;
  return Date.now() - data.retiredAt < ROTATION_GRACE_MS;
}

@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStoreService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly inMemoryStore = new Map<string, string>();
  private readonly rotationLocks = new Map<string, Promise<string | null>>();
  private readonly refreshLocks = new Map<string, Promise<unknown>>();
  private readonly memoryRefreshLocks = new Map<string, number>();
  private readonly encryptionKey: Buffer;
  private readonly SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
  private readonly REFRESH_LOCK_TTL_SEC = 20;
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService<Configuration>) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
    
    if (nodeEnv === 'production') {
      // In production, SESSION_ENCRYPTION_KEY is required and must be exactly 32 bytes
      if (!encryptionKey) {
        throw new Error(
          'SESSION_ENCRYPTION_KEY is required in production. Generate a 32-byte key and add it to Secrets Manager.'
        );
      }
      if (encryptionKey.length !== 32) {
        throw new Error(
          `SESSION_ENCRYPTION_KEY must be exactly 32 bytes in production (got ${encryptionKey.length}). Generate with: openssl rand -base64 32`
        );
      }
      this.encryptionKey = Buffer.from(encryptionKey);
    } else {
      // In development, fall back to JWT_SECRET or pad if needed
      const key = encryptionKey || process.env.JWT_SECRET;
      if (!key) {
        throw new Error('SESSION_ENCRYPTION_KEY or JWT_SECRET required for session encryption');
      }
      this.encryptionKey = Buffer.from(key.padEnd(32, '0').slice(0, 32));
    }
    
    this.initializeRedis().catch((err) =>
      this.logger.warn('Redis unavailable, using in-memory session store', err)
    );
  }

  private async initializeRedis() {
    const redis = this.configService.get('redis');
    if (!redis?.host) {
      this.assertRedisConfigured();
      return;
    }
    await this.connectWithRetry(redis);
  }

  private assertRedisConfigured(): void {
    if (this.isProduction()) {
      throw new Error(
        'Redis is required in production for session storage. In-memory fallback is disabled in prod.'
      );
    }
    this.logger.log('Redis not configured, using in-memory store (dev only)');
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
      `Redis session connect retry ${attempt}: ${err?.message || 'unknown'}`
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
    this.logger.log(`Redis session store connected (${redis.host}:${redis.port})`);
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
      'Failed to connect to Redis, using in-memory store (dev only):',
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
    await this.disconnectClient();
  }

  generateSessionId(): string {
    return randomBytes(32).toString('base64url');
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
      `Redis session command failed: ${err?.message || err?.name || 'unknown'}`
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

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  private decrypt(encrypted: string): string {
    const [ivB64, authTagB64, ciphertext] = encrypted.split(':');
    if (!ivB64 || !authTagB64 || !ciphertext) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async createSession(
    sessionId: string,
    data: SessionData
  ): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(data));
    const familyId = data.familyId || sessionId;
    await this.withStore(
      () => this.writeRedisSession(sessionId, familyId, encrypted),
      () => this.writeMemorySession(sessionId, encrypted)
    );
  }

  private async writeRedisSession(
    sessionId: string,
    familyId: string,
    encrypted: string
  ): Promise<void> {
    await this.redisClient!.setEx(
      `session:${sessionId}`,
      this.SESSION_TTL_SECONDS,
      encrypted
    );
    await this.redisClient!.sAdd(`session-family:${familyId}`, sessionId);
    await this.redisClient!.expire(
      `session-family:${familyId}`,
      this.SESSION_TTL_SECONDS
    );
  }

  private writeMemorySession(sessionId: string, encrypted: string): void {
    this.inMemoryStore.set(sessionId, encrypted);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const encrypted = await this.withStore(
      () => this.redisClient!.get(`session:${sessionId}`),
      () => this.inMemoryStore.get(sessionId) || null
    );

    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error: any) {
      this.logger.error('Session decryption failed:', error);
      await this.deleteSession(sessionId);
      return null;
    }
  }

  async updateSession(
    sessionId: string,
    data: Partial<SessionData>
  ): Promise<boolean> {
    const existing = await this.getSession(sessionId);
    if (!existing) return false;

    const updated: SessionData = { ...existing, ...data };
    await this.createSession(sessionId, updated);
    return true;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.withStore(
      () => this.deleteRedisSession(sessionId),
      () => {
        this.inMemoryStore.delete(sessionId);
      }
    );
  }

  /** Deletes a Redis session without calling getSession (avoids decrypt-fail recursion). */
  private async deleteRedisSession(sessionId: string): Promise<void> {
    const encrypted = await this.redisClient!.get(`session:${sessionId}`);
    await this.redisClient!.del(`session:${sessionId}`);
    if (!encrypted) return;
    try {
      const data = JSON.parse(this.decrypt(encrypted)) as SessionData;
      const familyId = data.familyId || sessionId;
      await this.redisClient!.sRem(`session-family:${familyId}`, sessionId);
    } catch {
      // Key is already gone; skip family cleanup for unreadable payloads.
    }
  }

  async resolveLiveSession(
    sessionId: string
  ): Promise<{ id: string; data: SessionData } | null> {
    const data = await this.getSession(sessionId);
    if (!data) return null;
    if (!data.retired) return { id: sessionId, data };
    return this.followRecentRotation(data);
  }

  private async followRecentRotation(
    data: SessionData
  ): Promise<{ id: string; data: SessionData } | null> {
    if (!isRecentRotation(data) || !data.rotatedTo) return null;
    const successor = await this.getSession(data.rotatedTo);
    if (!successor || successor.retired) return null;
    return { id: data.rotatedTo, data: successor };
  }

  async runExclusiveRefresh<T>(
    lockKey: string,
    work: () => Promise<T>
  ): Promise<T> {
    const existing = this.refreshLocks.get(lockKey);
    if (existing) return existing as Promise<T>;
    const run = this.executeRefreshWithLock(lockKey, work);
    this.refreshLocks.set(lockKey, run);
    void run.finally(() => this.refreshLocks.delete(lockKey));
    return run;
  }

  private async executeRefreshWithLock<T>(
    lockKey: string,
    work: () => Promise<T>
  ): Promise<T> {
    if (await this.acquireRefreshLock(lockKey)) {
      try {
        return await work();
      } finally {
        await this.releaseRefreshLock(lockKey);
      }
    }
    await this.waitForRefreshLock(lockKey);
    return work();
  }

  private refreshLockRedisKey(lockKey: string): string {
    return `session-refresh-lock:${lockKey}`;
  }

  private async acquireRefreshLock(lockKey: string): Promise<boolean> {
    return this.withStore(
      () => this.acquireRedisRefreshLock(lockKey),
      () => this.acquireMemoryRefreshLock(lockKey)
    );
  }

  private async acquireRedisRefreshLock(lockKey: string): Promise<boolean> {
    const result = await this.redisClient!.set(
      this.refreshLockRedisKey(lockKey),
      '1',
      { NX: true, EX: this.REFRESH_LOCK_TTL_SEC }
    );
    return result === 'OK';
  }

  private acquireMemoryRefreshLock(lockKey: string): boolean {
    this.expireMemoryRefreshLock(lockKey);
    if (this.memoryRefreshLocks.has(lockKey)) return false;
    this.memoryRefreshLocks.set(
      lockKey,
      Date.now() + this.REFRESH_LOCK_TTL_SEC * 1000
    );
    return true;
  }

  private expireMemoryRefreshLock(lockKey: string): void {
    const expiresAt = this.memoryRefreshLocks.get(lockKey);
    if (expiresAt && expiresAt <= Date.now()) {
      this.memoryRefreshLocks.delete(lockKey);
    }
  }

  private async releaseRefreshLock(lockKey: string): Promise<void> {
    await this.withStore(
      () => this.redisClient!.del(this.refreshLockRedisKey(lockKey)),
      () => {
        this.memoryRefreshLocks.delete(lockKey);
        return 1;
      }
    );
  }

  private async waitForRefreshLock(lockKey: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (!(await this.isRefreshLockHeld(lockKey))) return;
      await sleepMs(150);
    }
  }

  private async isRefreshLockHeld(lockKey: string): Promise<boolean> {
    return this.withStore(
      async () =>
        (await this.redisClient!.exists(this.refreshLockRedisKey(lockKey))) === 1,
      () => {
        this.expireMemoryRefreshLock(lockKey);
        return this.memoryRefreshLocks.has(lockKey);
      }
    );
  }

  async rotateSession(oldSessionId: string): Promise<string | null> {
    const inflight = this.rotationLocks.get(oldSessionId);
    if (inflight) return inflight;
    const run = this.rotateUnlocked(oldSessionId);
    this.rotationLocks.set(oldSessionId, run);
    void run.finally(() => this.rotationLocks.delete(oldSessionId));
    return run;
  }

  private async rotateUnlocked(oldSessionId: string): Promise<string | null> {
    const oldData = await this.getSession(oldSessionId);
    if (!oldData) return null;
    if (oldData.retired) return this.resolveRetiredReuse(oldSessionId, oldData);
    return this.issueRotatedSession(oldSessionId, oldData);
  }

  private async resolveRetiredReuse(
    sessionId: string,
    oldData: SessionData
  ): Promise<string | null> {
    if (isRecentRotation(oldData)) return oldData.rotatedTo ?? null;
    this.logger.warn(`Session reuse detected for session ${sessionId.slice(0, 8)}...`);
    await this.invalidateSessionFamily(oldData.familyId || sessionId);
    return null;
  }

  private async issueRotatedSession(
    oldSessionId: string,
    oldData: SessionData
  ): Promise<string> {
    const newSessionId = this.generateSessionId();
    const familyId = oldData.familyId || oldSessionId;
    await this.retireSession(oldSessionId, oldData, familyId, newSessionId);
    await this.createSession(newSessionId, {
      ...oldData,
      familyId,
      retired: false,
      lastRefreshedAt: Date.now(),
    });
    return newSessionId;
  }

  private async retireSession(
    oldSessionId: string,
    oldData: SessionData,
    familyId: string,
    newSessionId: string
  ): Promise<void> {
    await this.updateSession(oldSessionId, {
      ...oldData,
      familyId,
      retired: true,
      retiredAt: Date.now(),
      rotatedTo: newSessionId,
    });
  }

  private async invalidateSessionFamily(familyId: string): Promise<void> {
    this.logger.warn(
      `Invalidating session family ${familyId.slice(0, 8)}... due to reuse detection`
    );
    await this.withStore(
      () => this.invalidateRedisFamily(familyId),
      () => this.invalidateMemoryFamily(familyId)
    );
  }

  private async invalidateRedisFamily(familyId: string): Promise<void> {
    const sessionIds = await this.redisClient!.sMembers(`session-family:${familyId}`);
    if (sessionIds.length === 0) return;
    this.logger.warn(`Deleting ${sessionIds.length} sessions in family`);
    const pipeline = this.redisClient!.multi();
    for (const sessionId of sessionIds) {
      pipeline.del(`session:${sessionId}`);
    }
    pipeline.del(`session-family:${familyId}`);
    await pipeline.exec();
  }

  private async invalidateMemoryFamily(familyId: string): Promise<void> {
    for (const [sessionId, encryptedData] of this.inMemoryStore.entries()) {
      try {
        const data = JSON.parse(this.decrypt(encryptedData)) as SessionData;
        if (data.familyId === familyId || sessionId === familyId) {
          this.inMemoryStore.delete(sessionId);
        }
      } catch {
        // Skip invalid sessions
      }
    }
  }
}
