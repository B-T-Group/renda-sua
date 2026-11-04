import { normalizeLanguage } from './email-template-data';

/** In-app message types seeded by 20261104200000_designated_agent_first. */
export const DESIGNATED_FIRST_MESSAGE_TYPES = {
  earlyOffer: 'DEDICATED_EARLY_OFFER',
  openOfferReminder: 'DEDICATED_OPEN_OFFER_REMINDER',
  pickupReminder: 'DEDICATED_PICKUP_REMINDER',
  unconfirmed: 'DEDICATED_UNCONFIRMED',
  lateRelease: 'DEDICATED_LATE_RELEASE',
} as const;

type Msg = { title: string; body: string };
const fmtKm = (km: number | null | undefined) => (km == null || !Number.isFinite(km) ? '?' : km.toFixed(1));
const fmtMoney = (amount: number | null | undefined, currency: string | null | undefined) =>
  amount == null ? '' : `${Math.round(amount)} ${currency ?? ''}`.trim();

/** "Tue 10 Nov" / "mar. 10 nov." in the store's time zone. */
export function designatedDateLabel(date: string, locale: 'en' | 'fr'): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/** "09:00-12:00" from "09:00:00"/"12:00:00". */
export function designatedWindowLabel(start?: string | null, end?: string | null): string {
  const s = (start ?? '').slice(0, 5);
  const e = (end ?? '').slice(0, 5);
  return s && e ? `${s}-${e}` : s || '';
}

/** Early offer push (plan section 4): title with date + window, body with distances, area, earnings. */
export function buildDesignatedEarlyOfferMessage(p: {
  date: string;
  window: string;
  businessName: string;
  pickupKm: number | null;
  area: string;
  dropoffKm: number | null;
  commission: number | null;
  currency: string | null;
  preferredLanguage?: string | null;
}): Msg {
  const locale = normalizeLanguage(p.preferredLanguage);
  const date = designatedDateLabel(p.date, locale);
  const earn = fmtMoney(p.commission, p.currency);
  if (locale === 'fr') {
    return {
      title: `Nouvelle commande pour vous, ${date} ${p.window}`.trim(),
      body: `Retrait ${p.businessName} (${fmtKm(p.pickupKm)} km) → ${p.area} (${fmtKm(p.dropoffKm)} km)${earn ? ` · Gain ${earn}` : ''}`,
    };
  }
  return {
    title: `New order for you, ${date} ${p.window}`.trim(),
    body: `Pickup ${p.businessName} (${fmtKm(p.pickupKm)} km) → ${p.area} (${fmtKm(p.dropoffKm)} km)${earn ? ` · Earn ${earn}` : ''}`,
  };
}

/** Open early offer, ~12 min before the gate. */
export function buildDesignatedOpenOfferReminderMessage(p: {
  businessName: string;
  gateTime: string;
  preferredLanguage?: string | null;
}): Msg {
  const locale = normalizeLanguage(p.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Commande toujours en attente',
      body: `Acceptez avant ${p.gateTime} la commande de ${p.businessName}, sinon elle sera proposée aux livreurs proches.`,
    };
  }
  return {
    title: 'Order still waiting for you',
    body: `Accept the ${p.businessName} order before ${p.gateTime}, or it goes to nearby agents.`,
  };
}

/** Evening-before and T-60 reminders for an accepted designated order. */
export function buildDesignatedPickupReminderMessage(p: {
  kind: 'evening' | 'soon';
  orderNumber: string;
  businessName: string;
  date: string;
  window: string;
  preferredLanguage?: string | null;
}): Msg {
  const locale = normalizeLanguage(p.preferredLanguage);
  const date = designatedDateLabel(p.date, locale);
  if (locale === 'fr') {
    return p.kind === 'evening'
      ? {
          title: 'Demain : livraison prévue',
          body: `Commande ${p.orderNumber} de ${p.businessName}, ${date} ${p.window}. Touchez « Toujours partant » ou « Je ne peux pas ».`,
        }
      : {
          title: 'Retrait dans 1 heure',
          body: `Commande ${p.orderNumber} de ${p.businessName} (${p.window}). Toujours partant ? Touchez pour confirmer ou libérer.`,
        };
  }
  return p.kind === 'evening'
    ? {
        title: 'Tomorrow: delivery scheduled',
        body: `Order ${p.orderNumber} from ${p.businessName}, ${date} ${p.window}. Tap "Still on it" or "Can't make it".`,
      }
    : {
        title: 'Pickup in 1 hour',
        body: `Order ${p.orderNumber} from ${p.businessName} (${p.window}). Still on it? Tap to confirm or release.`,
      };
}

/** Business: the designated agent did not confirm before the gate (flag only, no auto release). */
export function buildDesignatedUnconfirmedMessage(p: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): Msg {
  const locale = normalizeLanguage(p.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Livreur non confirmé',
      body: `Le livreur de la commande ${p.orderNumber} n'a pas encore confirmé. Nous suivons la situation.`,
    };
  }
  return {
    title: 'Agent not confirmed',
    body: `The agent for order ${p.orderNumber} hasn't confirmed yet. We're keeping an eye on it.`,
  };
}

/** Business: the designated agent released late; the order is back with nearby agents. */
export function buildDesignatedLateReleaseMessage(p: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): Msg {
  const locale = normalizeLanguage(p.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Nouveau livreur recherché',
      body: `Le livreur a libéré la commande ${p.orderNumber}. Nous la proposons aux livreurs proches.`,
    };
  }
  return {
    title: 'Finding a new agent',
    body: `The agent released order ${p.orderNumber}. We're offering it to nearby agents now.`,
  };
}
