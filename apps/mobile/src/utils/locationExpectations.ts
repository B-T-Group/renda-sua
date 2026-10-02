import type { BusinessLocation } from '../types/business/locations';
import { maskPhoneE164 } from './maskPhoneE164';
import {
  formatOperatingHoursSummary,
  isAllDaysClosed,
} from './operatingHours';

export type ExpectationAction =
  | 'showLocation'
  | 'addPhone'
  | 'verifyPhone'
  | 'manageItems';

export interface LocationExpectationLine {
  id: string;
  tone: 'ok' | 'warning' | 'neutral';
  text: string;
  action?: ExpectationAction;
}

export interface LocationExpectationContext {
  isStripeRail: boolean;
  hasVerifiedPhone: boolean;
}

type TranslateFn = (
  key: string,
  defaultValue: string,
  options?: Record<string, string>
) => string;

type LocationSlice = Pick<
  BusinessLocation,
  | 'is_active'
  | 'operating_hours'
  | 'pay_at_confirm'
  | 'order_alert_phone'
  | 'auto_withdraw_commissions'
  | 'mobile_payment_phone'
  | 'mobile_payment_phone_id'
  | 'phone'
>;

export interface LocationExpectationsResult {
  lines: LocationExpectationLine[];
  footnote?: string;
}

function fill(
  template: string,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, value),
    template
  );
}

function visibilityLine(
  location: LocationSlice,
  t: TranslateFn
): LocationExpectationLine {
  if (location.is_active) {
    return {
      id: 'visibility',
      tone: 'ok',
      text: t(
        'business.locations.expectations.visible',
        'Customers can see and order from this location.'
      ),
    };
  }
  return {
    id: 'visibility',
    tone: 'warning',
    action: 'showLocation',
    text: t(
      'business.locations.expectations.hidden',
      "This location is hidden. Customers can't see its items or order from it."
    ),
  };
}

function hoursLine(
  location: LocationSlice,
  t: TranslateFn
): LocationExpectationLine {
  if (isAllDaysClosed(location.operating_hours)) {
    return {
      id: 'hours',
      tone: 'warning',
      text: t(
        'business.locations.expectations.closedEveryDay',
        "You're closed every day, so customers can't order."
      ),
    };
  }
  const hours = formatOperatingHoursSummary(location.operating_hours, t);
  return {
    id: 'hours',
    tone: 'neutral',
    text: fill(
      t(
        'business.locations.expectations.openHours',
        'Open {{hours}} (local time). Pickup and delivery times must fall inside these hours.'
      ),
      { hours }
    ),
  };
}

function payoutLine(
  location: LocationSlice,
  ctx: LocationExpectationContext,
  t: TranslateFn
): LocationExpectationLine | null {
  if (ctx.isStripeRail) return null;
  const phone =
    location.mobile_payment_phone?.phone_e164 ||
    (location.mobile_payment_phone_id ? location.phone : null);
  if (!phone || !ctx.hasVerifiedPhone) return unverifiedLine(!!phone, t);
  const auto = location.auto_withdraw_commissions
    ? t('business.locations.expectations.autoSuffix', ' automatically')
    : t('business.locations.expectations.manualSuffix', ' when you withdraw');
  return {
    id: 'payout',
    tone: 'ok',
    text: fill(
      t(
        'business.locations.expectations.paidOut',
        'Your sales are paid out to {{phone}}{{auto}}.'
      ),
      { phone: maskPhoneE164(phone), auto }
    ),
  };
}

function unverifiedLine(
  hasNumber: boolean,
  t: TranslateFn
): LocationExpectationLine {
  const verb = hasNumber
    ? t('business.locations.expectations.verifyVerb', 'verify')
    : t('business.locations.expectations.addVerb', 'add');
  return {
    id: 'payout',
    tone: 'warning',
    action: hasNumber ? 'verifyPhone' : 'addPhone',
    text: fill(
      t(
        'business.locations.expectations.needPhone',
        "Customers can't buy from this location until you {{action}} a Mobile Money number."
      ),
      { action: verb }
    ),
  };
}

function payLine(
  location: LocationSlice,
  ctx: LocationExpectationContext,
  t: TranslateFn
): LocationExpectationLine | null {
  if (ctx.isStripeRail) return null;
  if (location.pay_at_confirm) {
    return {
      id: 'pay',
      tone: 'neutral',
      text: t(
        'business.locations.expectations.payAfter',
        'Mobile Money orders: customers order first, you confirm, then they have 45 minutes to pay (3 hours for cooked food). They can\'t schedule for later.'
      ),
    };
  }
  return {
    id: 'pay',
    tone: 'neutral',
    text: t(
      'business.locations.expectations.payAsSet',
      'Customers pay as set on each item (for example when they order, or when they receive it). Cooked food is always paid after you confirm.'
    ),
  };
}

function alertLine(
  location: LocationSlice,
  t: TranslateFn
): LocationExpectationLine {
  const phone = location.order_alert_phone?.trim();
  if (phone) {
    return {
      id: 'alerts',
      tone: 'neutral',
      text: fill(
        t(
          'business.locations.expectations.alertPhone',
          'New orders also alert {{phone}}.'
        ),
        { phone: maskPhoneE164(phone) }
      ),
    };
  }
  return {
    id: 'alerts',
    tone: 'neutral',
    text: t(
      'business.locations.expectations.alertOwnerOnly',
      'New orders alert you. Add a kitchen or till phone to alert staff too.'
    ),
  };
}

function itemsLine(t: TranslateFn): LocationExpectationLine {
  return {
    id: 'items',
    tone: 'neutral',
    action: 'manageItems',
    text: t(
      'business.locations.expectations.itemsPointer',
      'Pickup, delivery and shipping are chosen on each item.'
    ),
  };
}

function rolloutFootnote(
  location: LocationSlice,
  ctx: LocationExpectationContext,
  t: TranslateFn
): string | undefined {
  if (ctx.isStripeRail || !location.pay_at_confirm) return undefined;
  return t(
    'business.locations.expectations.rolloutFootnote',
    "We're rolling this out gradually. Your choice is saved now and starts working as soon as it's available for your store."
  );
}

/** Plain-language lines for "What your customers will experience". */
export function buildLocationExpectations(
  location: LocationSlice,
  ctx: LocationExpectationContext,
  t: TranslateFn
): LocationExpectationsResult {
  const lines = [
    visibilityLine(location, t),
    hoursLine(location, t),
    payoutLine(location, ctx, t),
    payLine(location, ctx, t),
    alertLine(location, t),
    itemsLine(t),
  ].filter((line): line is LocationExpectationLine => line != null);
  return { lines, footnote: rolloutFootnote(location, ctx, t) };
}
