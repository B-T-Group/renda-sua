/** Card currencies keep a deposit. XAF and XOF rentals do not. */
export function isCardDepositCurrency(currency: string | null | undefined): boolean {
  const code = (currency ?? '').trim().toUpperCase();
  return code !== 'XAF' && code !== 'XOF';
}

/** Amount a renter may be shown. Mobile-money currencies are always 0. */
export function shownSecurityDeposit(currency: string | null | undefined, raw: unknown): number {
  if (!isCardDepositCurrency(currency)) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(2));
}
