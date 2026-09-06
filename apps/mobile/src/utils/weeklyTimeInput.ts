/** Parse HH:MM display input into HH:MM:SS for API storage. Returns null while incomplete/invalid. */
export function weeklyTimeInputToStorage(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/** Format stored HH:MM:SS as HH:MM for text fields. */
export function weeklyTimeStorageToInput(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return value.slice(0, 5);
}
