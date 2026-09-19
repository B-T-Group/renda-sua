import { Alert, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface PurchaseCreditPreview {
  total: number;
  currency: string;
  allocations?: Array<{
    amount: number;
    applicability: string;
    businessId: string | null;
  }>;
}

type PayLater = 'delivery' | 'pickup' | null;

function scopeText(
  applicability: string,
  t: (key: string, fallback: string) => string
): string {
  if (applicability === 'specific_business') {
    return t('accounts.purchaseCredits.onePartner', 'One partner store');
  }
  if (applicability === 'partner_businesses') {
    return t('accounts.purchaseCredits.allPartners', 'Rendasua partner stores');
  }
  return t('accounts.purchaseCredits.anyStore', 'Any store');
}

export function appliedPurchaseCredit(input: {
  itemSubtotal: number;
  orderTotal: number;
  creditTotal: number;
  depositNow?: number | null;
}): { applied: number; remaining: number; dueAtFulfillment: number } {
  const cap = Math.min(Math.max(0, input.itemSubtotal), Math.max(0, input.orderTotal));
  const applied = Math.min(Math.max(0, input.creditTotal), cap);
  const remaining = Math.max(0, Number((input.orderTotal - applied).toFixed(2)));
  const deposit = input.depositNow && input.depositNow > 0 ? input.depositNow : 0;
  return {
    applied,
    remaining,
    dueAtFulfillment: Math.max(0, Number((remaining - deposit).toFixed(2))),
  };
}

function whenLabel(
  payLater: 'delivery' | 'pickup',
  t: (key: string, fallback: string) => string
): string {
  return payLater === 'delivery'
    ? t('accounts.purchaseCredits.whenDelivery', 'delivery')
    : t('accounts.purchaseCredits.whenPickup', 'pickup');
}

export function purchaseCreditPayCopy(input: {
  applied: number;
  due: number;
  depositNow: number;
  payLater: PayLater;
  formatAmount: (amount: number) => string;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}): string {
  const credit = input.formatAmount(input.applied);
  const amount = input.formatAmount(input.due);
  if (!input.payLater) return payNowCopy(input.due, credit, amount, input.t);
  return payLaterCopy(input, credit, amount);
}

function payNowCopy(
  due: number,
  credit: string,
  amount: string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  if (due <= 0) {
    return t('accounts.purchaseCredits.freeNow', 'Your purchase credit covers this order. Nothing to pay.');
  }
  return t(
    'accounts.purchaseCredits.payNowRemaining',
    '{{credit}} purchase credit is applied. You pay {{amount}} now.',
    { credit, amount }
  );
}

function payLaterCopy(
  input: {
    due: number;
    depositNow: number;
    payLater: 'delivery' | 'pickup' | null;
    formatAmount: (amount: number) => string;
    t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
  },
  credit: string,
  amount: string
): string {
  const when = whenLabel(input.payLater === 'pickup' ? 'pickup' : 'delivery', input.t);
  if (input.due <= 0 && input.depositNow > 0) {
    return input.t(
      'accounts.purchaseCredits.freeLaterDeposit',
      'Your purchase credit covers this order. Nothing to pay at {{when}}. You still pay the {{deposit}} deposit now.',
      { when, deposit: input.formatAmount(input.depositNow) }
    );
  }
  if (input.due <= 0) {
    return input.t(
      'accounts.purchaseCredits.freeLater',
      'Your purchase credit covers this order. Nothing to pay at {{when}}.',
      { when }
    );
  }
  return input.t(
    'accounts.purchaseCredits.payLater',
    '{{credit}} purchase credit is applied. You only pay {{amount}} at {{when}}.',
    { credit, amount, when }
  );
}

export function PurchaseCreditCheckoutNote({
  credits,
}: {
  credits?: PurchaseCreditPreview | null;
}) {
  const { t } = useTranslation();
  if (!credits?.total) return null;
  const scopes = (credits.allocations ?? [])
    .map((row) => scopeText(row.applicability, t))
    .filter((label, index, all) => all.indexOf(label) === index);
  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      <Typography variant="body2">
        {t('accounts.purchaseCredits.checkoutApply', '{{amount}} {{currency}} in purchase credits will apply', {
          amount: credits.total,
          currency: credits.currency,
        })}
      </Typography>
      {scopes.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {scopes.join(' · ')}
        </Typography>
      )}
    </Alert>
  );
}

export function PurchaseCreditPlaceOrderNote({
  applied,
  due,
  depositNow,
  payLater,
  formatAmount,
}: {
  applied: number;
  due: number;
  depositNow: number;
  payLater: PayLater;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();
  if (applied <= 0) return null;
  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      <Typography variant="body2" fontWeight="medium">
        {purchaseCreditPayCopy({ applied, due, depositNow, payLater, formatAmount, t })}
      </Typography>
    </Alert>
  );
}
