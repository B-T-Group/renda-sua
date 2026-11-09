import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DeliveryPinStorageService } from './delivery-pin-storage.service';
import { PinCryptoService } from './pin-crypto.service';

const MAX_PIN_ATTEMPTS = 3;
/** Versioned HMAC. Unprefixed 64-hex values are the legacy unsalted SHA-256. */
export const PIN_HASH_PREFIX = 'v2:';

@Injectable()
export class DeliveryPinService {
  constructor(
    private readonly storage: DeliveryPinStorageService,
    private readonly pinCrypto: PinCryptoService
  ) {}

  generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /** True for hashes written before the peppered HMAC (still accepted). */
  isLegacyHash(hash: string): boolean {
    return !hash.startsWith(PIN_HASH_PREFIX);
  }

  hashPin(orderId: string, pin: string): string {
    return this.versionedHmac('pin', orderId, pin);
  }

  verifyPin(orderId: string, pin: string, hash: string): boolean {
    if (!hash || !pin) return false;
    const expected = this.isLegacyHash(hash)
      ? this.legacyDigest(`${orderId}${pin}`)
      : this.hashPin(orderId, pin);
    return safeEqual(expected, hash);
  }

  hashOverwriteCode(orderId: string, code: string): string {
    return this.versionedHmac('overwrite', orderId, code);
  }

  verifyOverwriteCode(orderId: string, code: string, hash: string): boolean {
    if (!hash || !code) return false;
    const expected = this.isLegacyHash(hash)
      ? this.legacyDigest(`${orderId}overwrite${code}`)
      : this.hashOverwriteCode(orderId, code);
    return safeEqual(expected, hash);
  }

  private versionedHmac(purpose: string, entityId: string, secret: string): string {
    const mac = this.pinCrypto.hmacHex(purpose, `${entityId}\0${secret}`);
    return `${PIN_HASH_PREFIX}${mac}`;
  }

  private legacyDigest(material: string): string {
    return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
  }

  async setPinForClient(orderId: string, pin: string): Promise<void> {
    await this.storage.persistEncryptedPin(orderId, pin);
  }

  async getPinForClient(orderId: string): Promise<string | null> {
    return this.storage.getPin(orderId);
  }

  async clearPinForOrder(orderId: string): Promise<void> {
    await this.storage.clearPersistedPin(orderId);
  }

  encryptPinForMessage(pin: string): string {
    return this.storage.encryptForPayload(pin);
  }

  decryptPinFromMessage(ciphertext: string): string | null {
    return this.storage.decryptFromPayload(ciphertext);
  }

  getMaxPinAttempts(): number {
    return MAX_PIN_ATTEMPTS;
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
