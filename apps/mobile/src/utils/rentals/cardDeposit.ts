export function showsCardDeposit(currency: string | null | undefined): boolean {
  const code = (currency ?? '').trim().toUpperCase();
  return code !== 'XAF' && code !== 'XOF';
}

/** Empty XAF/XOF stays unset. Card listings still fall back to 8× hourly. */
export function depositOnSave(
  currency: string | null | undefined,
  raw: string,
  hourly: number
): number | undefined {
  const trimmed = raw.trim();
  if (!showsCardDeposit(currency)) return storedDeposit(trimmed);
  if (!trimmed) return hourlyDeposit(hourly);
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function hourlyDeposit(hourly: number): number | undefined {
  if (!Number.isFinite(hourly)) return undefined;
  return Number((hourly * 8).toFixed(2));
}

function storedDeposit(raw: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
