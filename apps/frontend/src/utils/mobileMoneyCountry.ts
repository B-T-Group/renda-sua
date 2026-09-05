/** MoMo catalog payments: default the country picker to the item/order location. */
export function pickMobileMoneyDefaultCountry(preferred?: string | null): 'CM' | 'GA' {
  const p = preferred?.trim().toUpperCase();
  if (p === 'CM' || p === 'GA') return p;
  return 'CM';
}
