const PENDING_LIKE_ITEM_ID_KEY = 'rs_pending_like_item_id';
const PENDING_LIKE_AT_KEY = 'rs_pending_like_at';
const PENDING_LIKE_TTL_MS = 30 * 60 * 1000;

export function setPendingLikeItemId(itemId: string): void {
  try {
    sessionStorage.setItem(PENDING_LIKE_ITEM_ID_KEY, itemId);
    sessionStorage.setItem(PENDING_LIKE_AT_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

export function peekPendingLikeItemId(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_LIKE_ITEM_ID_KEY)?.trim() || null;
    if (!id) return null;
    const at = Number(sessionStorage.getItem(PENDING_LIKE_AT_KEY) || 0);
    if (!Number.isFinite(at) || Date.now() - at > PENDING_LIKE_TTL_MS) {
      sessionStorage.removeItem(PENDING_LIKE_ITEM_ID_KEY);
      sessionStorage.removeItem(PENDING_LIKE_AT_KEY);
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

export function consumePendingLikeItemId(): string | null {
  try {
    const id = peekPendingLikeItemId();
    sessionStorage.removeItem(PENDING_LIKE_ITEM_ID_KEY);
    sessionStorage.removeItem(PENDING_LIKE_AT_KEY);
    return id;
  } catch {
    return null;
  }
}

export function clearPendingLikeItemId(): void {
  try {
    sessionStorage.removeItem(PENDING_LIKE_ITEM_ID_KEY);
    sessionStorage.removeItem(PENDING_LIKE_AT_KEY);
  } catch {
    // ignore
  }
}
