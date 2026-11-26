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

export type HoldPresentation =
  | { mode: 'sentence'; amount: number }
  | { mode: 'split'; total: number; deposit: number }
  | { mode: 'total'; amount: number };

/** One hold sentence, a total plus deposit, or the rental total when nothing is held. */
export function holdPresentation(input: {
  total: number;
  deposit: number;
  authorized: number;
}): HoldPresentation {
  const total = finiteAmount(input.total);
  const deposit = finiteAmount(input.deposit);
  const authorized = finiteAmount(input.authorized);
  if (cardHoldLines({ total, deposit, authorized }).additive) {
    return { mode: 'split', total, deposit };
  }
  if (authorized > 0) return { mode: 'sentence', amount: authorized };
  return { mode: 'total', amount: total };
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

/** Rates behind the default deposit. Missing `offersHourly` means the listing rents by the hour. */
export interface DepositRates {
  daily?: number;
  offersHourly?: boolean;
}

/**
 * Hour rate behind the default card deposit (8 × this rate). Same rule as the server
 * (`depositHourRate`): the hourly price when the listing rents by the hour and has one,
 * otherwise the day price ÷ 12, so a day-only listing defaults to ⅔ of its day price.
 */
export function depositHourRate(hourly: number, rates: DepositRates = {}): number {
  if (rates.offersHourly !== false && Number.isFinite(hourly) && hourly > 0) return hourly;
  const daily = Number(rates.daily);
  if (Number.isFinite(daily) && daily > 0) return daily / 12;
  return hourly;
}

/** Empty XAF/XOF stays unset. Empty card deposits use 8 × depositHourRate. */
export function depositOnSave(
  currency: string | null | undefined,
  raw: string,
  hourly: number,
  rates: DepositRates = {}
): number | undefined {
  const trimmed = raw.trim();
  if (!showsCardDeposit(currency)) return storedDeposit(trimmed);
  if (!trimmed) return defaultDeposit(depositHourRate(hourly, rates));
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function defaultDeposit(rate: number): number | undefined {
  if (!Number.isFinite(rate)) return undefined;
  return Number((rate * 8).toFixed(2));
}

function storedDeposit(raw: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
