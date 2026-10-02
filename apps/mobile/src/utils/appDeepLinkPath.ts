/** True for /app/foods, /app/foods/:id and /store/:id — guests can open these without signing in. */
export function isGuestAccessibleDeepLinkPath(path: string): boolean {
  const [head, id] = path.split('/').filter(Boolean);
  return head === 'foods' || (head === 'store' && !!id);
}
