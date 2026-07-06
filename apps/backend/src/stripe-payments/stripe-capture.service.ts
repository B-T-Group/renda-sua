import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import {
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

export type StripeCaptureMethod = 'automatic' | 'manual';

@Injectable()
export class StripeCaptureService {
  private readonly logger = new Logger(StripeCaptureService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly configService: ConfigService
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
    countryCode?: string
  ): StripeCaptureMethod {
    return this.isManualCaptureEnabledForCountry(countryCode)
      ? 'manual'
      : 'automatic';
  }

  async captureOrderPaymentIntent(params: {
    orderId: string;
    orderNumber: string;
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

    await this.databaseService.updateTransaction(tx.id, {
      status: 'capture_pending',
    });

    try {
      const pi = await this.stripeService.capturePaymentIntent(
        tx.stripe_payment_intent_id,
        `capture_${params.orderId}`
      );
      if (pi.status === 'succeeded') {
        const capturedAt = new Date().toISOString();
        await this.databaseService.updateTransaction(tx.id, {
          status: 'success',
          captured_at: capturedAt,
        });
        this.logger.log(
          `stripe_capture_success order=${params.orderNumber} tx=${tx.id}`
        );
        return { success: true, captured: true };
      }
      return { success: true, message: 'Capture initiated', captured: false };
    } catch (error: any) {
      await this.databaseService.updateTransaction(tx.id, {
        status: 'authorized',
        error_message: error?.message || 'Capture failed',
      });
      this.logger.error(
        `Capture failed for order ${params.orderNumber}: ${error?.message}`
      );
      return { success: false, message: error?.message || 'Capture failed' };
    }
  }

  async cancelOrderPaymentIntent(params: {
    orderNumber: string;
    orderId?: string;
  }): Promise<{ success: boolean; message?: string; skipped?: boolean }> {
    const tx = await this.databaseService.getTransactionByEntityId(
      params.orderNumber
    );
    if (!tx?.stripe_payment_intent_id) {
      return { success: true, skipped: true, message: 'No Stripe transaction' };
    }
    if (tx.status === 'success') {
      return { success: false, message: 'Payment already captured; use refund' };
    }
    if (
      tx.status !== 'authorized' &&
      tx.status !== 'capture_pending' &&
      tx.status !== 'pending'
    ) {
      return { success: true, skipped: true, message: `Status is ${tx.status}` };
    }

    try {
      await this.stripeService.cancelPaymentIntent(
        tx.stripe_payment_intent_id,
        `cancel_${params.orderId ?? params.orderNumber}`
      );
      await this.databaseService.updateTransaction(tx.id, {
        status: 'cancelled',
        error_message: 'Payment authorization cancelled',
      });
      this.logger.log(
        `stripe_authorization_cancelled order=${params.orderNumber} tx=${tx.id}`
      );
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `Cancel PI failed for order ${params.orderNumber}: ${error?.message}`
      );
      return { success: false, message: error?.message || 'Cancel failed' };
    }
  }
}
