import { RESTOCK_RULES, type RestockMessage } from './restock-alerts.types';

export interface Links {
  url: string;
  appLink: string;
  path: string;
}

const SMS_MAX = 160;

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, Math.max(1, max)).trimEnd();
}

/** Quantity is only told when it is low (AC-2.10). */
export function lowStockQty(available: number): number | null {
  return available >= 1 && available <= RESTOCK_RULES.lowStockMax ? available : null;
}

function fitSms(prefix: string, name: string, suffix: string, locale: 'en' | 'fr'): string {
  const fixed = (n: string) => `${prefix}${n}${suffix}`;
  let nm = name;
  while (fixed(nm).length > SMS_MAX && nm.length > 4) nm = clip(nm, nm.length - 4);
  const out = fixed(nm);
  return locale === 'fr' ? stripAccents(out) : out;
}

/**
 * Copy from the AC doc §6. Digest and single variants. SMS stays within one GSM-7
 * segment where possible: FR omits accents, item names are shortened to fit 160 chars.
 */
export function buildSingleMessage(params: {
  locale: 'en' | 'fr';
  itemName: string;
  storeName: string;
  available: number;
  links: Links;
}): RestockMessage {
  const { locale, links } = params;
  const item = params.itemName.trim() || (locale === 'fr' ? 'Article' : 'Item');
  const store = params.storeName.trim() || 'RendaSua';
  const n = lowStockQty(params.available);
  const fr = locale === 'fr';
  const title = fr ? `${item} est de retour` : `${item} is back`;
  const body =
    n != null
      ? fr
        ? `Plus que ${n} chez ${store}.`
        : `Only ${n} left at ${store}.`
      : fr
        ? `Disponible chez ${store}.`
        : `Available now at ${store}.`;
  const left = n != null ? (fr ? ` (${n} restant)` : ` (${n} left)`) : '';
  const sms = fr
    ? fitSms('RendaSua : ', item, ` est de retour chez ${store}${left}. ${links.url} Arret : repondez STOP`, 'fr')
    : fitSms('RendaSua: ', item, ` is back at ${store}${left}. ${links.url} Stop: reply STOP`, 'en');
  return {
    kind: 'single',
    push: { title, body },
    sms,
    whatsapp: { itemName: item, storeName: store },
    url: links.url,
    appLink: links.appLink,
    path: links.path,
  };
}

export function buildDigestMessage(params: {
  locale: 'en' | 'fr';
  count: number;
  links: Links;
}): RestockMessage {
  const { locale, count, links } = params;
  const fr = locale === 'fr';
  const title = fr
    ? `${count} articles que vous aimez sont de retour`
    : `${count} items you liked are back`;
  const body = fr
    ? 'Touchez pour voir ce qui est disponible.'
    : "Tap to see what's available.";
  const smsRaw = fr
    ? `RendaSua : ${count} articles que vous aimez sont de retour. ${links.url} Arret : repondez STOP`
    : `RendaSua: ${count} items you liked are back. ${links.url} Stop: reply STOP`;
  return {
    kind: 'digest',
    push: { title, body },
    sms: fr ? stripAccents(smsRaw) : smsRaw,
    whatsapp: { itemName: title, storeName: 'RendaSua' },
    url: links.url,
    appLink: links.appLink,
    path: links.path,
  };
}

export function qtyBucket(available: number): string {
  if (available <= 1) return '1';
  if (available <= 5) return '2-5';
  return '6+';
}

export const STOP_ACTION_TITLE = {
  en: 'Stop restock alerts',
  fr: 'Arrêter les alertes',
} as const;
