import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { Configuration } from '../config/configuration';

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
  private readonly inMemoryStore = new Map<string, LockoutEntry>();
  
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly LOCKOUT_TTL_SECONDS = Math.ceil((this.ATTEMPT_WINDOW_MS) / 1000); // 1 hour TTL for attempt tracking
  
  constructor(private readonly configService: ConfigService<Configuration>) {
    this.initializeRedis().catch((err) =>
      this.logger.warn('Redis unavailable for lockout service, using in-memory store', err)
    );
    
    // Clean up expired in-memory entries every 5 minutes
    setInterval(() => this.cleanupInMemory(), 5 * 60 * 1000);
  }

  private async initializeRedis() {
    const redis = this.configService.get('redis');
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (!redis?.host) {
      if (nodeEnv === 'production') {
        throw new Error(
          'Redis is required in production for lockout service. In-memory fallback is disabled in prod.'
        );
      }
      this.logger.log('Redis not configured, using in-memory lockout store (dev only)');
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
      this.logger.log('Redis lockout service connected');
    } catch (error: any) {
      if (nodeEnv === 'production') {
        throw new Error(`Redis connection failed in production: ${error.message}`);
      }
      this.logger.warn(
        'Failed to connect to Redis for lockout service, using in-memory store (dev only):',
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

  /**
   * Check if identifier is currently locked out
   */
  async isLockedOut(identifier: string): Promise<boolean> {
    const key = this.normalizeKey(identifier);
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (this.redisClient?.isOpen) {
      const data = await this.redisClient.get(`lockout:${key}`);
      if (!data) return false;
      
      try {
        const entry: LockoutEntry = JSON.parse(data);
        if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
          return true;
        }
        // Expired, clean up
        await this.redisClient.del(`lockout:${key}`);
        return false;
      } catch {
        return false;
      }
    } else {
      // SECURITY: In production, fail closed if Redis is unavailable
      if (nodeEnv === 'production') {
        this.logger.error(`Lockout service Redis unavailable in production for ${key}`);
        throw new Error('Lockout service unavailable');
      }
      
      // Development: fall back to in-memory
      const entry = this.inMemoryStore.get(key);
      if (!entry) return false;
      
      if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
        return true;
      }
      
      // Lockout expired, clean up
      if (entry.lockedUntil) {
        this.inMemoryStore.delete(key);
      }
      
      return false;
    }
  }

  /**
   * Record a failed attempt
   */
  async recordFailure(identifier: string): Promise<void> {
    const key = this.normalizeKey(identifier);
    const now = Date.now();
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (this.redisClient?.isOpen) {
      const data = await this.redisClient.get(`lockout:${key}`);
      const entry: LockoutEntry = data ? JSON.parse(data) : { attempts: 0 };
      
      entry.attempts += 1;
      
      if (entry.attempts >= this.MAX_ATTEMPTS) {
        entry.lockedUntil = now + this.LOCKOUT_DURATION_MS;
        this.logger.warn(`Identifier locked out: ${key} (${entry.attempts} attempts)`);
      }
      
      await this.redisClient.setEx(
        `lockout:${key}`,
        this.LOCKOUT_TTL_SECONDS,
        JSON.stringify(entry)
      );
    } else {
      // SECURITY: In production, fail closed if Redis is unavailable
      if (nodeEnv === 'production') {
        this.logger.error(`Lockout service Redis unavailable in production for ${key}`);
        throw new Error('Lockout service unavailable');
      }
      
      // Development: fall back to in-memory
      const entry = this.inMemoryStore.get(key) || { attempts: 0 };
      
      entry.attempts += 1;
      
      if (entry.attempts >= this.MAX_ATTEMPTS) {
        entry.lockedUntil = now + this.LOCKOUT_DURATION_MS;
        this.logger.warn(`Identifier locked out: ${key} (${entry.attempts} attempts)`);
      }
      
      this.inMemoryStore.set(key, entry);
      
      // Schedule cleanup of this entry after attempt window
      setTimeout(() => {
        const current = this.inMemoryStore.get(key);
        if (current && !current.lockedUntil) {
          this.inMemoryStore.delete(key);
        }
      }, this.ATTEMPT_WINDOW_MS);
    }
  }

  /**
   * Record a successful attempt (clears lockout)
   */
  async recordSuccess(identifier: string): Promise<void> {
    const key = this.normalizeKey(identifier);
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (this.redisClient?.isOpen) {
      await this.redisClient.del(`lockout:${key}`);
    } else {
      // SECURITY: In production, fail closed if Redis is unavailable
      if (nodeEnv === 'production') {
        this.logger.error(`Lockout service Redis unavailable in production for ${key}`);
        throw new Error('Lockout service unavailable');
      }
      
      // Development: fall back to in-memory
      this.inMemoryStore.delete(key);
    }
  }

  /**
   * Get remaining lockout time in ms (0 if not locked)
   */
  async getRemainingLockoutMs(identifier: string): Promise<number> {
    const key = this.normalizeKey(identifier);
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (this.redisClient?.isOpen) {
      const data = await this.redisClient.get(`lockout:${key}`);
      if (!data) return 0;
      
      try {
        const entry: LockoutEntry = JSON.parse(data);
        if (!entry.lockedUntil) return 0;
        
        const remaining = entry.lockedUntil - Date.now();
        return Math.max(0, remaining);
      } catch {
        return 0;
      }
    } else {
      // SECURITY: In production, fail closed if Redis is unavailable
      if (nodeEnv === 'production') {
        this.logger.error(`Lockout service Redis unavailable in production for ${key}`);
        throw new Error('Lockout service unavailable');
      }
      
      // Development: fall back to in-memory
      const entry = this.inMemoryStore.get(key);
      if (!entry?.lockedUntil) return 0;
      
      const remaining = entry.lockedUntil - Date.now();
      return Math.max(0, remaining);
    }
  }

  /**
   * Get current attempt count
   */
  async getAttemptCount(identifier: string): Promise<number> {
    const key = this.normalizeKey(identifier);
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (this.redisClient?.isOpen) {
      const data = await this.redisClient.get(`lockout:${key}`);
      if (!data) return 0;
      
      try {
        const entry: LockoutEntry = JSON.parse(data);
        return entry.attempts || 0;
      } catch {
        return 0;
      }
    } else {
      // SECURITY: In production, fail closed if Redis is unavailable
      if (nodeEnv === 'production') {
        this.logger.error(`Lockout service Redis unavailable in production for ${key}`);
        throw new Error('Lockout service unavailable');
      }
      
      // Development: fall back to in-memory
      return this.inMemoryStore.get(key)?.attempts || 0;
    }
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
