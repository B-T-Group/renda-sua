/** Regional-indicator flag emoji from ISO 3166-1 alpha-2 (e.g. FR → 🇫🇷). */
export function isoToFlagEmoji(iso: string): string {
  const cc = iso.toUpperCase();
  if (cc.length !== 2) return '🏳️';
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(base + cc.charCodeAt(0)) + String.fromCodePoint(base + cc.charCodeAt(1));
}
