import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Configuration, JwtConfig } from '../config/configuration';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class PinCryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const secret =
      process.env.DELIVERY_PIN_ENCRYPTION_KEY ||
      this.configService.get<JwtConfig>('jwt')?.secret ||
      'delivery-pin-dev-key-change-me';
    this.key = crypto.createHash('sha256').update(secret, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string | null {
    try {
      const data = Buffer.from(ciphertext, 'base64');
      if (data.length < IV_LENGTH + 16) return null;
      const iv = data.subarray(0, IV_LENGTH);
      const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
      const encrypted = data.subarray(IV_LENGTH + 16);
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
