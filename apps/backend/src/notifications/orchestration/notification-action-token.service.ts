import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import { HasuraSystemService } from '../../hasura/hasura-system.service';

export interface ActionTokenPayload {
  userId: string;
  action: string;
  entityId: string;
  exp: number;
  nonce: string;
}

function signaturesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

@Injectable()
export class NotificationActionTokenService {
  private readonly defaultTtlSeconds = 30 * 60;

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly hasura: HasuraSystemService
  ) {}

  async issue(params: {
    userId: string;
    action: string;
    entityId: string;
    ttlSeconds?: number;
  }): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const exp =
      Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? this.defaultTtlSeconds);
    const payload: ActionTokenPayload = {
      userId: params.userId,
      action: params.action,
      entityId: params.entityId,
      exp,
      nonce,
    };
    await this.hasura.executeMutation(
      `mutation N($object: notification_action_nonces_insert_input!) {
        insert_notification_action_nonces_one(object: $object) { nonce }
      }`,
      {
        object: {
          nonce,
          user_id: params.userId,
          action: params.action,
          entity_id: params.entityId,
          expires_at: new Date(exp * 1000).toISOString(),
        },
      }
    );
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = this.sign(body);
    return `${body}.${sig}`;
  }

  async verify(token: string): Promise<ActionTokenPayload> {
    const [body, sig] = token.split('.');
    if (!body || !sig) {
      throw new UnauthorizedException('Invalid action token');
    }
    const expected = this.sign(body);
    if (!signaturesMatch(sig, expected)) {
      throw new UnauthorizedException('Invalid action token signature');
    }
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as ActionTokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Action token expired');
    }
    await this.consumeNonce(payload);
    return payload;
  }

  private async consumeNonce(payload: ActionTokenPayload): Promise<void> {
    const res = await this.hasura.executeMutation<{
      update_notification_action_nonces: { affected_rows: number };
    }>(
      `mutation C($nonce: String!, $usedAt: timestamptz!, $userId: uuid!) {
        update_notification_action_nonces(
          where: {
            nonce: { _eq: $nonce }
            used_at: { _is_null: true }
            expires_at: { _gt: $usedAt }
            user_id: { _eq: $userId }
          }
          _set: { used_at: $usedAt }
        ) { affected_rows }
      }`,
      {
        nonce: payload.nonce,
        usedAt: new Date().toISOString(),
        userId: payload.userId,
      }
    );
    if (!res.update_notification_action_nonces?.affected_rows) {
      throw new UnauthorizedException('Action token already used or invalid');
    }
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret()).update(body).digest('base64url');
  }

  private secret(): string {
    const wa = this.configService.get<Configuration['whatsapp']>('whatsapp');
    const fromWa = wa?.appSecret?.trim();
    if (fromWa) return fromWa;
    const internal =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey?.trim() ?? '';
    if (internal) return internal;
    throw new UnauthorizedException(
      'Action token secret is not configured (WHATSAPP_APP_SECRET or NOTIFICATIONS_INTERNAL_API_KEY)'
    );
  }
}
