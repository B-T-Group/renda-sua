import type { BusinessLocation, BusinessLocationAddress } from '../types/business/locations';
export { formatOperatingHoursSummary } from './operatingHours';

export function formatBusinessLocationAddress(address: BusinessLocationAddress | undefined): string {
  if (!address) return '';
  const parts = [
    address.address_line_1,
    address.city,
    address.state,
    address.postal_code,
  ].filter(Boolean);
  return parts.join(', ');
}

export function commissionDisplayLabel(
  pct: number | null | undefined,
  defaultLabel: string,
  customSuffix: string
): string {
  if (pct != null && Number.isFinite(pct)) {
    return `${pct}${customSuffix}`;
  }
  return defaultLabel;
}

export function parseCommissionInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function locationTypeLabelKey(type: BusinessLocation['location_type']): string {
  return `business.locations.${type}`;
}
