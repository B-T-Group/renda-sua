/** Show a separate deposit only when it is the extra on top of the rental total. */
export function cardHoldLines(input: {
  total: number;
  deposit: number;
  authorized: number;
}): { showDeposit: boolean; additive: boolean } {
  const deposit = finiteAmount(input.deposit);
  const authorized = finiteAmount(input.authorized);
  const total = finiteAmount(input.total);
  const additive = deposit > 0 && Math.abs(authorized - (total + deposit)) < 0.01;
  return { showDeposit: additive, additive };
}

function finiteAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function holdCopyKey(additive: boolean, inspected: boolean): string {
  if (!additive) return 'rentals.bookingDetail.heldOnCard';
  return inspected
    ? 'rentals.bookingDetail.authorizedOnCardInspected'
    : 'rentals.bookingDetail.authorizedOnCard';
}

export function holdCopyFallback(additive: boolean, inspected: boolean): string {
  if (!additive) return '{{amount}} held on your card.';
  if (inspected) return inspectedHold;
  return plainHold;
}

const inspectedHold =
  "Held on your card: {{amount}} (rental + deposit). The rental is charged at return. The deposit is released unless there's damage or a late return.";
const plainHold =
  'Held on your card (rental + deposit): {{amount}}. The final charge at return is at least the rental total; the deposit only covers extra hours.';

export function showsCardDeposit(currency: string | null | undefined): boolean {
  const code = (currency ?? '').trim().toUpperCase();
  return code !== 'XAF' && code !== 'XOF';
}

/** Add-listing hides the field until the item currency has loaded. */
export function showsListingDeposit(currency: string | null | undefined): boolean {
  if (!(currency ?? '').trim()) return false;
  return showsCardDeposit(currency);
}

/** True when a card-currency deposit was typed but is not a number. */
export function depositInputError(currency: string | null | undefined, raw: string): boolean {
  if (!showsCardDeposit(currency)) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const value = Number(trimmed);
  return !Number.isFinite(value) || value < 0;
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
