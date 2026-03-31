/**
 * Human-readable "time since" for pending payment rows (updates when `nowMs` changes).
 */
export function formatPendingDuration(
  createdAtIso: string,
  nowMs: number,
  locale: string
): string {
  const created = new Date(createdAtIso).getTime();
  if (Number.isNaN(created)) {
    return '—';
  }
  const diffSec = Math.max(0, Math.floor((nowMs - created) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSec < 60) {
    return rtf.format(-diffSec, 'second');
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute');
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 48) {
    return rtf.format(-diffHr, 'hour');
  }
  const diffDay = Math.floor(diffHr / 24);
  return rtf.format(-diffDay, 'day');
}
