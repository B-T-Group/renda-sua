/**
 * Maps `supported_payment_systems.name` values to display labels/icons.
 * Unknown names fall back to a generic mobile-money entry.
 */

import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type PaymentMethodDisplay = {
  systemName: string;
  labelKey: string;
  labelDefault: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const KNOWN: Record<string, Omit<PaymentMethodDisplay, 'systemName'>> = {
  stripe: {
    labelKey: 'ftue.payments.stripe',
    labelDefault: 'Card / Stripe',
    icon: 'credit-card-outline',
  },
  freemopay: {
    labelKey: 'ftue.payments.mobileMoney',
    labelDefault: 'Mobile Money (MTN / Orange)',
    icon: 'cellphone',
  },
  mtn: {
    labelKey: 'ftue.payments.mtn',
    labelDefault: 'MTN Mobile Money',
    icon: 'cellphone',
  },
  orange: {
    labelKey: 'ftue.payments.orange',
    labelDefault: 'Orange Money',
    icon: 'cellphone',
  },
  airtel: {
    labelKey: 'ftue.payments.airtel',
    labelDefault: 'Airtel Money',
    icon: 'cellphone',
  },
  moov: {
    labelKey: 'ftue.payments.moov',
    labelDefault: 'Moov Money',
    icon: 'cellphone',
  },
  mypvit: {
    labelKey: 'ftue.payments.mobileMoney',
    labelDefault: 'Mobile Money (Airtel / Moov)',
    icon: 'cellphone',
  },
};

export const FALLBACK_PAYMENT_METHODS: PaymentMethodDisplay[] = [
  {
    systemName: 'mobile_money',
    labelKey: 'ftue.payments.mobileMoneyGeneric',
    labelDefault: 'Mobile Money',
    icon: 'cellphone',
  },
  {
    systemName: 'stripe',
    labelKey: 'ftue.payments.card',
    labelDefault: 'Bank card',
    icon: 'credit-card-outline',
  },
];

export const SHOPPING_FLEXIBILITY_EXTRAS: PaymentMethodDisplay[] = [
  {
    systemName: 'pay_at_delivery',
    labelKey: 'ftue.payments.payAtDelivery',
    labelDefault: 'Pay on delivery',
    icon: 'cash',
  },
  {
    systemName: 'delivery',
    labelKey: 'ftue.payments.delivery',
    labelDefault: 'Delivery',
    icon: 'truck-delivery-outline',
  },
  {
    systemName: 'pickup',
    labelKey: 'ftue.payments.pickup',
    labelDefault: 'Store pickup',
    icon: 'storefront-outline',
  },
];

export function toPaymentMethodDisplay(systemName: string): PaymentMethodDisplay {
  const key = systemName.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) return { systemName: key, ...known };
  return {
    systemName: key,
    labelKey: 'ftue.payments.mobileMoneyGeneric',
    labelDefault: systemName,
    icon: 'wallet-outline',
  };
}

export function resolvePaymentMethodDisplays(
  supportedPaymentMethods: string[] | null | undefined
): PaymentMethodDisplay[] {
  if (!supportedPaymentMethods?.length) {
    return [...FALLBACK_PAYMENT_METHODS, ...SHOPPING_FLEXIBILITY_EXTRAS];
  }
  const mapped = supportedPaymentMethods.map(toPaymentMethodDisplay);
  return [...mapped, ...SHOPPING_FLEXIBILITY_EXTRAS];
}
