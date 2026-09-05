import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Configuration } from '../config/configuration';

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
  private readonly inMemoryStore = new Map<string, string>();
  private readonly encryptionKey: Buffer;
  private readonly SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService<Configuration>) {
    const encryptionKey = process.env.SESSION_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!encryptionKey) {
      throw new Error('SESSION_ENCRYPTION_KEY or JWT_SECRET required for session encryption');
    }
    // Use first 32 bytes of the key (or pad if shorter)
    this.encryptionKey = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
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
        },
        password: redis.password,
      });

      this.redisClient.on('error', (err: any) => {
        this.logger.error('Redis client error:', err);
        if (nodeEnv === 'production') {
          throw new Error('Redis connection failed in production');
        }
      });

      await this.redisClient.connect();
      this.logger.log('Redis session store connected');
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

    if (this.redisClient?.isOpen) {
      await this.redisClient.setEx(
        `session:${sessionId}`,
        this.SESSION_TTL_SECONDS,
        encrypted
      );
    } else {
      this.inMemoryStore.set(sessionId, encrypted);
      setTimeout(
        () => this.inMemoryStore.delete(sessionId),
        this.SESSION_TTL_SECONDS * 1000
      );
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    let encrypted: string | null = null;

    if (this.redisClient?.isOpen) {
      encrypted = await this.redisClient.get(`session:${sessionId}`);
    } else {
      encrypted = this.inMemoryStore.get(sessionId) || null;
    }

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
    if (this.redisClient?.isOpen) {
      await this.redisClient.del(`session:${sessionId}`);
    } else {
      this.inMemoryStore.delete(sessionId);
    }
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
    // In a production Redis setup, you'd maintain a family->sessions index
    // For now, we'll delete the specific session IDs we know about
    // This is a simplified version; a full implementation would track all sessions in a family
    this.logger.log(`Invalidating session family ${familyId.slice(0, 8)}...`);
    
    if (this.redisClient) {
      // In production, implement proper family tracking with a SET in Redis
      // For now, just log the security event
      this.logger.warn('Session family invalidation triggered - full family tracking not yet implemented');
    } else {
      // For in-memory store, we can scan all sessions
      for (const [sessionId, encryptedData] of this.inMemoryStore.entries()) {
        try {
          const data = JSON.parse(this.decrypt(encryptedData)) as SessionData;
          if (data.familyId === familyId || sessionId === familyId) {
            await this.deleteSession(sessionId);
          }
        } catch {
          // Skip invalid sessions
        }
      }
    }
  }
}
