/**
 * Orange Money Core APIs client (omcoreapis/1.0.2).
 * Token: POST to ORANGE_MOMO_OAUTH_TOKEN_URL with
 * Authorization Basic Base64(ORANGE_MOMO_CUSTOMER_KEY:ORANGE_MOMO_CUSTOMER_SECRET)
 * and body from ORANGE_MOMO_OAUTH_GRANT_TYPE:
 * - password: grant_type=password&username&password
 * - client_credentials: grant_type=client_credentials
 * Core calls: Bearer access_token + X-AUTH-TOKEN Base64(ORANGE_MOMO_API_USERNAME:ORANGE_MOMO_API_PASSWORD).
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { OrangeMomoConfig } from '../config/configuration';
import { OrangeMomoDatabaseService } from './orange-momo-database.service';
import type {
  BulkPaymentStatusBody,
  CashinInitResponse,
  CashinPayRequestBody,
  CashinPayResponseBody,
  CashoutInitResponse,
  CashoutPayRequestBody,
  CashoutPayResponseBody,
  C2cInitResponse,
  C2cPayRequestBody,
  C2cPayResponseBody,
  Ic2cInitResponse,
  Ic2cPayRequestBody,
  Ic2cPayResponseBody,
  MpInitResponse,
  MpPayRequestBody,
  MpPayResponseBody,
  OrangeCollectionRequest,
  OrangeMomoPaymentResponse,
  OrangeMomoResult,
  OrangeMomoTokenResponse,
  UserInfosBody,
  UserInfosResponse,
} from './orange-momo.types';

const DEFAULT_ORANGE_MOMO: OrangeMomoConfig = {
  baseUrl: 'https://api-s1.orange.cm/omcoreapis/1.0.2',
  oauthTokenUrl: 'https://api-s1.orange.cm/token',
  oauthGrantType: 'password',
  customerKey: '',
  customerSecret: '',
  apiUsername: '',
  apiPassword: '',
  channelMsisdn: '',
  callbackUrl: '',
  channelPin: '2222',
};

function isUnauthorized(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

@Injectable()
export class OrangeMomoService {
  private readonly cfg: OrangeMomoConfig;
  private readonly coreClient: AxiosInstance;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly orangeMomoDatabaseService: OrangeMomoDatabaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    this.cfg =
      this.configService.get<OrangeMomoConfig>('orangeMomo') ??
      DEFAULT_ORANGE_MOMO;
    if (!this.cfg.customerKey || !this.cfg.customerSecret) {
      this.logger.warn(
        'Orange MoMo customer key/secret missing. Core API calls will fail until configured.',
        { service: 'OrangeMomoService' }
      );
    }
    if (
      this.cfg.oauthGrantType === 'password' &&
      (!this.cfg.apiUsername || !this.cfg.apiPassword)
    ) {
      this.logger.warn(
        'Orange MoMo OAuth grant password requires ORANGE_MOMO_API_USERNAME / ORANGE_MOMO_API_PASSWORD.',
        { service: 'OrangeMomoService' }
      );
    }
    if (!this.cfg.channelMsisdn || !this.cfg.callbackUrl) {
      this.logger.warn(
        'Orange MoMo ORANGE_MOMO_CHANNEL_MSISDN or ORANGE_MOMO_CALLBACK_URL missing; MP collection not fully configured.',
        { service: 'OrangeMomoService' }
      );
    }
    this.coreClient = axios.create({
      baseURL: this.cfg.baseUrl.replace(/\/$/, ''),
      timeout: 30000,
    });
  }

  async mpInit(): Promise<OrangeMomoResult<MpInitResponse>> {
    return this.postCore<MpInitResponse>('/mp/init', {});
  }

  async mpPay(
    body: MpPayRequestBody
  ): Promise<OrangeMomoResult<MpPayResponseBody>> {
    return this.postWithChannelCredentials<MpPayResponseBody>(
      '/mp/pay',
      body
    );
  }

  async getMpPaymentStatus(
    payToken: string
  ): Promise<OrangeMomoResult<MpPayResponseBody>> {
    return this.getCore<MpPayResponseBody>(
      `/mp/paymentstatus/${encodeURIComponent(payToken)}`
    );
  }

  async pushMp(
    payToken: string
  ): Promise<OrangeMomoResult<MpPayResponseBody>> {
    return this.getCore<MpPayResponseBody>(
      `/mp/push/${encodeURIComponent(payToken)}`
    );
  }

  async cashinInit(): Promise<OrangeMomoResult<CashinInitResponse>> {
    return this.postCore<CashinInitResponse>('/cashin/init', {});
  }

  async cashinPay(
    body: CashinPayRequestBody
  ): Promise<OrangeMomoResult<CashinPayResponseBody>> {
    return this.postWithChannelCredentials<CashinPayResponseBody>(
      '/cashin/pay',
      body
    );
  }

  async getCashinPaymentStatus(
    payToken: string
  ): Promise<OrangeMomoResult<CashinPayResponseBody>> {
    return this.getCore<CashinPayResponseBody>(
      `/cashin/paymentstatus/${encodeURIComponent(payToken)}`
    );
  }

  async cashoutInit(): Promise<OrangeMomoResult<CashoutInitResponse>> {
    return this.postCore<CashoutInitResponse>('/cashout/init', {});
  }

  async cashoutPay(
    body: CashoutPayRequestBody
  ): Promise<OrangeMomoResult<CashoutPayResponseBody>> {
    return this.postWithChannelCredentials<CashoutPayResponseBody>(
      '/cashout/pay',
      body
    );
  }

  async getCashoutPaymentStatus(
    payToken: string
  ): Promise<OrangeMomoResult<CashoutPayResponseBody>> {
    return this.getCore<CashoutPayResponseBody>(
      `/cashout/paymentstatus/${encodeURIComponent(payToken)}`
    );
  }

  async pushCashout(
    payToken: string
  ): Promise<OrangeMomoResult<CashoutPayResponseBody>> {
    return this.getCore<CashoutPayResponseBody>(
      `/cashout/push/${encodeURIComponent(payToken)}`
    );
  }

  async c2cInit(): Promise<OrangeMomoResult<C2cInitResponse>> {
    return this.postCore<C2cInitResponse>('/c2c/init', {});
  }

  async c2cPay(
    body: C2cPayRequestBody
  ): Promise<OrangeMomoResult<C2cPayResponseBody>> {
    return this.postCore<C2cPayResponseBody>('/c2c/pay', body);
  }

  async getC2cPaymentStatus(
    payToken: string
  ): Promise<OrangeMomoResult<C2cPayResponseBody>> {
    return this.getCore<C2cPayResponseBody>(
      `/c2c/paymentstatus/${encodeURIComponent(payToken)}`
    );
  }

  async ic2cInit(): Promise<OrangeMomoResult<Ic2cInitResponse>> {
    return this.postCore<Ic2cInitResponse>('/ic2c/init', {});
  }

  async ic2cPay(
    body: Ic2cPayRequestBody
  ): Promise<OrangeMomoResult<Ic2cPayResponseBody>> {
    return this.postCore<Ic2cPayResponseBody>('/ic2c/pay', body);
  }

  async getIc2cPaymentStatus(
    payToken: string
  ): Promise<OrangeMomoResult<Ic2cPayResponseBody>> {
    return this.getCore<Ic2cPayResponseBody>(
      `/ic2c/paymentstatus/${encodeURIComponent(payToken)}`
    );
  }

  async pushIc2c(
    payToken: string
  ): Promise<OrangeMomoResult<Ic2cPayResponseBody>> {
    return this.getCore<Ic2cPayResponseBody>(
      `/ic2c/push/${encodeURIComponent(payToken)}`
    );
  }

  async bulkTransactionsPaymentStatus(
    body: BulkPaymentStatusBody
  ): Promise<OrangeMomoResult<unknown>> {
    return this.postCore<unknown>('/transactions/paymentstatus', body);
  }

  async getSubscriberInfos(
    usertype: string,
    msisdn: string,
    body?: Pick<UserInfosBody, 'pin'>
  ): Promise<OrangeMomoResult<UserInfosResponse>> {
    if (!this.cfg.channelMsisdn) {
      return this.fail(
        new Error('Orange MoMo channel MSISDN not configured')
      );
    }
    const path = `/infos/subscriber/${encodeURIComponent(usertype)}/${encodeURIComponent(msisdn)}`;
    const payload: UserInfosBody = {
      channelMsisdn: this.cfg.channelMsisdn,
      ...(body?.pin != null && body.pin !== '' ? { pin: body.pin } : {}),
    };
    return this.postCore<UserInfosResponse>(path, payload);
  }

  /**
   * Merchant collection: mp/init → payToken → mp/pay (mirrors MTN requestToPay).
   */
  async requestToPay(
    request: OrangeCollectionRequest,
    userId: string
  ): Promise<OrangeMomoPaymentResponse> {
    try {
      if (!this.cfg.channelMsisdn || !this.cfg.callbackUrl) {
        return {
          status: false,
          error:
            'Orange MoMo channel MSISDN or callback URL not configured',
        };
      }
      const initRes = await this.mpInit();
      if (!initRes.success || !initRes.data) {
        return { status: false, error: initRes.error || 'mp/init failed' };
      }
      const payToken = initRes.data?.data?.payToken;
      if (!payToken) {
        return { status: false, error: 'No payToken from Orange mp/init' };
      }
      const payBody = this.buildMpPayBody(request, payToken);
      const payRes = await this.mpPay(payBody);
      if (!payRes.success) {
        return { status: false, error: payRes.error || 'mp/pay failed' };
      }
      await this.persistPaymentRequest(
        userId,
        payToken,
        request.externalId,
        parseFloat(request.amount),
        request.currency,
        'PENDING',
        request.payerMessage,
        request.payeeNote
      );
      return {
        status: true,
        financialTransactionId: payToken,
        externalId: request.externalId,
        amount: request.amount,
        currency: request.currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Orange requestToPay failed: ${msg}`);
      return { status: false, error: msg };
    }
  }

  async handleCallback(payload: unknown): Promise<void> {
    this.logger.info(
      `Orange MoMo callback: ${JSON.stringify(payload)}`,
      { service: 'OrangeMomoService' }
    );
    const payToken = this.extractPayTokenFromCallback(payload);
    if (!payToken) {
      return;
    }
    const status = this.extractCallbackStatus(payload) ?? 'COMPLETED';
    try {
      await this.orangeMomoDatabaseService.updatePaymentRequestStatus(
        payToken,
        status
      );
    } catch (error: unknown) {
      this.logger.error(
        `Orange callback DB update failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** mp/pay, cashin/pay, cashout/pay — channel MSISDN, PIN, notifUrl from config. */
  private postWithChannelCredentials<T>(
    path: string,
    body:
      | MpPayRequestBody
      | CashinPayRequestBody
      | CashoutPayRequestBody
  ): Promise<OrangeMomoResult<T>> {
    return this.postCore<T>(path, this.applyChannelCredentials(body));
  }

  private stripChannelOverrides(
    body: Record<string, unknown>
  ): Record<string, unknown> {
    const rest = { ...body };
    delete rest.channelUserMsisdn;
    delete rest.pin;
    delete rest.notifUrl;
    return rest;
  }

  /** Channel MSISDN, PIN (default `2222` via config), and notifUrl from config only. */
  private applyChannelCredentials(
    body:
      | MpPayRequestBody
      | CashinPayRequestBody
      | CashoutPayRequestBody
  ):
    | MpPayRequestBody
    | CashinPayRequestBody
    | CashoutPayRequestBody {
    const pin = this.cfg.channelPin || '2222';
    const merged: Record<string, unknown> = {
      ...this.stripChannelOverrides(body as Record<string, unknown>),
      channelUserMsisdn: this.cfg.channelMsisdn,
      notifUrl: this.cfg.callbackUrl,
      pin,
    };
    return merged as
      | MpPayRequestBody
      | CashinPayRequestBody
      | CashoutPayRequestBody;
  }

  private buildMpPayBody(
    request: OrangeCollectionRequest,
    payToken: string
  ): MpPayRequestBody {
    const desc = (request.payerMessage || request.payeeNote || 'Payment').slice(
      0,
      125
    );
    return {
      payToken,
      amount: Math.round(parseFloat(request.amount)),
      orderId: this.mpOrderId(request.externalId),
      description: desc,
      subscriberMsisdn: this.normalizeSubscriberMsisdn(request.payer.partyId),
    };
  }

  private mpOrderId(externalId: string): string {
    const cleaned = externalId.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 20);
    if (cleaned.length >= 1) {
      return cleaned;
    }
    return `R${Date.now().toString().slice(-19)}`.slice(0, 20);
  }

  private normalizeSubscriberMsisdn(partyId: string): string {
    let d = partyId.replace(/\D/g, '');
    if (d.startsWith('237')) {
      d = d.slice(3);
    }
    return d.slice(0, 9);
  }

  private async persistPaymentRequest(
    userId: string,
    transactionId: string,
    externalId: string,
    amount: number,
    currency: string,
    status: string,
    payerMessage: string,
    payeeNote: string
  ): Promise<void> {
    try {
      await this.orangeMomoDatabaseService.logPaymentRequest({
        userId,
        transactionId,
        externalId,
        amount,
        currency,
        status,
        payerMessage,
        payeeNote,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to persist Orange payment request: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private extractPayTokenFromCallback(payload: unknown): string | null {
    if (payload == null) {
      return null;
    }
    if (typeof payload === 'string') {
      try {
        return this.extractPayTokenFromObject(
          JSON.parse(payload) as Record<string, unknown>
        );
      } catch {
        return null;
      }
    }
    if (typeof payload === 'object') {
      return this.extractPayTokenFromObject(
        payload as Record<string, unknown>
      );
    }
    return null;
  }

  private extractPayTokenFromObject(o: Record<string, unknown>): string | null {
    const data = o.data as Record<string, unknown> | undefined;
    const raw = o.payToken ?? o.paytoken ?? data?.payToken;
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }

  private extractCallbackStatus(payload: unknown): string | null {
    if (payload == null || typeof payload !== 'object') {
      return null;
    }
    const o = payload as Record<string, unknown>;
    const s = o.status ?? o.txnstatus;
    return typeof s === 'string' ? s : null;
  }

  private xAuthToken(): string {
    return Buffer.from(
      `${this.cfg.apiUsername}:${this.cfg.apiPassword}`
    ).toString('base64');
  }

  private oauthTokenBody(): string {
    if (this.cfg.oauthGrantType === 'client_credentials') {
      const p = new URLSearchParams();
      p.set('grant_type', 'client_credentials');
      return p.toString();
    }
    const p = new URLSearchParams();
    p.set('grant_type', 'password');
    p.set('username', this.cfg.apiUsername);
    p.set('password', this.cfg.apiPassword);
    return p.toString();
  }

  private applyTokenPayload(data: OrangeMomoTokenResponse): void {
    this.token = data.access_token;
    const skewMs = 60_000;
    const sec = data.expires_in;
    this.tokenExpiresAt = sec
      ? Date.now() + Math.max(30, sec) * 1000 - skewMs
      : Date.now() + 3600 * 1000 - skewMs;
  }

  private async fetchAccessToken(): Promise<void> {
    const res = await axios.post<OrangeMomoTokenResponse>(
      this.cfg.oauthTokenUrl,
      this.oauthTokenBody(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${this.cfg.customerKey}:${this.cfg.customerSecret}`
          ).toString('base64')}`,
        },
        timeout: 30000,
      }
    );
    this.applyTokenPayload(res.data);
  }

  private async ensureToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.fetchAccessToken();
    }
    const t = this.token;
    if (!t) {
      throw new Error('Orange MoMo: missing access token after OAuth');
    }
    return t;
  }

  private async coreAuthHeaders(): Promise<Record<string, string>> {
    const bearer = await this.ensureToken();
    return {
      Authorization: `Bearer ${bearer}`,
      'X-AUTH-TOKEN': this.xAuthToken(),
    };
  }

  private async getCore<T>(
    path: string,
    retryOn401 = true
  ): Promise<OrangeMomoResult<T>> {
    try {
      const headers = await this.coreAuthHeaders();
      const res = await this.coreClient.get<T>(path, { headers });
      return this.ok(res.data);
    } catch (error: unknown) {
      if (retryOn401 && isUnauthorized(error)) {
        this.token = null;
        return this.getCore<T>(path, false);
      }
      return this.fail(error);
    }
  }

  private async postCore<T>(
    path: string,
    body: unknown,
    retryOn401 = true
  ): Promise<OrangeMomoResult<T>> {
    try {
      const headers = {
        ...(await this.coreAuthHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await this.coreClient.post<T>(path, body, { headers });
      return this.ok(res.data);
    } catch (error: unknown) {
      if (retryOn401 && isUnauthorized(error)) {
        this.token = null;
        return this.postCore<T>(path, body, false);
      }
      return this.fail(error);
    }
  }

  private ok<T>(data: T): OrangeMomoResult<T> {
    const msg = (data as { message?: string })?.message;
    return { success: true, data, message: msg };
  }

  private fail(error: unknown): OrangeMomoResult<never> {
    let msg = 'Orange MoMo request failed';
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { message?: string; error?: string }
        | undefined;
      msg = data?.message ?? data?.error ?? error.message ?? msg;
    } else if (error instanceof Error) {
      msg = error.message;
    }
    this.logger.error(`Orange MoMo error: ${msg}`, {
      service: 'OrangeMomoService',
    });
    return { success: false, error: String(msg) };
  }
}
