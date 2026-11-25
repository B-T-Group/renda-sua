import type { RentalPricingSnapshotDto } from './dto/rental-pricing-snapshot.dto';
import { formatRentalAmount } from '../assistant/assistant-rental-format';

export function shouldNotifyPriceChange(quoted: unknown, accepted: unknown): boolean {
  if (quoted == null || quoted === '' || accepted == null || accepted === '') return false;
  const quote = Number(quoted);
  const next = Number(accepted);
  if (!Number.isFinite(quote) || !Number.isFinite(next)) return false;
  return Math.abs(quote - next) >= 0.01;
}

export function paymentBlockedUntilPriceSeen(input: {
  quoted: unknown;
  accepted: unknown;
  seenAt?: string | null;
}): boolean {
  if (!shouldNotifyPriceChange(input.quoted, input.accepted)) return false;
  return !input.seenAt;
}

const LINE_SLACK = 0.02;
/** The renter sees a changed price only after the business has accepted. */
export function businessChangedThePrice(status: string, quoted: unknown, accepted: unknown): boolean {
  return status === 'available' && shouldNotifyPriceChange(quoted, accepted);
}

export const TOTAL_OVERRIDE_RATIO = 10;

export function totalOverrideTooHigh(
  quote: number,
  totalOverride: number,
  ceiling: number | null = null
): boolean {
  if (!(totalOverride > quote)) return false;
  if (ceiling != null && totalOverride > ceiling) return true;
  if (!(quote > 0)) return false;
  return totalOverride > quote * TOTAL_OVERRIDE_RATIO;
}

export function quoteWithTotalOverride(
  computed: RentalPricingSnapshotDto,
  totalOverride: number | null | undefined,
  enabled: boolean,
  ceiling: number | null = null
): RentalPricingSnapshotDto {
  if (totalOverride == null) return computed;
  if (!enabled) throw new Error('TOTAL_OVERRIDE_DISABLED');
  if (!Number.isFinite(totalOverride) || totalOverride <= 0) throw new Error('TOTAL_OVERRIDE_INVALID');
  if (totalOverrideTooHigh(Number(computed.total), totalOverride, ceiling)) {
    throw new Error('TOTAL_OVERRIDE_TOO_HIGH');
  }
  return scaleSnapshotTotal(computed, Number(totalOverride.toFixed(2)));
}

function scaleSnapshotTotal(snapshot: RentalPricingSnapshotDto, total: number): RentalPricingSnapshotDto {
  const lines = snapshot.lines ?? [];
  const base = Number(snapshot.total);
  if (!(base > 0) || lines.length === 0) return { ...snapshot, total };
  return { ...snapshot, total, lines: scaledLines(lines, base, total) };
}

function scaledLines(
  lines: NonNullable<RentalPricingSnapshotDto['lines']>,
  base: number,
  total: number
): NonNullable<RentalPricingSnapshotDto['lines']> {
  let assigned = 0;
  return lines.map((line, index) => {
    if (index === lines.length - 1) {
      return { ...line, subtotal: Number((total - assigned).toFixed(2)) };
    }
    const subtotal = Number(((line.subtotal * total) / base).toFixed(2));
    assigned += subtotal;
    return { ...line, subtotal };
  });
}

export function applyAcceptedPrice(
  computed: RentalPricingSnapshotDto,
  override?: { total?: number; currency?: string; lines?: Array<{ subtotal?: number }> } | null
): { snapshot: RentalPricingSnapshotDto; currencyMismatch: boolean } {
  const total = override?.total;
  if (!usableTotal(total)) return { snapshot: computed, currencyMismatch: false };
  if (override?.currency && override.currency !== computed.currency) {
    return { snapshot: computed, currencyMismatch: true };
  }
  const lines = override?.lines;
  if (snapshotOmitsUnits(computed, { total, lines })) {
    return { snapshot: computed, currencyMismatch: false };
  }
  return {
    snapshot: { ...computed, total: Number(total.toFixed(2)) },
    currencyMismatch: false,
  };
}

function usableTotal(total: number | null | undefined): total is number {
  return total != null && Number.isFinite(total) && total >= 0;
}

/** Business apps send one-unit line subtotals. That is not a negotiated discount. */
function snapshotOmitsUnits(
  computed: RentalPricingSnapshotDto,
  override: { total?: number; lines?: Array<{ subtotal?: number }> }
): boolean {
  const units = Math.floor(Number(computed.unitsBooked));
  const sent = override.lines ?? [];
  const total = Number(override.total);
  if (units <= 1 || !sent.length || !closeMoney(sumSubtotals(sent), total)) return false;
  const priced = computed.lines ?? [];
  if (priced.length === sent.length) return sent.every((line, index) => scaledLine(line, priced[index], units));
  const scaled = Number((sumSubtotals(sent) * units).toFixed(2));
  return Math.abs(scaled - Number(computed.total)) <= LINE_SLACK * sent.length * units;
}

function scaledLine(
  sent: { subtotal?: number },
  priced: { subtotal?: number } | undefined,
  units: number
): boolean {
  const scaled = Number(((Number(sent.subtotal) || 0) * units).toFixed(2));
  return Math.abs(scaled - Number(priced?.subtotal)) <= LINE_SLACK * units;
}

function sumSubtotals(lines: Array<{ subtotal?: number }>): number {
  const sum = lines.reduce((total, line) => total + (Number(line.subtotal) || 0), 0);
  return Number(sum.toFixed(2));
}

function closeMoney(left: number, right: number): boolean {
  return Math.abs(left - right) <= LINE_SLACK;
}

export function priceChangeCopy(
  locale: 'en' | 'fr',
  itemName: string,
  quoted: number,
  accepted: number
): { pushTitle: string; pushBody: string; inApp: string } {
  const previous = formatRentalAmount(quoted, 'XAF');
  const next = formatRentalAmount(accepted, 'XAF');
  if (locale === 'fr') {
    return {
      pushTitle: 'Nouveau prix',
      pushBody: `Nouveau prix pour votre location de ${itemName}. Vérifiez-le avant de confirmer.`,
      inApp: `L'entreprise a modifié le prix : ${next} au lieu des ${previous} estimés. Vérifiez-le avant de confirmer.`,
    };
  }
  return {
    pushTitle: 'New price',
    pushBody: `New price for your ${itemName} rental. Check it before you confirm.`,
    inApp: `The business changed the price: ${next} instead of the estimated ${previous}. Check it before you confirm.`,
  };
}
