/**
 * Catalogue of "action in progress" loaders shared across personas.
 *
 * Each kind maps to a curated Lottie illustration (reused across related
 * actions) and a default localized caption. A kind without a Lottie asset
 * gracefully falls back to the indeterminate ring loader in the dialog.
 */
export type ActionLoadingKind =
  | 'claim'
  | 'claim_payment_request'
  | 'pick_up'
  | 'start_transit'
  | 'out_for_delivery'
  | 'drop_order'
  | 'batch_pick_up'
  | 'batch_start_transit'
  | 'batch_out_for_delivery'
  | 'complete_delivery'
  | 'confirm_order'
  | 'cancel_order'
  | 'refund'
  | 'ready_for_pickup'
  | 'request_pay_at_delivery'
  | 'request_pickup_payment'
  | 'mark_paid_cash'
  | 'reconcile_cash'
  | 'checkout_pay'
  | 'withdraw'
  | 'top_up'
  | 'stripe_onboard'
  | 'verify_otp'
  | 'submit_rating'
  | 'upload'
  | 'ai_generate'
  | 'image_cleanup'
  | 'generic_update';

import type { AnimationObject } from 'lottie-react-native';

// Shared Lottie sources (Metro bundles .json as a parsed object).
const DELIVERY = require('../../../assets/animations/delivery.json') as AnimationObject;
const PAYMENT = require('../../../assets/animations/payment.json') as AnimationObject;
const CONFIRM = require('../../../assets/animations/confirm.json') as AnimationObject;
const CANCEL = require('../../../assets/animations/cancel.json') as AnimationObject;
const LOADING = require('../../../assets/animations/loading.json') as AnimationObject;

/** Per-action Lottie source. Missing entries fall back to the ring loader. */
export const ACTION_LOTTIE: Partial<Record<ActionLoadingKind, AnimationObject>> = {
  claim: DELIVERY,
  claim_payment_request: DELIVERY,
  pick_up: DELIVERY,
  start_transit: DELIVERY,
  out_for_delivery: DELIVERY,
  drop_order: DELIVERY,
  batch_pick_up: DELIVERY,
  batch_start_transit: DELIVERY,
  batch_out_for_delivery: DELIVERY,
  ready_for_pickup: DELIVERY,
  confirm_order: CONFIRM,
  complete_delivery: CONFIRM,
  submit_rating: CONFIRM,
  cancel_order: CANCEL,
  refund: CANCEL,
  checkout_pay: PAYMENT,
  request_pay_at_delivery: PAYMENT,
  request_pickup_payment: PAYMENT,
  mark_paid_cash: PAYMENT,
  reconcile_cash: PAYMENT,
  withdraw: PAYMENT,
  top_up: PAYMENT,
  stripe_onboard: PAYMENT,
  verify_otp: LOADING,
  upload: LOADING,
  ai_generate: LOADING,
  image_cleanup: LOADING,
  generic_update: LOADING,
};

type Caption = { key: string; fallback: string };

/** Default i18n caption per action (overridable via the dialog `message` prop). */
export const ACTION_CAPTION: Record<ActionLoadingKind, Caption> = {
  claim: { key: 'actionLoading.claim', fallback: 'Claiming order…' },
  claim_payment_request: {
    key: 'actionLoading.claimPaymentRequest',
    fallback: 'Claiming order…',
  },
  pick_up: { key: 'actionLoading.pickUp', fallback: 'Picking up order…' },
  start_transit: {
    key: 'actionLoading.startTransit',
    fallback: 'Starting transit…',
  },
  out_for_delivery: {
    key: 'actionLoading.outForDelivery',
    fallback: 'Heading out for delivery…',
  },
  drop_order: { key: 'actionLoading.dropOrder', fallback: 'Dropping off order…' },
  batch_pick_up: {
    key: 'actionLoading.batchPickUp',
    fallback: 'Picking up orders…',
  },
  batch_start_transit: {
    key: 'actionLoading.batchStartTransit',
    fallback: 'Starting transit…',
  },
  batch_out_for_delivery: {
    key: 'actionLoading.batchOutForDelivery',
    fallback: 'Heading out for delivery…',
  },
  complete_delivery: {
    key: 'actionLoading.completeDelivery',
    fallback: 'Completing delivery…',
  },
  confirm_order: {
    key: 'actionLoading.confirmOrder',
    fallback: 'Confirming order…',
  },
  cancel_order: {
    key: 'actionLoading.cancelOrder',
    fallback: 'Cancelling order…',
  },
  refund: { key: 'actionLoading.refund', fallback: 'Processing refund…' },
  ready_for_pickup: {
    key: 'actionLoading.readyForPickup',
    fallback: 'Marking ready for pickup…',
  },
  request_pay_at_delivery: {
    key: 'actionLoading.requestPayAtDelivery',
    fallback: 'Requesting payment…',
  },
  request_pickup_payment: {
    key: 'actionLoading.requestPickupPayment',
    fallback: 'Requesting payment…',
  },
  mark_paid_cash: {
    key: 'actionLoading.markPaidCash',
    fallback: 'Recording cash payment…',
  },
  reconcile_cash: {
    key: 'actionLoading.reconcileCash',
    fallback: 'Reconciling cash…',
  },
  checkout_pay: { key: 'actionLoading.checkoutPay', fallback: 'Processing payment…' },
  withdraw: { key: 'actionLoading.withdraw', fallback: 'Processing withdrawal…' },
  top_up: { key: 'actionLoading.topUp', fallback: 'Topping up…' },
  stripe_onboard: {
    key: 'actionLoading.stripeOnboard',
    fallback: 'Connecting Stripe…',
  },
  verify_otp: { key: 'actionLoading.verifyOtp', fallback: 'Verifying code…' },
  submit_rating: { key: 'actionLoading.submitRating', fallback: 'Submitting rating…' },
  upload: { key: 'actionLoading.upload', fallback: 'Uploading…' },
  ai_generate: { key: 'actionLoading.aiGenerate', fallback: 'Generating…' },
  image_cleanup: { key: 'actionLoading.imageCleanup', fallback: 'Cleaning up image…' },
  generic_update: { key: 'actionLoading.generic', fallback: 'Working on it…' },
};

/** Collapse batch variants to their base action for shared visuals/captions. */
export function normalizeActionLoading(kind: ActionLoadingKind): ActionLoadingKind {
  switch (kind) {
    case 'batch_pick_up':
      return 'pick_up';
    case 'batch_start_transit':
      return 'start_transit';
    case 'batch_out_for_delivery':
      return 'out_for_delivery';
    default:
      return kind;
  }
}
