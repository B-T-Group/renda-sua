import type { PersonaSlug } from '../types/persona';
import { restockPathToTarget } from './restockDeepLink';

/** Public item share links: /items/:id and /items/:id/seo (not place_order etc.). */
const PUBLIC_ITEM_PATH = /^\/items\/([^/]+)(?:\/seo)?\/?$/;

/**
 * Parse https://…/app/…, https://…/store/:id, https://…/items/:id[/seo] and
 * rendasua://… into an app-relative path.
 *
 * Public item links map to the synthetic `item/:id` path (catalog item detail).
 * A plain `items/:id` path (from /app/items/:id or rendasua://items/:id) stays
 * the business AI proposal screen.
 */
export function extractAppPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = rawAppPath(parsed);
    if (!path) return null;
    return attachInspectionPersona(path, parsed);
  } catch {
    return null;
  }
}

function rawAppPath(parsed: URL): string | null {
  if (parsed.protocol === 'rendasua:') return pathFromScheme(parsed);
  if (parsed.pathname.startsWith('/app/')) {
    return parsed.pathname.replace(/^\/app\//, '').replace(/\/$/, '');
  }
  if (/^\/store\/[^/]+\/?$/.test(parsed.pathname)) {
    return parsed.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  const item = PUBLIC_ITEM_PATH.exec(parsed.pathname);
  if (item) return `item/${item[1]}`;
  return null;
}

/** Inspection pushes name the persona so the shell switches before the booking opens. */
function attachInspectionPersona(path: string, parsed: URL): string {
  if (!path.includes('rentals/bookings/')) return path;
  const persona = parsed.searchParams.get('persona');
  if (persona === 'client' || persona === 'business') return `${path}?persona=${persona}`;
  return path;
}

function pathFromScheme(parsed: URL): string | null {
  const host = parsed.hostname;
  const rest = parsed.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!host) return null;
  return rest ? `${host}/${rest}` : host;
}

/** Persona the deep link belongs to, or null to keep the active shell. */
export function targetPersonaForDeepLinkPath(path: string): PersonaSlug | null {
  const [clean, query = ''] = path.split('?');
  const persona = new URLSearchParams(query).get('persona');
  const segments = clean.split('/').filter(Boolean);
  if (
    (persona === 'client' || persona === 'business') &&
    segments[0] === 'rentals' &&
    segments[1] === 'bookings'
  ) {
    return persona;
  }
  const head = segments[0];
  if (head === 'admin' || head === 'items') return 'business';
  if (head === 'rentals' && segments[1] === 'requests') return 'business';
  if (head === 'deliveries') return 'agent';
  // Delivery-confirm links always open in the shopper (client) shell.
  if (head === 'orders' && segments[2] === 'confirm') return 'client';
  if (head === 'restock') return 'client';
  return null;
}

export type DeepLinkTarget =
  | { type: 'order'; id: string; openMessages: boolean }
  | { type: 'deliveryConfirm'; id: string }
  | { type: 'adminOrder'; id: string }
  | { type: 'whatsappInbox'; id: string }
  | { type: 'itemProposal'; id: string }
  | { type: 'wallet' }
  | { type: 'verification' }
  | { type: 'rentalRequests' }
  | { type: 'rental'; id: string }
  | { type: 'food'; id?: string }
  | { type: 'store'; id: string }
  | { type: 'inventoryItem'; id: string }
  | { type: 'restockItem'; itemId: string }
  | { type: 'restockLikes'; filter: 'all' | 'back_in_stock' }
  | { type: 'dedicatedAgents'; locationId: string }
  | { type: 'dedicatedApplicants'; locationId: string; postingId: string }
  | { type: 'dashboard' };

export function resolveDeepLinkTarget(path: string): DeepLinkTarget {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  return matchDeepLinkHead(segments) ?? { type: 'dashboard' };
}

function matchDeepLinkHead(segments: string[]): DeepLinkTarget | null {
  const [head, id, adminOrderId] = segments;
  if (head === 'restock') {
    const restock = restockPathToTarget(segments.join('/'));
    if (restock?.type === 'item') return { type: 'restockItem', itemId: restock.itemId };
    if (restock?.type === 'likes') return { type: 'restockLikes', filter: restock.filter };
    return null;
  }
  if (head === 'admin' && id === 'orders' && adminOrderId) {
    return { type: 'adminOrder', id: adminOrderId };
  }
  if (head === 'admin' && id === 'whatsapp' && adminOrderId) {
    return { type: 'whatsappInbox', id: adminOrderId };
  }
  if (head === 'orders' && id && segments[2] === 'confirm') {
    return { type: 'deliveryConfirm', id };
  }
  if (head === 'orders' && id) return { type: 'order', id, openMessages: false };
  if (head === 'deliveries' && id) {
    return { type: 'order', id, openMessages: false };
  }
  if (head === 'chat' && id) return { type: 'order', id, openMessages: true };
  if (head === 'items' && id) return { type: 'itemProposal', id };
  if (head === 'item' && id) return { type: 'inventoryItem', id };
  return matchDeepLinkRest(head, id, segments);
}

function matchDeepLinkRest(
  head: string | undefined,
  id: string | undefined,
  segments: string[]
): DeepLinkTarget | null {
  if (head === 'wallet') return { type: 'wallet' };
  if (head === 'verification') return { type: 'verification' };
  if (head === 'rentals' && segments[1] === 'requests') {
    return { type: 'rentalRequests' };
  }
  if (head === 'rentals' && segments[1] === 'bookings' && segments[2]) {
    return { type: 'rental', id: segments[2] };
  }
  if (head === 'rentals' && id) return { type: 'rental', id };
  if (head === 'foods') return { type: 'food', id };
  if (head === 'store' && id) return { type: 'store', id };
  if (head === 'business' && segments[1] === 'locations' && segments[3] === 'dedicated-agents') {
    const locationId = segments[2];
    if (segments[4] === 'postings' && segments[5]) {
      return { type: 'dedicatedApplicants', locationId, postingId: segments[5] };
    }
    return { type: 'dedicatedAgents', locationId };
  }
  return null;
}
