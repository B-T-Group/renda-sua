import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Configuration } from '../../config/configuration';
import type {
  MtnSmsErrorBody,
  MtnSmsOutboundSubscriptionDeleteResponse,
  MtnSmsResourceReference,
  MtnSmsSubscriptionResponse,
  OutboundSmsMessageRequest,
  ShortCodeSubscription,
  UpdateSubscriptionRequest,
} from '../mtn-sms.types';
import type { SendSmsParams, SmsProvider, SmsSendResult } from '../sms-provider.interface';

const TOKEN_PATH =
  '/oauth/client_credential/accesstoken?grant_type=client_credentials';
const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;

@Injectable()
export class MtnSmsService implements SmsProvider {
  private readonly cfg: Configuration['mtnSms'];
  private readonly smsClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    this.cfg = this.configService.get<Configuration['mtnSms']>('mtnSms') ?? {
      clientId: '',
      clientSecret: '',
      serviceCode: '',
      baseUrl: 'https://api.mtn.com',
    };
    const base = this.cfg.baseUrl.replace(/\/$/, '');
    this.smsClient = axios.create({
      baseURL: `${base}/v3/sms`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.smsClient.interceptors.request.use(async (config) => {
      const token = await this.ensureAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    if (!this.cfg.clientId || !this.cfg.clientSecret) {
      this.logger.warn('MTN SMS OAuth credentials missing; SMS calls will fail.');
    }
  }

  async sendSms(params: SendSmsParams): Promise<SmsSendResult> {
    const serviceCode =
      params.serviceCode?.trim() || this.cfg.serviceCode?.trim() || '';
    if (!serviceCode) {
      return { success: false, error: 'MTN SMS serviceCode is not configured' };
    }
    const receivers = this.normalizeReceivers(params.to);
    if (receivers.length === 0) {
      return { success: false, error: 'No valid recipient numbers' };
    }
    const body: OutboundSmsMessageRequest = {
      message: params.message,
      serviceCode,
      receiverAddress: receivers,
      clientCorrelatorId: params.clientCorrelatorId?.trim() || randomUUID(),
      requestDeliveryReceipt: params.requestDeliveryReceipt,
      keyword: params.keyword,
    };
    const sender = params.senderAddress?.trim() || this.cfg.senderAddress?.trim();
    if (sender) body.senderAddress = sender;
    try {
      const ref = await this.sendOutbound(body);
      return this.toSendResult(ref);
    } catch (error: unknown) {
      return { success: false, error: this.formatAxiosError(error) };
    }
  }

  async sendOutbound(
    body: OutboundSmsMessageRequest
  ): Promise<MtnSmsResourceReference> {
    const { data } = await this.smsClient.post<MtnSmsResourceReference>(
      '/messages/sms/outbound',
      body
    );
    return data;
  }

  async createSubscription(
    body: ShortCodeSubscription,
    transactionId?: string
  ): Promise<MtnSmsSubscriptionResponse> {
    const headers = transactionId ? { transactionId } : undefined;
    const { data } = await this.smsClient.post<MtnSmsSubscriptionResponse>(
      '/messages/sms/subscription',
      body,
      { headers }
    );
    return data;
  }

  async updateSubscription(
    subscriptionId: string,
    body: UpdateSubscriptionRequest,
    transactionId?: string
  ): Promise<MtnSmsSubscriptionResponse> {
    const headers = transactionId ? { transactionId } : undefined;
    const { data } = await this.smsClient.patch<MtnSmsSubscriptionResponse>(
      `/messages/sms/subscription/${encodeURIComponent(subscriptionId)}`,
      body,
      { headers }
    );
    return data;
  }

  async deleteSubscription(
    subscriptionId: string,
    transactionId?: string
  ): Promise<MtnSmsOutboundSubscriptionDeleteResponse> {
    const headers = transactionId ? { transactionId } : undefined;
    const { data } =
      await this.smsClient.delete<MtnSmsOutboundSubscriptionDeleteResponse>(
        `/messages/sms/subscription/${encodeURIComponent(subscriptionId)}`,
        { headers }
      );
    return data;
  }

  private toSendResult(ref: MtnSmsResourceReference): SmsSendResult {
    const ok = ref.statusCode === '0000';
    return {
      success: ok,
      transactionId: ref.transactionId,
      statusCode: ref.statusCode,
      statusMessage: ref.statusMessage,
      dataStatus: ref.data?.status,
      error: ok ? undefined : ref.statusMessage,
    };
  }

  private normalizeReceivers(to: string | string[]): string[] {
    const list = Array.isArray(to) ? to : [to];
    const out: string[] = [];
    for (const raw of list) {
      const digits = String(raw).replace(/\D/g, '');
      if (digits.length > 0) out.push(digits);
    }
    return out;
  }

  private formatAxiosError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as MtnSmsErrorBody | undefined;
      if (data?.statusMessage) return String(data.statusMessage);
      return error.message || 'MTN SMS request failed';
    }
    return error instanceof Error ? error.message : 'MTN SMS request failed';
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
    const base = this.cfg.baseUrl.replace(/\/$/, '');
    const url = `${base}${TOKEN_PATH}`;
    const body = new URLSearchParams();
    body.set('client_id', this.cfg.clientId);
    body.set('client_secret', this.cfg.clientSecret);
    const { data } = await axios.post<{
      access_token?: string;
      expires_in?: number;
    }>(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    });
    const token = data?.access_token;
    if (!token) throw new Error('MTN OAuth: missing access_token');
    const ttlSec =
      typeof data.expires_in === 'number' && data.expires_in > 0
        ? data.expires_in
        : 3600;
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + Math.min(ttlSec * 1000, DEFAULT_TOKEN_TTL_MS);
    return token;
  }
}
