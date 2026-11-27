/** 1500 -> "15", 1250 -> "12.5". Rates are whole basis points. */
export function commissionPercent(rateBps: number): string {
  return String(rateBps / 100);
}
