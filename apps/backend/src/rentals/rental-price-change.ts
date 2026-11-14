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

export function applyAcceptedPrice(
  computed: RentalPricingSnapshotDto,
  override?: { total?: number; currency?: string } | null
): { snapshot: RentalPricingSnapshotDto; currencyMismatch: boolean } {
  if (override?.total == null || !Number.isFinite(override.total) || override.total < 0) {
    return { snapshot: computed, currencyMismatch: false };
  }
  if (override.currency && override.currency !== computed.currency) {
    return { snapshot: computed, currencyMismatch: true };
  }
  return {
    snapshot: { ...computed, total: Number(override.total.toFixed(2)) },
    currencyMismatch: false,
  };
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
