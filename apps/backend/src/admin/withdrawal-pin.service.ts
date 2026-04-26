import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WithdrawalPinService {
  /**
   * Hash PIN with business-scoped salt (businessId). SHA-256.
   */
  hashPin(businessId: string, pin: string): string {
    return crypto
      .createHash('sha256')
      .update(businessId + pin, 'utf8')
      .digest('hex');
  }

  /**
   * Verify PIN against stored hash.
   */
  verifyPin(businessId: string, pin: string, hash: string): boolean {
    if (!hash || !pin) return false;
    const computed = this.hashPin(businessId, pin);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }
}

