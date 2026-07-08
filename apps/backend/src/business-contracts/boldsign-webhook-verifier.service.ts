import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { BoldSignConfig, Configuration } from '../config/configuration';

@Injectable()
export class BoldsignWebhookVerifierService {
  constructor(
    private readonly configService: ConfigService<Configuration>
  ) {}

  private get config(): BoldSignConfig {
    return this.configService.get<BoldSignConfig>('boldsign') as BoldSignConfig;
  }

  verify(signatureHeader: string | undefined, rawBody: Buffer): boolean {
    if (!signatureHeader?.trim()) return false;
    const secrets = [
      this.config.webhookSigningSecret,
      this.config.webhookSigningSecretPrevious,
    ].filter((s): s is string => !!s?.trim());
    if (!secrets.length) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => {
        const [k, v] = p.trim().split('=');
        return [k, v];
      })
    );
    const timestamp = parts.t;
    const provided = parts.s0;
    if (!timestamp || !provided) return false;

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    return secrets.some((secret) => this.compareSignature(secret, payload, provided));
  }

  private compareSignature(
    secret: string,
    payload: string,
    provided: string
  ): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }
}
