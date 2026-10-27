/**
 * MTN MoMo payment service.
 * @deprecated For Cameroon mobile payments, Freemopay is used instead (see mobile-payments FreemopayService).
 * This module is retained for potential use in other countries or future removal.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  formatMtnAmount,
  MTN_MOMO_PRODUCTS,
  missingCredentialEnvVars,
  resolveMtnMomoConfig,
  type MtnMomoConfig,
  type MtnMomoProduct,
} from './mtn-momo.config';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';
import {
  isMtnReferenceId,
  signMtnWebhookToken,
  verifyMtnWebhookToken,
} from './mtn-momo-webhook-token.util';

export type { MtnMomoConfig, MtnMomoProduct } from './mtn-momo.config';

/** MTN request/transfer states. */
export type MtnMomoTransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface MtnMomoStatusResult {
  status: MtnMomoTransactionStatus;
  reason?: string;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
}

export type MtnMomoReconcileOutcome =
  | 'updated'
  | 'still_pending'
  | 'already_final'
  | 'unknown_reference'
  | 'mismatch';

export interface CollectionRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface DisbursementRequest {
  amount: string;
  currency: string;
  externalId: string;
  payee: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface RemittanceRequest {
  amount: string;
  currency: string;
  externalId: string;
  payee: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface MtnMomoResponse {
  status: boolean;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  payerMessage?: string;
  payeeNote?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}

@Injectable()
export class MtnMomoService {
  private readonly config: MtnMomoConfig;
  private httpClient: AxiosInstance | null = null;
  private readonly tokenCache = new Map<
    MtnMomoProduct,
    { token: string; expiresAt: number }
  >();

  constructor(
    private configService: ConfigService,
    private mtnMomoDatabaseService: MtnMomoDatabaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    this.config = resolveMtnMomoConfig((key) =>
      this.configService.get<string>(key)
    );

    const configured = MTN_MOMO_PRODUCTS.filter(
      (product) => missingCredentialEnvVars(this.config, product).length === 0
    );
    if (configured.length === 0) {
      this.logger.warn(
        'MTN MoMo configuration incomplete: no product has a full credential set. Some features may not work properly.'
      );
    }
    if (!this.config.baseUrl) {
      this.logger.warn(
        `MTN MoMo base URL is not set for target environment "${this.config.targetEnvironment}". Set MTN_MOMO_BASE_URL; calls fail until it is set.`
      );
    }
    if (this.config.callbackUrl && !this.config.webhookSecret) {
      this.logger.warn(
        'MTN_MOMO_CALLBACK_URL is set but MTN_MOMO_WEBHOOK_SECRET is not: the X-Callback-Url header is omitted and pending payments are settled by polling only.'
      );
    }

    this.logger.info(
      `MTN MoMo service initialized (target environment: ${
        this.config.targetEnvironment
      }, currency: ${this.config.currency}, products configured: ${
        configured.join(',') || 'none'
      })`,
      { service: 'MtnMomoService' }
    );
  }

  /** Default currency (MTN_MOMO_CURRENCY; sandbox EUR, otherwise XAF). */
  getDefaultCurrency(): string {
    return this.config.currency;
  }

  /** True when the collection product has a full credential set. */
  isCollectionConfigured(): boolean {
    return missingCredentialEnvVars(this.config, 'collection').length === 0;
  }

  private http(): AxiosInstance {
    if (!this.config.baseUrl) {
      throw new Error(
        `MTN_MOMO_BASE_URL is required for target environment "${this.config.targetEnvironment}"`
      );
    }
    if (!this.httpClient) {
      this.httpClient = axios.create({
        baseURL: this.config.baseUrl,
        timeout: 30000,
      });
    }
    return this.httpClient;
  }

  private assertProduct(type: string): asserts type is MtnMomoProduct {
    if (!(MTN_MOMO_PRODUCTS as readonly string[]).includes(type)) {
      throw new Error(`Unsupported MTN MoMo product: ${type}`);
    }
  }

  /** Headers every product call needs (subscription key is per product). */
  private productHeaders(
    product: MtnMomoProduct,
    token: string,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': this.config.targetEnvironment,
      'Ocp-Apim-Subscription-Key':
        this.config.credentials[product].subscriptionKey,
      ...extra,
    };
  }

  /**
   * The X-Callback-Url for one collection request, or undefined when the header
   * must be omitted (MTN answers 500 to an empty value). MTN cannot add headers to
   * its callback, so the per-request token travels in the URL query. The sandbox API
   * user is bound to its providerCallbackHost: the URL host must match it.
   */
  private buildCallbackUrl(referenceId: string): string | undefined {
    const { callbackUrl, webhookSecret } = this.config;
    if (!callbackUrl || !webhookSecret) return undefined;
    try {
      const url = new URL(callbackUrl);
      url.searchParams.set('ref', referenceId);
      url.searchParams.set(
        'token',
        signMtnWebhookToken(webhookSecret, referenceId)
      );
      return url.toString();
    } catch {
      this.logger.warn(
        'MTN_MOMO_CALLBACK_URL is not a valid URL; header omitted'
      );
      return undefined;
    }
  }

  /** Constant-time check of the token a webhook call carries in its URL. */
  verifyWebhookToken(referenceId: unknown, token: unknown): boolean {
    return verifyMtnWebhookToken(this.config.webhookSecret, referenceId, token);
  }

  /**
   * Request to pay (Collection) - Request payment from a customer
   */
  async requestToPay(
    request: CollectionRequest,
    userId: string
  ): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const currency = request.currency || this.config.currency;
      const amount = formatMtnAmount(request.amount, currency);
      const token = await this.getToken('collection');

      const payload = {
        amount,
        currency,
        externalId: request.externalId,
        payer: request.payer,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      const callbackUrl = this.buildCallbackUrl(referenceId);
      await this.http().post(`/collection/v1_0/requesttopay`, payload, {
        headers: this.productHeaders('collection', token, {
          'X-Reference-Id': referenceId,
          'Content-Type': 'application/json',
          // Omitted (never empty) when no callback is configured: MTN answers 500.
          ...(callbackUrl ? { 'X-Callback-Url': callbackUrl } : {}),
        }),
      });

      await this.logPaymentRequest(
        userId,
        referenceId,
        request.externalId,
        amount,
        currency,
        'PENDING',
        request.payerMessage,
        request.payeeNote
      );

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount,
        currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(
        `Collection request failed: ${(error as Error).message}`
      );
      return this.failure(error);
    }
  }

  /**
   * GET the state of a request-to-pay from MTN (authoritative; throws on API errors).
   */
  async fetchCollectionStatus(
    referenceId: string
  ): Promise<MtnMomoStatusResult> {
    return this.fetchTransactionStatus(
      'collection',
      `/collection/v1_0/requesttopay/${referenceId}`
    );
  }

  private async fetchTransactionStatus(
    product: MtnMomoProduct,
    path: string
  ): Promise<MtnMomoStatusResult> {
    const token = await this.getToken(product);
    const response = await this.http().get(path, {
      headers: this.productHeaders(product, token),
    });
    const data = response.data ?? {};
    const raw = String(data.status ?? '').toUpperCase();
    const status: MtnMomoTransactionStatus =
      raw === 'SUCCESSFUL' || raw === 'FAILED' ? raw : 'PENDING';
    if (status === 'PENDING' && raw !== 'PENDING') {
      this.logger.warn(
        `Unexpected MTN MoMo status "${raw}" treated as PENDING`
      );
    }
    return {
      status,
      reason: typeof data.reason === 'string' ? data.reason : data.reason?.code,
      financialTransactionId: data.financialTransactionId,
      externalId: data.externalId,
      amount: data.amount,
      currency: data.currency,
    };
  }

  /**
   * Request to pay delivery notification - Check payment status
   */
  async requestToPayDeliveryNotification(
    referenceId: string
  ): Promise<MtnMomoResponse> {
    try {
      const data = await this.fetchCollectionStatus(referenceId);
      return {
        status: data.status === 'SUCCESSFUL',
        financialTransactionId: data.financialTransactionId,
        externalId: data.externalId,
        amount: data.amount,
        currency: data.currency,
        statusCode: data.status,
        statusMessage: data.reason ?? data.status,
      };
    } catch (error) {
      this.logger.error(
        `Collection status check failed: ${(error as Error).message}`
      );
      return this.failure(error);
    }
  }

  /**
   * Transfer (Disbursement) - Send money to a customer
   */
  async transfer(request: DisbursementRequest): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const currency = request.currency || this.config.currency;
      const amount = formatMtnAmount(request.amount, currency);
      const token = await this.getToken('disbursement');

      const payload = {
        amount,
        currency,
        externalId: request.externalId,
        payee: request.payee,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      await this.http().post(`/disbursement/v1_0/transfer`, payload, {
        headers: this.productHeaders('disbursement', token, {
          'X-Reference-Id': referenceId,
          'Content-Type': 'application/json',
        }),
      });

      this.logger.info(`Disbursement initiated: ${referenceId}`);

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount,
        currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(`Disbursement failed: ${(error as Error).message}`);
      return this.failure(error);
    }
  }

  /**
   * Transfer delivery notification - Check transfer status
   */
  async transferDeliveryNotification(
    referenceId: string
  ): Promise<MtnMomoResponse> {
    try {
      const data = await this.fetchTransactionStatus(
        'disbursement',
        `/disbursement/v1_0/transfer/${referenceId}`
      );
      return {
        status: data.status === 'SUCCESSFUL',
        financialTransactionId: data.financialTransactionId,
        externalId: data.externalId,
        amount: data.amount,
        currency: data.currency,
        statusCode: data.status,
        statusMessage: data.reason ?? data.status,
      };
    } catch (error) {
      this.logger.error(
        `Disbursement status check failed: ${(error as Error).message}`
      );
      return this.failure(error);
    }
  }

  /**
   * Remittance - Send money internationally
   */
  async remittance(request: RemittanceRequest): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const currency = request.currency || this.config.currency;
      const amount = formatMtnAmount(request.amount, currency);
      const token = await this.getToken('remittance');

      const payload = {
        amount,
        currency,
        externalId: request.externalId,
        payee: request.payee,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      await this.http().post(`/remittance/v1_0/transfer`, payload, {
        headers: this.productHeaders('remittance', token, {
          'X-Reference-Id': referenceId,
          'Content-Type': 'application/json',
        }),
      });

      this.logger.info(`Remittance initiated: ${referenceId}`);

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount,
        currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(`Remittance failed: ${(error as Error).message}`);
      return this.failure(error);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ): Promise<any> {
    try {
      this.assertProduct(type);
      const token = await this.getToken(type);

      const response = await this.http().get(`/${type}/v1_0/account/balance`, {
        headers: this.productHeaders(type, token),
      });

      return {
        status: true,
        balance: response.data.availableBalance,
        currency: response.data.currency,
      };
    } catch (error) {
      this.logger.error(`Balance check failed: ${(error as Error).message}`);
      return this.failure(error);
    }
  }

  /**
   * Validate account holder
   */
  async validateAccountHolder(
    partyId: string,
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE',
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ): Promise<any> {
    try {
      this.assertProduct(type);
      const token = await this.getToken(type);

      const response = await this.http().get(
        `/${type}/v1_0/accountholder/${encodeURIComponent(
          partyIdType
        )}/${encodeURIComponent(partyId)}/active`,
        { headers: this.productHeaders(type, token) }
      );

      return {
        status: true,
        result: response.data.result,
        message: response.data.message,
      };
    } catch (error) {
      this.logger.error(
        `Account validation failed: ${(error as Error).message}`
      );
      return this.failure(error);
    }
  }

  private failure(error: unknown): MtnMomoResponse {
    return {
      status: false,
      error:
        (error as any)?.response?.data?.message || (error as Error).message,
    };
  }

  /**
   * Access token for one product, using that product's own API user + API key +
   * subscription key. Cached until shortly before it expires.
   */
  private async getToken(product: MtnMomoProduct): Promise<string> {
    const cached = this.tokenCache.get(product);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const missing = missingCredentialEnvVars(this.config, product);
    if (missing.length > 0) {
      const message = `MTN MoMo ${product} credentials are not configured (set ${missing.join(
        ', '
      )})`;
      this.logger.error(message);
      throw new Error(message);
    }

    try {
      const { apiUserId, apiKey, subscriptionKey } =
        this.config.credentials[product];

      const response = await this.http().post(
        `/${product}/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${apiUserId}:${apiKey}`
            ).toString('base64')}`,
            'Ocp-Apim-Subscription-Key': subscriptionKey,
          },
        }
      );

      const token: string = response.data.access_token;
      const ttlSeconds = Number(response.data.expires_in) || 0;
      if (ttlSeconds > 120) {
        this.tokenCache.set(product, {
          token,
          expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
        });
      }
      return token;
    } catch (error) {
      this.logger.error(
        `Token generation failed for ${product}: ${(error as Error).message}`
      );
      throw new Error(
        `Failed to get ${product} token: ${(error as Error).message}`
      );
    }
  }

  /**
   * Generate a unique reference ID
   */
  private generateReferenceId(): string {
    return randomUUID();
  }

  /**
   * Log payment request to database
   */
  private async logPaymentRequest(
    userId: string,
    transactionId: string,
    externalId: string,
    amount: string,
    currency: string,
    status: string,
    payerMessage: string,
    payeeNote: string
  ): Promise<void> {
    try {
      await this.mtnMomoDatabaseService.logPaymentRequest({
        userId,
        transactionId,
        externalId,
        amount: parseFloat(amount),
        currency,
        status,
        payerMessage,
        payeeNote,
      });
    } catch (error) {
      this.logger.error(
        `Failed to log payment request: ${(error as Error).message}`
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Webhook from MTN MoMo (the controller has already verified the URL token).
   * The body is not trusted: the reference id comes from our own signed callback
   * URL, and the state is re-read from MTN with a GET before anything is updated.
   * MTN calls back once and never retries, so the poller covers missed calls.
   */
  async handleCallback(
    callbackData: unknown,
    referenceId: string
  ): Promise<MtnMomoReconcileOutcome> {
    const claimed =
      callbackData && typeof callbackData === 'object'
        ? (callbackData as { status?: unknown }).status
        : undefined;
    this.logger.info(
      `Received MTN MoMo callback for ${referenceId} (claimed status: ${String(
        claimed ?? 'n/a'
      )})`
    );
    const outcome = await this.reconcilePaymentRequest(referenceId);
    this.logger.info(
      `Processed MTN MoMo callback for ${referenceId}: ${outcome}`
    );
    return outcome;
  }

  /**
   * Settle one payment request from MTN's authoritative status. Safe to call
   * repeatedly and concurrently (callback + poller): only a PENDING row moves, once.
   * Throws when MTN cannot be reached so the caller can retry later.
   */
  async reconcilePaymentRequest(
    referenceId: string
  ): Promise<MtnMomoReconcileOutcome> {
    if (!isMtnReferenceId(referenceId)) return 'unknown_reference';

    const row =
      await this.mtnMomoDatabaseService.getPaymentRequestByTransactionId(
        referenceId
      );
    if (!row) {
      this.logger.warn(
        `MTN MoMo reference ${referenceId} has no payment request`
      );
      return 'unknown_reference';
    }
    if (row.status !== 'PENDING') return 'already_final';

    const remote = await this.fetchCollectionStatus(referenceId);
    if (remote.status === 'PENDING') return 'still_pending';

    // Sanity check against what we stored; a mismatch is never applied.
    if (
      (remote.externalId && remote.externalId !== row.external_id) ||
      (remote.status === 'SUCCESSFUL' &&
        remote.amount !== undefined &&
        Number(remote.amount) !== Number(row.amount))
    ) {
      this.logger.error(
        `MTN MoMo status for ${referenceId} does not match the stored payment request; not applied`
      );
      return 'mismatch';
    }

    const moved =
      await this.mtnMomoDatabaseService.completePendingPaymentRequest(
        referenceId,
        remote.status
      );
    if (!moved) return 'already_final';
    this.logger.info(
      `MTN MoMo payment request ${referenceId} -> ${remote.status}${
        remote.reason ? ` (${remote.reason})` : ''
      }`
    );
    return 'updated';
  }

  /**
   * Polling fallback: settle PENDING requests the callback never settled.
   * Returns how many requests were moved to a final state.
   */
  async reconcilePendingPaymentRequests(
    options: { minAgeSeconds?: number; limit?: number } = {}
  ): Promise<{ checked: number; updated: number; errors: number }> {
    const result = { checked: 0, updated: 0, errors: 0 };
    if (!this.isCollectionConfigured() || !this.config.baseUrl) return result;

    const olderThan = new Date(
      Date.now() - (options.minAgeSeconds ?? 60) * 1000
    );
    const pending = await this.mtnMomoDatabaseService.getPendingPaymentRequests(
      olderThan,
      options.limit ?? 50
    );
    for (const request of pending) {
      result.checked += 1;
      try {
        const outcome = await this.reconcilePaymentRequest(
          request.transaction_id
        );
        if (outcome === 'updated') result.updated += 1;
      } catch (error) {
        result.errors += 1;
        this.logger.warn(
          `MTN MoMo poll failed for ${request.transaction_id}: ${
            (error as Error).message
          }`
        );
      }
    }
    return result;
  }
}
