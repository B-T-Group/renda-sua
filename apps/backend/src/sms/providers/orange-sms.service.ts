import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Configuration } from '../../config/configuration';
import type { SendSmsParams, SmsProvider, SmsSendResult } from '../sms-provider.interface';

const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;
const ORANGE_SMS_SCOPE =
  'ope:sms_admin:v1:access ope:smsmessaging:v1:access';

interface OrangeTokenResponse {
  access_token?: string;
  expires_in?: number;
}

@Injectable()
export class OrangeSmsService implements SmsProvider {
  private readonly cfg: Configuration['orangeSms'];
  private readonly http: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    this.cfg = this.configService.get<Configuration['orangeSms']>('orangeSms') ?? {
      clientId: '',
      clientSecret: '',
      senderNumber: 'tel:+717445',
      senderName: 'Rendasua',
      baseUrl: 'https://api.orange.com',
    };
    const base = this.cfg.baseUrl.replace(/\/$/, '');
    this.http = axios.create({ baseURL: base, timeout: 30000 });
    if (!this.cfg.clientId || !this.cfg.clientSecret) {
      this.logger.warn('Orange SMS OAuth credentials missing; SMS calls will fail.');
    }
  }

  async sendSms(params: SendSmsParams): Promise<SmsSendResult> {
    const senderTel = this.toTelUri(this.cfg.senderNumber);
    const pre = this.orangeSendPreconditions(senderTel);
    if (pre) return pre;
    const recipients = this.normalizeRecipients(params.to);
    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipient numbers' };
    }
    try {
      await this.sendToAllRecipients(senderTel, recipients, params.message);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: this.formatAxiosError(error) };
    }
  }

  private orangeSendPreconditions(senderTel: string): SmsSendResult | null {
    if (!senderTel) {
      return { success: false, error: 'Orange SMS sender number is not configured' };
    }
    if (!this.cfg.clientId || !this.cfg.clientSecret) {
      return { success: false, error: 'Orange SMS OAuth credentials are not configured' };
    }
    return null;
  }

  private async sendToAllRecipients(
    senderTel: string,
    recipients: string[],
    message: string
  ): Promise<void> {
    const token = await this.ensureAccessToken();
    for (const address of recipients) {
      await this.postOutboundSms(token, senderTel, address, message);
    }
  }

  private normalizeRecipients(to: string | string[]): string[] {
    const list = Array.isArray(to) ? to : [to];
    const out: string[] = [];
    for (const raw of list) {
      const tel = this.toTelUri(String(raw));
      if (tel) out.push(tel);
    }
    return out;
  }

  private toTelUri(raw: string): string {
    const s = raw.trim();
    if (!s) return '';
    if (s.toLowerCase().startsWith('tel:')) return s;
    if (s.startsWith('+')) return `tel:${s}`;
    const digits = s.replace(/\D/g, '');
    return digits.length > 0 ? `tel:+${digits}` : '';
  }

  private async postOutboundSms(
    accessToken: string,
    senderTel: string,
    recipientTel: string,
    message: string
  ): Promise<void> {
    const path = `/smsmessaging/v1/outbound/${encodeURIComponent(senderTel)}/requests`;
    const body = this.buildOutboundBody(recipientTel, senderTel, message);
    const { status, data } = await this.http.post(path, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300) return;
    const detail =
      typeof data === 'string' ? data : JSON.stringify(data ?? { status });
    throw new Error(`SMS request failed (${status}): ${detail}`);
  }

  private buildOutboundBody(
    recipientTel: string,
    senderTel: string,
    message: string
  ) {
    return {
      outboundSMSMessageRequest: {
        address: recipientTel,
        senderAddress: senderTel,
        senderName: this.cfg.senderName,
        outboundSMSTextMessage: { message },
      },
    };
  }

  private formatAxiosError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (typeof data === 'string' && data) return data;
      if (data && typeof data === 'object') return JSON.stringify(data);
      return error.message || 'Orange SMS request failed';
    }
    return error instanceof Error ? error.message : 'Orange SMS request failed';
  }

  private async ensureAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) return this.accessToken;
    if (!this.tokenRefreshPromise) {
      this.tokenRefreshPromise = this.fetchAccessToken().finally(() => {
        this.tokenRefreshPromise = null;
      });
    }
    return this.tokenRefreshPromise;
  }

  private async fetchAccessToken(): Promise<string> {
    const basic = Buffer.from(
      `${this.cfg.clientId}:${this.cfg.clientSecret}`
    ).toString('base64');
    const body = this.buildTokenBody();
    const { data } = await this.http.post<OrangeTokenResponse>(
      '/oauth/v3/token',
      body,
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return this.storeTokenFromResponse(data);
  }

  private buildTokenBody(): string {
    return new URLSearchParams({
      grant_type: 'client_credentials',
      scope: ORANGE_SMS_SCOPE,
    }).toString();
  }

  private storeTokenFromResponse(data: OrangeTokenResponse): string {
    const token = data?.access_token;
    if (!token) throw new Error('Orange OAuth: missing access_token');
    const ttlSec =
      typeof data.expires_in === 'number' && data.expires_in > 0
        ? data.expires_in
        : 3600;
    this.accessToken = token;
    this.tokenExpiresAt =
      Date.now() + Math.min(ttlSec * 1000, DEFAULT_TOKEN_TTL_MS);
    return token;
  }
}
