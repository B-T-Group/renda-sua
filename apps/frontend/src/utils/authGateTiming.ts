export function msUntil(iso: string | undefined, fallbackMs: number): number {
  if (!iso) return fallbackMs;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return fallbackMs;
  return Math.max(0, parsed - Date.now());
}

export function formatTimerMmSs(totalMs: number): string {
  const totalSec = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
