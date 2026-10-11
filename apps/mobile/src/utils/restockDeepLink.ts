import { RESTOCK_SRC } from './restockAlertsUi';

export type RestockLinkTarget =
  | { type: 'item'; itemId: string }
  | { type: 'likes'; filter: 'all' | 'back_in_stock' };

/**
 * Synthetic app paths used inside the deep link queue. A plain `items/:id` path
 * already means "business item proposal", so restock links get their own head.
 */
export function restockTargetToPath(target: RestockLinkTarget): string {
  return target.type === 'item'
    ? `restock/item/${target.itemId}`
    : `restock/likes/${target.filter}`;
}

export function restockPathToTarget(path: string): RestockLinkTarget | null {
  const [head, kind, id] = path.split('/').filter(Boolean);
  if (head !== 'restock') return null;
  if (kind === 'item' && id) return { type: 'item', itemId: id };
  if (kind === 'likes') {
    return { type: 'likes', filter: id === 'back_in_stock' ? 'back_in_stock' : 'all' };
  }
  return null;
}

/**
 * Recognises the links the backend builds for restock alerts:
 *   https://<web>/app/items/<catalogItemId>?src=restock_alert
 *   rendasua://items/<catalogItemId>?src=restock_alert
 *   https://<web>/app/likes?filter=back_in_stock&src=restock_alert
 *   rendasua://likes?filter=back_in_stock&src=restock_alert
 * Returns null for anything without `src=restock_alert`.
 */
export function parseRestockLink(url: string): RestockLinkTarget | null {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get('src') !== RESTOCK_SRC) return null;
    let segments: string[];
    if (parsed.protocol === 'rendasua:') {
      segments = [parsed.hostname, ...parsed.pathname.split('/')].filter(Boolean);
    } else if (parsed.pathname.startsWith('/app/')) {
      segments = parsed.pathname.replace(/^\/app\//, '').split('/').filter(Boolean);
    } else {
      segments = parsed.pathname.split('/').filter(Boolean);
    }
    const [head, id] = segments;
    if (head === 'items' && id) return { type: 'item', itemId: id };
    if (head === 'likes') {
      return {
        type: 'likes',
        filter: parsed.searchParams.get('filter') === 'back_in_stock' ? 'back_in_stock' : 'all',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export type RestockPushPayload = {
  kind: 'open';
  url: string;
  target: RestockLinkTarget;
} | { kind: 'stop'; token: string } | null;

export const STOP_ACTION_ID = 'stop_restock_alerts';
export const RESTOCK_PUSH_CATEGORY_ID = 'restock_alert';

/**
 * Parses an Expo notification response. Payload per contract §2:
 * data.type restock.alert | restock.digest, url, path, deepLink, stopToken.
 */
export function parseRestockPush(
  data: Record<string, unknown> | undefined,
  actionIdentifier?: string
): RestockPushPayload {
  if (!data) return null;
  const type = data.type;
  if (type !== 'restock.alert' && type !== 'restock.digest') return null;
  if (actionIdentifier === STOP_ACTION_ID) {
    return typeof data.stopToken === 'string' && data.stopToken
      ? { kind: 'stop', token: data.stopToken }
      : null;
  }
  const candidates = [data.deepLink, data.url];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const target = parseRestockLink(c);
    if (target) return { kind: 'open', url: c, target };
  }
  // Fallback: relative path (/items/<id>?src=restock_alert, /likes?...)
  if (typeof data.path === 'string') {
    const url = `rendasua://${data.path.replace(/^\//, '')}`;
    const target = parseRestockLink(url);
    if (target) return { kind: 'open', url, target };
  }
  // Digest without a parsable link still opens Likes > Back in stock.
  if (type === 'restock.digest') {
    return {
      kind: 'open',
      url: 'rendasua://likes?filter=back_in_stock&src=restock_alert',
      target: { type: 'likes', filter: 'back_in_stock' },
    };
  }
  return null;
}
