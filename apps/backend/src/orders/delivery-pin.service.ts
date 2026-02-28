import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const PIN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days; cleared when order is completed
const MAX_PIN_ATTEMPTS = 3;

interface CacheEntry {
  pin: string;
  expiresAt: number;
}

@Injectable()
export class DeliveryPinService {
  private readonly pinCache = new Map<string, CacheEntry>();

  /**
   * Generate a random 4-digit PIN (e.g. "0123" to "9999")
   */
  generatePin(): string {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    return pin;
  }

  /**
   * Hash PIN with order-scoped salt (orderId). SHA-256.
   */
  hashPin(orderId: string, pin: string): string {
    const salt = orderId;
    return crypto
      .createHash('sha256')
      .update(salt + pin, 'utf8')
      .digest('hex');
  }

  /**
   * Verify PIN against stored hash.
   */
  verifyPin(orderId: string, pin: string, hash: string): boolean {
    if (!hash || !pin) return false;
    const computed = this.hashPin(orderId, pin);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Hash overwrite code (same pattern as PIN).
   */
  hashOverwriteCode(orderId: string, code: string): string {
    return crypto
      .createHash('sha256')
      .update(orderId + 'overwrite' + code, 'utf8')
      .digest('hex');
  }

  verifyOverwriteCode(
    orderId: string,
    code: string,
    hash: string
  ): boolean {
    if (!hash || !code) return false;
    const computed = this.hashOverwriteCode(orderId, code);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Store plain PIN in memory for client retrieval. Cleared when order is completed (not on first get).
   */
  setPinForClient(orderId: string, pin: string): void {
    this.pinCache.set(orderId, {
      pin,
      expiresAt: Date.now() + PIN_CACHE_TTL_MS,
    });
  }

  /**
   * Retrieve PIN for client (multiple retrievals allowed). Returns null if not found or expired.
   * PIN is only cleared when order is completed via clearPinForOrder.
   */
  getPinForClient(orderId: string): string | null {
    this.cleanExpired();
    const entry = this.pinCache.get(orderId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.pinCache.delete(orderId);
      return null;
    }
    return entry.pin;
  }

  /**
   * Clear stored PIN for an order (call when order is completed so PIN is no longer available).
   */
  clearPinForOrder(orderId: string): void {
    this.pinCache.delete(orderId);
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.pinCache.entries()) {
      if (now > entry.expiresAt) this.pinCache.delete(key);
    }
  }

  getMaxPinAttempts(): number {
    return MAX_PIN_ATTEMPTS;
  }
}
