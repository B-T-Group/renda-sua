/**
 * True for /app/foods, /app/foods/:id, /store/:id and public item links
 * (/items/:id[/seo], path `item/:id`) — guests can open these without signing in.
 */
export function isGuestAccessibleDeepLinkPath(path: string): boolean {
  const [head, id] = path.split('/').filter(Boolean);
  return head === 'foods' || ((head === 'store' || head === 'item') && !!id);
}
