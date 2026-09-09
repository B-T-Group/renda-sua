/**
 * useCheckoutOrchestrator
 *
 * Centralizes order creation, Stripe PaymentSheet execution, Mobile Money
 * pending handling, and success navigation outcomes for both single-item and
 * cart checkout flows.
 *
 * Screens (PlaceOrderScreen, CartCheckoutScreen) should call this hook instead
 * of embedding createOrder / PaymentSheet / MM handling themselves.
 *
 * MoMo Deposit Flow (Backend #282 merged @ eb9cca31):
 * - Place-order with pay_at_delivery/pickup MoMo creates order in pending_payment
 * - Backend calculates deposit: max(150, round(total * (total<5000?0.10:0.05)))
 * - Backend initiates MoMo deposit collect automatically (same create-order endpoint)
 * - Response includes: current_status=pending_payment, payment_transaction (deposit collect started)
 * - deposit_status may be omitted initially; GET /orders/:id later shows pending
 * - Client navigates to MoMo await when: current_status=pending_payment AND/OR payment_transaction present
 * - After MoMo SUCCESS callback: deposit_status→paid (via GET), current_status→pending
 * - On FAILED: deposit_status→failed; user retries via waiting screen
 * - Market flag: momo_pay_now_delivery_enabled (default false) gates full pay-now UI
 * - Deposit fields remain optional/defensive for backward compatibility
 */
import { useCallback, useRef, useState } from 'react';
import type { ResolvedCheckoutConfig } from '../types/checkout';
import type { CreateOrderPayload, CreatedOrder, CreateOrderResponse } from '../types/clientOrder';
import { agentApi } from '../services/agentApi';
import { checkoutAnalytics } from '../services/checkoutAnalytics';
import {
  createCheckoutSubmitLock,
  shouldKeepCheckoutSubmitting,
} from '../utils/checkoutSubmitLock';
import { useOrderStripePayment } from './useOrderStripePayment';

export type CheckoutOutcome =
  | {
      type: 'success';
      orderIds: string[];
      orderNumbers: string[];
      paymentRail: 'stripe' | 'mobile_money' | null;
      /** Manual capture: card authorized at checkout, charge happens later. */
      cardAuthorized?: boolean;
    }
  | { 
      type: 'pending'; 
      orderIds: string[]; 
      orderNumbers: string[]; 
      paymentRail: 'stripe' | 'mobile_money' | null;
      /** True when deposit collect started (navigate to MoMo await). */
      isDepositOrder?: boolean;
    }
  | { type: 'cancelled' }
  | { type: 'busy' }
  | { type: 'error'; message: string; code?: string }; // code e.g. MERCHANT_CLOSED

export interface SingleOrderOptions {
  payload: CreateOrderPayload;
  /** Pre-resolved config drives whether to present PaymentSheet or await MM. */
  resolvedConfig: ResolvedCheckoutConfig | null;
}

export interface CartOrdersOptions {
  /** One payload per business group. */
  payloads: CreateOrderPayload[];
  resolvedConfig: ResolvedCheckoutConfig | null;
}

export interface UseCheckoutOrchestratorResult {
  submitting: boolean;
  submitError: string | null;
  clearSubmitError: () => void;
  placeSingleOrder: (opts: SingleOrderOptions) => Promise<CheckoutOutcome>;
  placeCartOrders: (opts: CartOrdersOptions) => Promise<CheckoutOutcome>;
}

export function useCheckoutOrchestrator(): UseCheckoutOrchestratorResult {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLockRef = useRef(createCheckoutSubmitLock());
  const { pay: payWithStripe } = useOrderStripePayment();

  const settleSubmit = useCallback((outcome: CheckoutOutcome) => {
    if (shouldKeepCheckoutSubmitting(outcome.type)) return;
    submitLockRef.current.release();
    setSubmitting(false);
  }, []);

  const runExclusiveSubmit = useCallback(
    async (work: () => Promise<CheckoutOutcome>): Promise<CheckoutOutcome> => {
      if (!submitLockRef.current.tryAcquire()) return { type: 'busy' };
      setSubmitting(true);
      let outcome: CheckoutOutcome = {
        type: 'error',
        message: 'Failed to place order.',
      };
      try {
        outcome = await work();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to place order.';
        outcome = { type: 'error', message: msg };
      }
      settleSubmit(outcome);
      return outcome;
    },
    [settleSubmit]
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  const handleStripeOrder = useCallback(
    async (order: CreatedOrder): Promise<CheckoutOutcome> => {
      const clientSecret = order.payment_intent_client_secret;
      const orderIds = [order.id];
      const orderNumbers = [order.order_number ?? order.id];

      if (!clientSecret) {
        const walletPaid =
          order.payment_transaction?.mode === 'wallet' ||
          order.payment_transaction?.message === 'Paid from Rendasua account';
        if (walletPaid) {
          return {
            type: 'success',
            orderIds,
            orderNumbers,
            paymentRail: 'stripe',
          };
        }
        return {
          type: 'error',
          message:
            'Card payment could not be started. Your order was created but is still awaiting payment — please try again from the order details.',
          code: 'STRIPE_CLIENT_SECRET_MISSING',
        };
      }
      const transactionId = order.payment_transaction?.transaction_id ?? null;
      const outcome = await payWithStripe({
        clientSecret,
        transactionId: transactionId ?? undefined,
      });
      if (outcome.status === 'success') {
        return {
          type: 'success',
          orderIds: [order.id],
          orderNumbers: [order.order_number ?? order.id],
          paymentRail: 'stripe',
          cardAuthorized: false,
        };
      }
      if (outcome.status === 'authorized') {
        return {
          type: 'success',
          orderIds: [order.id],
          orderNumbers: [order.order_number ?? order.id],
          paymentRail: 'stripe',
          cardAuthorized: true,
        };
      }
      if (outcome.status === 'cancelled') return { type: 'cancelled' };
      if (outcome.status === 'pending') {
        return {
          type: 'pending',
          orderIds: [order.id],
          orderNumbers: [order.order_number ?? order.id],
          paymentRail: 'stripe',
        };
      }
      return {
        type: 'error',
        message: outcome.message || 'Card payment failed. Please try again.',
        code: 'STRIPE_PAYMENT_FAILED',
      };
    },
    [payWithStripe]
  );

  const handleMoMoOrder = useCallback(
    async (order: CreatedOrder): Promise<CheckoutOutcome> => {
      if (order.payment_transaction?.success === false) {
        return {
          type: 'error',
          message: order.payment_transaction.message || 'Mobile Money payment could not be initiated.',
          code: 'PAYMENT_INITIATION_FAILED',
        };
      }
      
      // MoMo Deposit Collect (Backend #282 merged @ eb9cca31):
      // For pay_at_delivery/pickup MoMo orders with deposit:
      // - Order created in current_status=pending_payment
      // - Backend initiates MoMo collect during order creation (same create-order endpoint)
      // - Response includes payment_transaction (deposit collect started)
      // - deposit_status may be omitted on create; GET /orders/:id later shows pending
      // - Deposit orders identified by: deposit_amount > 0 OR deposit_mobile_payment_transaction_id present
      // - Navigate to MoMo await ONLY for deposit orders (non-deposit PAD/PAP must not await)
      // - Poll GET /orders/:id checks deposit_status: paid→success, failed→order cancelled
      // 
      // Deposit orders and full pay-now MoMo both use the same pending flow.
      // All deposit fields remain optional/defensive for backward compatibility.
      
      // Detect deposit order: has deposit_amount, deposit transaction ID, or deposit_status=pending
      // Nest #286 @ ed18c83f: create now includes deposit_status when deposit-required
      const isDepositOrder = Boolean(
        (order.deposit_amount != null && order.deposit_amount > 0) ||
        order.deposit_mobile_payment_transaction_id ||
        order.deposit_status === 'pending'
      );
      
      return { 
        type: 'pending', 
        orderIds: [order.id], 
        orderNumbers: [order.order_number ?? order.id], 
        paymentRail: 'mobile_money',
        isDepositOrder,
      };
    },
    []
  );

  const executeOrderResponse = useCallback(
    async (response: CreateOrderResponse, resolvedConfig: ResolvedCheckoutConfig | null): Promise<CheckoutOutcome> => {
      if (!response.success || !response.order) {
        const code = response.data?.errorCode ?? response.error;
        return {
          type: 'error',
          message: response.message || response.data?.message || response.error || 'Could not create order.',
          code,
        };
      }

      const order = response.order;
      const walletPaid =
        order.payment_transaction?.mode === 'wallet' ||
        order.payment_transaction?.message === 'Paid from Rendasua account';
      if (walletPaid) {
        return {
          type: 'success',
          orderIds: [order.id],
          orderNumbers: [order.order_number ?? order.id],
          paymentRail: order.payment_rail ?? null,
        };
      }

      const rail =
        order.payment_rail ?? resolvedConfig?.groups?.[0]?.payment_rail ?? null;

      if (rail === 'stripe') return handleStripeOrder(order);
      return handleMoMoOrder(order);
    },
    [handleStripeOrder, handleMoMoOrder]
  );

  const placeSingleOrder = useCallback(
    async ({ payload, resolvedConfig }: SingleOrderOptions): Promise<CheckoutOutcome> => {
      return runExclusiveSubmit(async () => {
        setSubmitError(null);
        checkoutAnalytics.checkoutPaymentStarted({
          checkout_mode: 'single',
          checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
          item_countries: resolvedConfig?.item_countries,
          delivery_country: resolvedConfig?.delivery_country,
        });
        try {
          const augmented: CreateOrderPayload =
            resolvedConfig?.checkout_method === 'STRIPE' && payload.payment_timing === 'pay_now'
              ? { ...payload, stripe_payment_method: 'payment_sheet' }
              : payload;

          const response = await agentApi.orders.createOrder(augmented);
          const outcome = await executeOrderResponse(response, resolvedConfig);
          if (outcome.type === 'error') {
            setSubmitError(outcome.message);
            checkoutAnalytics.checkoutFailed({
              checkout_mode: 'single',
              error_message: outcome.message,
              error_code: outcome.code,
              checkout_method: resolvedConfig?.checkout_method,
              item_countries: resolvedConfig?.item_countries,
            });
          } else if (outcome.type === 'success') {
            checkoutAnalytics.checkoutOrderCreated({
              checkout_mode: 'single',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              order_count: outcome.orderIds.length,
              order_ids: outcome.orderIds,
              item_countries: resolvedConfig?.item_countries,
            });
            checkoutAnalytics.checkoutPaymentCompleted({
              checkout_mode: 'single',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              item_countries: resolvedConfig?.item_countries,
            });
          } else if (outcome.type === 'pending') {
            checkoutAnalytics.checkoutPaymentPending({
              checkout_mode: 'single',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              item_countries: resolvedConfig?.item_countries,
            });
          }
          return outcome;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to place order.';
          const code =
            e instanceof Error && 'code' in e
              ? String((e as Error & { code?: string }).code || '')
              : undefined;
          setSubmitError(msg);
          checkoutAnalytics.checkoutFailed({
            checkout_mode: 'single',
            error_message: msg,
            checkout_method: resolvedConfig?.checkout_method,
            item_countries: resolvedConfig?.item_countries,
          });
          return { type: 'error', message: msg, code: code || undefined };
        }
      });
    },
    [executeOrderResponse, runExclusiveSubmit]
  );

  const placeCartOrders = useCallback(
    async ({ payloads, resolvedConfig }: CartOrdersOptions): Promise<CheckoutOutcome> => {
      if (payloads.length === 0) return { type: 'error', message: 'No orders to place.' };

      return runExclusiveSubmit(async () => {
        setSubmitError(null);
        checkoutAnalytics.checkoutPaymentStarted({
          checkout_mode: 'cart',
          checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
          item_countries: resolvedConfig?.item_countries,
          delivery_country: resolvedConfig?.delivery_country,
          cart_country_count: resolvedConfig?.item_countries?.length,
        });

        const orderIds: string[] = [];
        const orderNumbers: string[] = [];
        const isStripe = resolvedConfig?.checkout_method === 'STRIPE';
        let lastOutcome: CheckoutOutcome | null = null;

        try {
          for (const payload of payloads) {
            const augmented: CreateOrderPayload =
              isStripe && payload.payment_timing === 'pay_now'
                ? { ...payload, stripe_payment_method: 'payment_sheet' }
                : payload;

            const response = await agentApi.orders.createOrder(augmented);
            const outcome = await executeOrderResponse(response, resolvedConfig);

            if (outcome.type === 'error') {
              setSubmitError(outcome.message);
              checkoutAnalytics.checkoutFailed({
                checkout_mode: 'cart',
                error_message: outcome.message,
                error_code: outcome.code,
                checkout_method: resolvedConfig?.checkout_method,
                item_countries: resolvedConfig?.item_countries,
              });
              return outcome;
            }
            if (outcome.type === 'cancelled') return outcome;

            if (outcome.type === 'success' || outcome.type === 'pending') {
              orderIds.push(...outcome.orderIds);
              orderNumbers.push(...outcome.orderNumbers);
              lastOutcome = outcome;
            }
          }

          if (!lastOutcome) return { type: 'error', message: 'No orders were created.' };

          const finalOutcome: CheckoutOutcome =
            lastOutcome.type === 'success'
              ? {
                  type: 'success',
                  orderIds,
                  orderNumbers,
                  paymentRail: lastOutcome.paymentRail,
                  cardAuthorized: lastOutcome.cardAuthorized,
                }
              : { type: 'pending', orderIds, orderNumbers, paymentRail: lastOutcome.paymentRail };

          if (finalOutcome.type === 'success') {
            checkoutAnalytics.checkoutOrderCreated({
              checkout_mode: 'cart',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              order_count: orderIds.length,
              order_ids: orderIds,
              item_countries: resolvedConfig?.item_countries,
            });
            checkoutAnalytics.checkoutPaymentCompleted({
              checkout_mode: 'cart',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              item_countries: resolvedConfig?.item_countries,
            });
          } else {
            checkoutAnalytics.checkoutPaymentPending({
              checkout_mode: 'cart',
              checkout_method: resolvedConfig?.checkout_method ?? ('UNKNOWN' as any),
              item_countries: resolvedConfig?.item_countries,
            });
          }

          return finalOutcome;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to place orders.';
          const code =
            e instanceof Error && 'code' in e
              ? String((e as Error & { code?: string }).code || '')
              : undefined;
          setSubmitError(msg);
          checkoutAnalytics.checkoutFailed({
            checkout_mode: 'cart',
            error_message: msg,
            checkout_method: resolvedConfig?.checkout_method,
            item_countries: resolvedConfig?.item_countries,
          });
          return { type: 'error', message: msg, code: code || undefined };
        }
      });
    },
    [executeOrderResponse, runExclusiveSubmit]
  );

  return {
    submitting,
    submitError,
    clearSubmitError,
    placeSingleOrder,
    placeCartOrders,
  };
}
