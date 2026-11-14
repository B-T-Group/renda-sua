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
