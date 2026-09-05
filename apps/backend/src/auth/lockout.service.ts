import { Injectable, Logger } from '@nestjs/common';

interface LockoutEntry {
  attempts: number;
  lockedUntil?: number;
}

/**
 * In-memory login attempt tracking and lockout service.
 * For production with multiple instances, replace with Redis-backed implementation.
 */
@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);
  private readonly attempts = new Map<string, LockoutEntry>();
  
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if identifier is currently locked out
   */
  isLockedOut(identifier: string): boolean {
    const key = this.normalizeKey(identifier);
    const entry = this.attempts.get(key);
    
    if (!entry) {
      return false;
    }
    
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
      return true;
    }
    
    // Lockout expired, clean up
    if (entry.lockedUntil) {
      this.attempts.delete(key);
    }
    
    return false;
  }

  /**
   * Record a failed attempt
   */
  recordFailure(identifier: string): void {
    const key = this.normalizeKey(identifier);
    const now = Date.now();
    const entry = this.attempts.get(key) || { attempts: 0 };
    
    entry.attempts += 1;
    
    if (entry.attempts >= this.MAX_ATTEMPTS) {
      entry.lockedUntil = now + this.LOCKOUT_DURATION_MS;
      this.logger.warn(`Identifier locked out: ${key} (${entry.attempts} attempts)`);
    }
    
    this.attempts.set(key, entry);
    
    // Schedule cleanup of this entry after attempt window
    setTimeout(() => {
      const current = this.attempts.get(key);
      if (current && !current.lockedUntil) {
        this.attempts.delete(key);
      }
    }, this.ATTEMPT_WINDOW_MS);
  }

  /**
   * Record a successful attempt (clears lockout)
   */
  recordSuccess(identifier: string): void {
    const key = this.normalizeKey(identifier);
    this.attempts.delete(key);
  }

  /**
   * Get remaining lockout time in ms (0 if not locked)
   */
  getRemainingLockoutMs(identifier: string): number {
    const key = this.normalizeKey(identifier);
    const entry = this.attempts.get(key);
    
    if (!entry?.lockedUntil) {
      return 0;
    }
    
    const remaining = entry.lockedUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(identifier: string): number {
    const key = this.normalizeKey(identifier);
    return this.attempts.get(key)?.attempts || 0;
  }

  private normalizeKey(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.attempts.entries()) {
      if (entry.lockedUntil && entry.lockedUntil < now) {
        this.attempts.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired lockout entries`);
    }
  }
}
