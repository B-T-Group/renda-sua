/** Relative last-used label inputs for saved account cards. */
export function formatLastUsed(lastUsedAt: number, now = Date.now()): string {
  const diffMs = now - lastUsedAt;
  if (diffMs < 60_000) return 'just_now';
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return mins <= 1 ? 'minute' : 'minutes';
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return hours <= 1 ? 'hour' : 'hours';
  }
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'days';
  return 'date';
}

export function formatLastUsedCount(lastUsedAt: number, now = Date.now()): number | undefined {
  const key = formatLastUsed(lastUsedAt, now);
  if (key === 'minutes') return Math.floor((now - lastUsedAt) / 60_000);
  if (key === 'hours') return Math.floor((now - lastUsedAt) / 3_600_000);
  if (key === 'days') return Math.floor((now - lastUsedAt) / 86_400_000);
  return undefined;
}
