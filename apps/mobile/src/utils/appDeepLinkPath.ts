/** True for /app/foods and /app/foods/:id — guests can open these without signing in. */
export function isGuestAccessibleDeepLinkPath(path: string): boolean {
  const head = path.split('/').filter(Boolean)[0];
  return head === 'foods';
}
