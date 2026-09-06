import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import { StripeConfig } from '../config/configuration';
import {
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

export type StripeCaptureMethod = 'automatic' | 'manual';

const ZERO_DECIMAL_STRIPE_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

@Injectable()
export class StripeCaptureService {
  private readonly logger = new Logger(StripeCaptureService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly configService: ConfigService,
    private readonly accountsService: AccountsService
  ) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  /** Whether manual capture applies for order checkout in the given seller country. */
  isManualCaptureEnabledForCountry(countryCode?: string): boolean {
    if (!this.config.manualCaptureEnabled) return false;
    const countries = this.config.manualCaptureCountries ?? [];
    if (countries.length === 0) return true;
    if (!countryCode) return false;
    return countries.includes(countryCode.trim().toUpperCase());
  }

  isManualCaptureTransaction(tx: StripePaymentTransaction): boolean {
    return (tx as StripePaymentTransaction & { capture_method?: string })
      .capture_method === 'manual';
  }

  resolveCaptureMethodForOrderEntity(
    countryCode?: string,
    fulfillment?: 'delivery' | 'pickup' | 'shipping'
  ): StripeCaptureMethod {
    // Pickup and carrier shipping authorize at placement and capture at
    // handoff/receipt, regardless of the env-gated manual-capture rollout.
    if (fulfillment === 'pickup' || fulfillment === 'shipping') return 'manual';
    return this.isManualCaptureEnabledForCountry(countryCode)
      ? 'manual'
      : 'automatic';
  }

  async captureOrderPaymentIntent(params: {
    orderId: string;
    orderNumber: string;
    /** Capture a smaller amount than originally authorized (e.g. after a fee waiver). Omit for a full capture. */
    captureAmount?: number;
  }): Promise<{ success: boolean; message?: string; captured?: boolean }> {
    const tx = await this.databaseService.getTransactionByEntityId(
      params.orderNumber
    );
    if (!tx?.stripe_payment_intent_id) {
      return { success: false, message: 'No Stripe payment found for order' };
    }
    if (!this.isManualCaptureTransaction(tx)) {
      return { success: true, message: 'Automatic capture order', captured: true };
    }
    if (tx.status === 'success') {
      return { success: true, message: 'Already captured', captured: true };
    }
    if (tx.status !== 'authorized' && tx.status !== 'capture_pending') {
      return {
        success: false,
        message: `Cannot capture transaction in status ${tx.status}`,
      };
    }

    // If Stripe already captured (or settled) this PI, sync local tx — do not capture again.
    const existingPi = await this.tryRetrievePaymentIntent(
      tx.stripe_payment_intent_id,
      params.orderNumber
    );
    if (existingPi?.status === 'succeeded') {
      return this.syncAlreadyCapturedTransaction(tx, existingPi, params.captureAmount);
    }
    if (existingPi?.status && existingPi.status !== 'requires_capture') {
      return {
        success: false,
        message: `Cannot capture PaymentIntent in status ${existingPi.status}`,
      };
    }

    const stripeCaptureAmount = this.scalePreTaxCaptureForAuthorizedTax(
      params.captureAmount,
      tx,
      existingPi
    );

    // Persist reduced amount before Stripe capture so a concurrent
    // payment_intent.succeeded webhook cannot credit the pre-waiver total.
    await this.databaseService.updateTransaction(tx.id, {
      status: 'capture_pending',
      ...(params.captureAmount != null ? { amount: params.captureAmount } : {}),
    });

    try {
      const pi = await this.stripeService.capturePaymentIntent(
        tx.stripe_payment_intent_id,
        `capture_${params.orderId}`,
        stripeCaptureAmount != null
          ? { amount: stripeCaptureAmount, currency: tx.currency }
          : undefined
      );
      if (pi.status === 'succeeded') {
        const capturedAt = new Date().toISOString();
        await this.databaseService.updateTransaction(tx.id, {
          status: 'success',
          captured_at: capturedAt,
          ...(params.captureAmount != null
            ? { amount: params.captureAmount }
            : {}),
        });
        this.logger.log(
          `stripe_capture_success order=${params.orderNumber} tx=${tx.id}`
        );
        return { success: true, captured: true };
      }
      return { success: true, message: 'Capture initiated', captured: false };
    } catch (error: any) {
      await this.restoreAuthorizationAfterFailedCapture(
        tx,
        params.captureAmount,
        error?.message || 'Capture failed'
      );
      this.logger.error(
        `Capture failed for order ${params.orderNumber}: ${error?.message}`
      );
      return { success: false, message: error?.message || 'Capture failed' };
    }
  }

  private async tryRetrievePaymentIntent(
    paymentIntentId: string,
    orderNumber: string
  ): Promise<{ status?: string; amount?: number; amount_received?: number } | null> {
    try {
      return await this.stripeService.retrievePaymentIntent(paymentIntentId);
    } catch (error: any) {
      this.logger.warn(
        `Could not retrieve PI before capture for ${orderNumber}: ${error?.message}`
      );
      return null;
    }
  }

  private async syncAlreadyCapturedTransaction(
    tx: StripePaymentTransaction,
    existingPi: { amount_received?: number },
    captureAmount: number | undefined
  ): Promise<{ success: boolean; message?: string; captured?: boolean }> {
    const capturedAt = new Date().toISOString();
    const shouldSyncAmount =
      captureAmount != null &&
      existingPi.amount_received ===
        this.toStripeMinorUnits(captureAmount, tx.currency);
    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      captured_at: capturedAt,
      ...(shouldSyncAmount ? { amount: captureAmount } : {}),
    });
    return { success: true, message: 'Already captured on Stripe', captured: true };
  }

  /**
   * Checkout/PaymentSheet authorizes pre-tax + Stripe Tax, but callers pass the
   * pre-tax order total as captureAmount. Scale so tax is actually collected.
   * Ledger/wallet still persist the caller amount so settlement stays consistent.
   */
  private scalePreTaxCaptureForAuthorizedTax(
    captureAmount: number | undefined,
    tx: StripePaymentTransaction,
    paymentIntent?: { amount?: number } | null
  ): number | undefined {
    if (captureAmount == null) return undefined;
    const authorizedMinor = paymentIntent?.amount;
    const storedMinor = this.toStripeMinorUnits(Number(tx.amount), tx.currency);
    if (!authorizedMinor || storedMinor <= 0 || authorizedMinor <= storedMinor) {
      return captureAmount;
    }
    const requestedMinor = this.toStripeMinorUnits(captureAmount, tx.currency);
    const scaledMinor = Math.round((requestedMinor * authorizedMinor) / storedMinor);
    return this.fromStripeMinorUnits(scaledMinor, tx.currency);
  }

  private fromStripeMinorUnits(amount: number, currency?: string | null): number {
    const code = currency?.toUpperCase();
    const divisor =
      code && ZERO_DECIMAL_STRIPE_CURRENCIES.has(code) ? 1 : 100;
    return amount / divisor;
  }

  private async restoreAuthorizationAfterFailedCapture(
    tx: StripePaymentTransaction,
    captureAmount: number | undefined,
    errorMessage: string
  ): Promise<void> {
    await this.databaseService.updateTransaction(tx.id, {
      status: 'authorized',
      error_message: errorMessage,
      // Restore pre-capture amount if we had written a partial captureAmount.
      ...(captureAmount != null ? { amount: tx.amount } : {}),
    });
  }

  /** Credit client wallet after capture. Idempotent if the webhook already deposited. */
  async creditWalletForCapturedOrder(
    orderNumber: string
  ): Promise<string | null> {
    const tx = await this.databaseService.getTransactionByEntityId(orderNumber);
    if (!tx?.account_id || tx.transaction_type !== 'PAYMENT') {
      return tx?.account_id ?? null;
    }
    const result = await this.accountsService.registerDepositIfNotExists({
      accountId: tx.account_id,
      amount: tx.amount,
      memo: `Stripe payment deposit - ${tx.reference}`,
      referenceId: tx.id,
    });
    if (!result.success) {
      this.logger.error(
        `Failed to credit account ${tx.account_id}: ${result.error}`
      );
      return null;
    }
    if (!result.alreadyExists) {
      this.logger.log(
        `Credited account ${tx.account_id} with ${tx.amount} ${tx.currency}`
      );
    }
    return tx.account_id;
  }

  /**
   * Capture a manual-capture rental authorization, optionally for less than
   * the authorized amount (unused authorization is released by Stripe).
   * Marks the transaction `success` synchronously so the later
   * `payment_intent.succeeded` webhook is a no-op; the caller is responsible
   * for wallet/ledger movements of the captured amount.
   */
  async captureRentalBookingPaymentIntent(params: {
    bookingId: string;
    bookingNumber: string;
    amountToCapture: number;
  }): Promise<{ success: boolean; message?: string; captured?: boolean }> {
    const tx = await this.databaseService.getTransactionByEntityId(
      params.bookingNumber
    );
    if (!tx?.stripe_payment_intent_id) {
      return { success: false, message: 'No Stripe payment found for booking' };
    }
    if (tx.status === 'success') {
      return { success: true, message: 'Already captured', captured: true };
    }
    if (tx.status !== 'authorized' && tx.status !== 'capture_pending') {
      return {
        success: false,
        message: `Cannot capture transaction in status ${tx.status}`,
      };
    }
    await this.databaseService.updateTransaction(tx.id, {
      status: 'capture_pending',
    });
    try {
      const pi = await this.stripeService.capturePaymentIntent(
        tx.stripe_payment_intent_id,
        `capture_rental_${params.bookingId}`,
        { amount: params.amountToCapture, currency: tx.currency }
      );
      if (pi.status !== 'succeeded') {
        return { success: true, message: 'Capture initiated', captured: false };
      }
      await this.databaseService.updateTransaction(tx.id, {
        status: 'success',
        captured_at: new Date().toISOString(),
        amount: params.amountToCapture,
      });
      this.logger.log(
        `stripe_capture_success rental=${params.bookingNumber} tx=${tx.id} amount=${params.amountToCapture}`
      );
      return { success: true, captured: true };
    } catch (error: any) {
      await this.databaseService.updateTransaction(tx.id, {
        status: 'authorized',
        error_message: error?.message || 'Capture failed',
      });
      this.logger.error(
        `Capture failed for rental ${params.bookingNumber}: ${error?.message}`
      );
      return { success: false, message: error?.message || 'Capture failed' };
    }
  }

  private toStripeMinorUnits(amount: number, currency?: string | null): number {
    const code = currency?.toUpperCase();
    return Math.round(
      amount * (code && ZERO_DECIMAL_STRIPE_CURRENCIES.has(code) ? 1 : 100)
    );
  }

  async cancelOrderPaymentIntent(params: {
    orderNumber: string;
    orderId?: string;
  }): Promise<{ success: boolean; message?: string; skipped?: boolean }> {
    const tx = await this.databaseService.getTransactionByEntityId(
      params.orderNumber
    );
    if (!tx) {
      return { success: true, skipped: true, message: 'No Stripe transaction' };
    }

    await this.expireCheckoutSessionIfPresent(tx);

    if (!tx.stripe_payment_intent_id) {
      return this.markPendingCheckoutCancelled(tx);
    }
    if (tx.status === 'success') {
      // Status drift: DB says captured but Stripe may still be requires_capture.
      try {
        const pi = await this.stripeService.retrievePaymentIntent(
          tx.stripe_payment_intent_id
        );
        if (pi.status === 'requires_capture') {
          this.logger.warn(
            `Cancel PI: tx ${tx.id} marked success but PI requires_capture; cancelling auth`
          );
        } else if (pi.status === 'canceled') {
          await this.databaseService.updateTransaction(tx.id, {
            status: 'cancelled',
            error_message: 'PaymentIntent already canceled on Stripe',
          });
          return { success: true, skipped: true, message: 'Already canceled' };
        } else {
          return { success: false, message: 'Payment already captured; use refund' };
        }
      } catch (error: any) {
        return {
          success: false,
          message: error?.message || 'Payment already captured; use refund',
        };
      }
    } else if (
      tx.status !== 'authorized' &&
      tx.status !== 'capture_pending' &&
      tx.status !== 'pending'
    ) {
      return { success: true, skipped: true, message: `Status is ${tx.status}` };
    }

    try {
      await this.databaseService.updateTransaction(tx.id, {
        status: 'cancelled',
        error_message: 'Payment authorization cancelled',
      });
      await this.stripeService.cancelPaymentIntent(
        tx.stripe_payment_intent_id,
        `cancel_${params.orderId ?? params.orderNumber}`
      );
      this.logger.log(
        `stripe_authorization_cancelled order=${params.orderNumber} tx=${tx.id}`
      );
      return { success: true };
    } catch (error: any) {
      await this.databaseService.updateTransaction(tx.id, {
        status: tx.status,
        error_message: error?.message || 'Cancel failed',
      });
      this.logger.error(
        `Cancel PI failed for order ${params.orderNumber}: ${error?.message}`
      );
      return { success: false, message: error?.message || 'Cancel failed' };
    }
  }

  private async expireCheckoutSessionIfPresent(
    tx: StripePaymentTransaction
  ): Promise<void> {
    if (!tx.stripe_session_id) return;
    try {
      await this.stripeService.expireCheckoutSession(tx.stripe_session_id);
    } catch (error: any) {
      this.logger.warn(
        `Could not expire checkout session ${tx.stripe_session_id}: ${error?.message}`
      );
    }
  }

  private async markPendingCheckoutCancelled(
    tx: StripePaymentTransaction
  ): Promise<{ success: boolean; message?: string; skipped?: boolean }> {
    if (tx.status !== 'pending') {
      return { success: true, skipped: true, message: 'No Stripe payment intent' };
    }
    await this.databaseService.updateTransaction(tx.id, {
      status: 'cancelled',
      error_message: 'Checkout session expired on order cancellation',
    });
    return { success: true };
  }
}
