import type { PersonaSlug } from '../types/persona';

/** Parse https://…/app/… and rendasua://… into an app-relative path. */
export function extractAppPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'rendasua:') return pathFromScheme(parsed);
    if (parsed.pathname.startsWith('/app/')) {
      return parsed.pathname.replace(/^\/app\//, '').replace(/\/$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

function pathFromScheme(parsed: URL): string | null {
  const host = parsed.hostname;
  const rest = parsed.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!host) return null;
  return rest ? `${host}/${rest}` : host;
}

/** Persona the deep link belongs to, or null to keep the active shell. */
export function targetPersonaForDeepLinkPath(path: string): PersonaSlug | null {
  const segments = path.split('/').filter(Boolean);
  const head = segments[0];
  if (head === 'admin' || head === 'items') return 'business';
  if (head === 'rentals' && segments[1] === 'requests') return 'business';
  if (head === 'deliveries') return 'agent';
  return null;
}

export type DeepLinkTarget =
  | { type: 'order'; id: string; openMessages: boolean }
  | { type: 'adminOrder'; id: string }
  | { type: 'whatsappInbox'; id: string }
  | { type: 'itemProposal'; id: string }
  | { type: 'wallet' }
  | { type: 'verification' }
  | { type: 'rentalRequests' }
  | { type: 'rental'; id: string }
  | { type: 'food'; id?: string }
  | { type: 'dashboard' };

export function resolveDeepLinkTarget(path: string): DeepLinkTarget {
  const segments = path.split('/').filter(Boolean);
  return matchDeepLinkHead(segments) ?? { type: 'dashboard' };
}

function matchDeepLinkHead(segments: string[]): DeepLinkTarget | null {
  const [head, id, adminOrderId] = segments;
  if (head === 'admin' && id === 'orders' && adminOrderId) {
    return { type: 'adminOrder', id: adminOrderId };
  }
  if (head === 'admin' && id === 'whatsapp' && adminOrderId) {
    return { type: 'whatsappInbox', id: adminOrderId };
  }
  if (head === 'orders' && id) return { type: 'order', id, openMessages: false };
  if (head === 'deliveries' && id) {
    return { type: 'order', id, openMessages: false };
  }
  if (head === 'chat' && id) return { type: 'order', id, openMessages: true };
  if (head === 'items' && id) return { type: 'itemProposal', id };
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
  if (head === 'rentals' && id) return { type: 'rental', id };
  if (head === 'foods') return { type: 'food', id };
  return null;
}
