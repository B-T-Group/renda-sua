export type PaymentSetupLocationSignal = {
  id: string;
  viewCount: number;
  phoneVerified: boolean;
};

export type PaymentSetupSignal = {
  isStripeRail: boolean;
  stripeVerified: boolean;
  locations: PaymentSetupLocationSignal[];
};

/**
 * A merchant needs the payment-setup nudge when shoppers are viewing a
 * location that cannot take payment yet: Stripe Connect incomplete, or a
 * MoMo location with views but no confirmed payment phone.
 */
export function resolvePaymentSetupNudge(signal: PaymentSetupSignal): {
  needsPaymentSetupNudge: boolean;
  paymentSetupViewCount: number;
} {
  if (signal.isStripeRail) {
    if (signal.stripeVerified) {
      return { needsPaymentSetupNudge: false, paymentSetupViewCount: 0 };
    }
    const views = signal.locations.reduce((sum, l) => sum + l.viewCount, 0);
    return {
      needsPaymentSetupNudge: views > 0,
      paymentSetupViewCount: views,
    };
  }

  const incomplete = signal.locations.filter(
    (l) => l.viewCount > 0 && !l.phoneVerified
  );
  const views = incomplete.reduce((sum, l) => sum + l.viewCount, 0);
  return {
    needsPaymentSetupNudge: views > 0,
    paymentSetupViewCount: views,
  };
}
