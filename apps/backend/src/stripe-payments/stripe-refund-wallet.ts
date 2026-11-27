/** One wallet withdrawal per Stripe payment row. `charge.refunded` and direct refunds share it. */
export function stripeRefundWalletKey(stripeTransactionId: string): string {
  return `stripe-refund:${stripeTransactionId}`;
}
