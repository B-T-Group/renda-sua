import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PinCryptoService } from './pin-crypto.service';

const PIN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  pin: string;
  expiresAt: number;
}

@Injectable()
export class DeliveryPinStorageService {
  private readonly logger = new Logger(DeliveryPinStorageService.name);
  private readonly pinCache = new Map<string, CacheEntry>();

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly pinCryptoService: PinCryptoService
  ) {}

  setPin(orderId: string, pin: string): void {
    this.pinCache.set(orderId, {
      pin,
      expiresAt: Date.now() + PIN_CACHE_TTL_MS,
    });
  }

  getPinFromCache(orderId: string): string | null {
    this.cleanExpired();
    const entry = this.pinCache.get(orderId);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.pinCache.delete(orderId);
      return null;
    }
    return entry.pin;
  }

  clearPin(orderId: string): void {
    this.pinCache.delete(orderId);
  }

  async persistEncryptedPin(orderId: string, pin: string): Promise<void> {
    const encrypted = this.pinCryptoService.encrypt(pin);
    const mutation = `
      mutation SetDeliveryPinEncrypted($orderId: uuid!, $encrypted: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_pin_encrypted: $encrypted }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      encrypted,
    });
    this.setPin(orderId, pin);
  }

  async loadPinFromDb(orderId: string): Promise<string | null> {
    const query = `
      query GetDeliveryPinEncrypted($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          delivery_pin_encrypted
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: { delivery_pin_encrypted: string | null } | null;
    }>(query, { orderId });

    const encrypted = result.orders_by_pk?.delivery_pin_encrypted;
    if (!encrypted) return null;

    const pin = this.pinCryptoService.decrypt(encrypted);
    if (pin) {
      this.setPin(orderId, pin);
    }
    return pin;
  }

  async getPin(orderId: string): Promise<string | null> {
    const cached = this.getPinFromCache(orderId);
    if (cached) return cached;
    return this.loadPinFromDb(orderId);
  }

  async clearPersistedPin(orderId: string): Promise<void> {
    this.clearPin(orderId);
    const mutation = `
      mutation ClearDeliveryPinEncrypted($orderId: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_pin_encrypted: null }
        ) {
          id
        }
      }
    `;
    try {
      await this.hasuraSystemService.executeMutation(mutation, { orderId });
    } catch (error: any) {
      this.logger.warn(
        `Failed to clear delivery_pin_encrypted for ${orderId}: ${error?.message}`
      );
    }
  }

  encryptForPayload(pin: string): string {
    return this.pinCryptoService.encrypt(pin);
  }

  decryptFromPayload(ciphertext: string): string | null {
    return this.pinCryptoService.decrypt(ciphertext);
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.pinCache.entries()) {
      if (now > entry.expiresAt) this.pinCache.delete(key);
    }
  }
}
