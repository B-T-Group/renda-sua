import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Configuration } from '../config/configuration';
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
}

@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStoreService.name);
  private redisClient: RedisClientType | null = null;
  private redisUnhealthy = false;
  private readonly inMemoryStore = new Map<string, string>();
  private readonly encryptionKey: Buffer;
  private readonly SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
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
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (!redis?.host) {
      if (nodeEnv === 'production') {
        throw new Error(
          'Redis is required in production for session storage. In-memory fallback is disabled in prod.'
        );
      }
      this.logger.log('Redis not configured, using in-memory store (dev only)');
      return;
    }

    try {
      this.redisClient = createClient({
        socket: {
          host: redis.host,
          port: redis.port,
          connectTimeout: 5000,
        },
        password: redis.password,
      });

      this.redisClient.on('error', (err: any) => {
        this.logger.error(
          `Redis client error: ${err?.message || String(err)} (host=${redis.host}:${redis.port})`
        );
        if (nodeEnv === 'production') {
          throw new Error('Redis connection failed in production');
        }
      });

      await this.redisClient.connect();
      this.logger.log(`Redis session store connected (${redis.host}:${redis.port})`);
    } catch (error: any) {
      if (nodeEnv === 'production') {
        throw new Error(`Redis connection failed in production: ${error.message}`);
      }
      this.logger.warn(
        'Failed to connect to Redis, using in-memory store (dev only):',
        error.message
      );
      this.redisClient = null;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {});
    }
  }

  generateSessionId(): string {
    return randomBytes(32).toString('base64url');
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
    });
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

  private async deleteRedisSession(sessionId: string): Promise<void> {
    const data = await this.getSession(sessionId);
    await this.redisClient!.del(`session:${sessionId}`);
    if (!data) return;
    const familyId = data.familyId || sessionId;
    await this.redisClient!.sRem(`session-family:${familyId}`, sessionId);
  }

  async rotateSession(oldSessionId: string): Promise<string | null> {
    const oldData = await this.getSession(oldSessionId);
    if (!oldData) {
      return null;
    }

    // Check if this session was already retired (potential reuse attack)
    if (oldData.retired) {
      this.logger.warn(`Session reuse detected for session ${oldSessionId.slice(0, 8)}... - invalidating family`);
      
      // Invalidate all sessions in this family
      const familyId = oldData.familyId || oldSessionId;
      await this.invalidateSessionFamily(familyId);
      
      return null;
    }

    const newSessionId = this.generateSessionId();
    const familyId = oldData.familyId || oldSessionId;

    // Mark old session as retired
    await this.updateSession(oldSessionId, { ...oldData, retired: true });

    // Create new session with same family
    await this.createSession(newSessionId, {
      ...oldData,
      familyId,
      retired: false,
      lastRefreshedAt: Date.now(),
    });

    return newSessionId;
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
