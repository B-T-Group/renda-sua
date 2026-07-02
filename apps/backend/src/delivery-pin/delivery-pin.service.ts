import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DeliveryPinStorageService } from './delivery-pin-storage.service';

const MAX_PIN_ATTEMPTS = 3;

@Injectable()
export class DeliveryPinService {
  constructor(private readonly storage: DeliveryPinStorageService) {}

  generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  hashPin(orderId: string, pin: string): string {
    return crypto
      .createHash('sha256')
      .update(orderId + pin, 'utf8')
      .digest('hex');
  }

  verifyPin(orderId: string, pin: string, hash: string): boolean {
    if (!hash || !pin) return false;
    const computed = this.hashPin(orderId, pin);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  hashOverwriteCode(orderId: string, code: string): string {
    return crypto
      .createHash('sha256')
      .update(orderId + 'overwrite' + code, 'utf8')
      .digest('hex');
  }

  verifyOverwriteCode(orderId: string, code: string, hash: string): boolean {
    if (!hash || !code) return false;
    const computed = this.hashOverwriteCode(orderId, code);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
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
