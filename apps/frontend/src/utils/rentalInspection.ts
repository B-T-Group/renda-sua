export type InspectionStage = 'pickup' | 'return';

export type PhotoRole = 'overview' | 'other_side' | 'accessories' | 'wear' | 'counter';

export type DamageRail = 'card' | 'recorded';

export interface InspectionPhoto {
  id: string;
  role: string;
  url?: string;
  expiresAt?: string;
}

export interface InspectionAccessory {
  name: string;
  count: number;
}

export interface InspectionUnit {
  unitId: string;
  slotIndex: number;
  displayLabel: string;
  physicalLabel: string | null;
  condition: string;
  accessories: InspectionAccessory[];
  wear: string;
  photos: InspectionPhoto[];
}

export interface InspectionView {
  status: string;
  submittedAt: string | null;
  yourDecision: string | null;
  units: InspectionUnit[];
  versionId: string | null;
  versionNo?: number | null;
  allocationVersion?: number | null;
  minPhotos?: number;
  correctionReason?: string | null;
}

export const REQUIRED_PHOTO_ROLES: PhotoRole[] = ['overview', 'other_side', 'accessories'];

export const CORRECTION_REASON_CODES = [
  'missing_accessory',
  'photo_mismatch',
  'wear_hidden',
  'wrong_unit',
] as const;

export function isInspectionEnrolled(
  booking: { inspection_policy_version?: number | null } | null | undefined
): boolean {
  return booking?.inspection_policy_version != null;
}

/** Card damage comes only from the deposit. Wallet and Mobile Money are recorded. */
export function damageRail(booking: {
  payment_status?: string | null;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
}): DamageRail {
  if (booking.payment_status === 'authorized') return 'card';
  const deposit = Number(booking.security_deposit_amount) || 0;
  const authorized = Number(booking.authorized_amount) || 0;
  if (deposit > 0 && authorized > 0) return 'card';
  return 'recorded';
}

export function photoRolesForMinimum(minPhotos: number): PhotoRole[] {
  const roles: PhotoRole[] = [...REQUIRED_PHOTO_ROLES];
  const extra = Math.max(0, Math.floor(minPhotos) - REQUIRED_PHOTO_ROLES.length);
  for (let index = 0; index < extra; index += 1) roles.push('wear');
  return roles;
}

export function countedPhotoRoles(photos: Array<{ role: string }>): string[] {
  return photos.map((photo) => photo.role).filter((role) => role !== 'counter');
}

export function unitPhotosMeetMinimum(
  photos: Array<{ role: string }>,
  minPhotos: number
): boolean {
  if (!Number.isFinite(minPhotos) || minPhotos < 1) return false;
  const roles = countedPhotoRoles(photos);
  const missingRole = REQUIRED_PHOTO_ROLES.some((role) => !roles.includes(role));
  return !missingRole && roles.length >= minPhotos;
}

export function reportReadyToSubmit(units: InspectionUnit[], minPhotos: number): boolean {
  if (!units.length) return false;
  return units.every((unit) => unitReady(unit, minPhotos));
}

function unitReady(unit: InspectionUnit, minPhotos: number): boolean {
  const condition = unit.condition === 'good' || unit.condition === 'fair' || unit.condition === 'damaged';
  return condition && !!unit.wear?.trim() && unitPhotosMeetMinimum(unit.photos, minPhotos);
}

export interface PickupGateInput {
  enrolled: boolean;
  status: string;
  submitted: boolean;
  accepted: boolean;
}

export interface PickupGate {
  mode: 'legacy' | 'capture' | 'waiting' | 'ready';
  showCollectPayment: boolean;
  showStart: boolean;
  showOverwrite: boolean;
}

/** Legacy bookings keep today's payment, PIN, and support-code actions. */
export function pickupGate(input: PickupGateInput): PickupGate {
  const reserved = input.status === 'reserved';
  const confirmed = input.status === 'confirmed';
  if (!input.enrolled) {
    return {
      mode: 'legacy',
      showCollectPayment: reserved,
      showStart: confirmed,
      showOverwrite: confirmed,
    };
  }
  if (!reserved && !confirmed) {
    return { mode: 'ready', showCollectPayment: false, showStart: false, showOverwrite: false };
  }
  if (input.accepted) {
    return {
      mode: 'ready',
      showCollectPayment: reserved,
      showStart: confirmed,
      showOverwrite: confirmed,
    };
  }
  return {
    mode: input.submitted ? 'waiting' : 'capture',
    showCollectPayment: false,
    showStart: false,
    showOverwrite: false,
  };
}

export function showLegacyReturnPicker(enrolled: boolean, status: string): boolean {
  return !enrolled && (status === 'active' || status === 'awaiting_return');
}

export function showEnrolledReturn(enrolled: boolean, status: string): boolean {
  return enrolled && (status === 'active' || status === 'awaiting_return');
}

export function handbackEnabled(view: InspectionView | null, unitCount: number): boolean {
  if (!view || view.status !== 'submitted' || !view.versionId || !view.units.length) return false;
  if (unitCount > 0 && view.units.length < unitCount) return false;
  return view.units.every((unit) => !!unit.condition?.trim() && !!unit.wear?.trim());
}

export function returnHasDamage(view: InspectionView | null): boolean {
  return !!view?.units.some((unit) => unit.condition === 'damaged');
}

export function allUnitsReviewed(unitIds: string[], reviewed: ReadonlySet<string>): boolean {
  return unitIds.length > 0 && unitIds.every((id) => reviewed.has(id));
}

export function clientCanRespond(view: InspectionView | null): boolean {
  return !!view?.versionId && view.status === 'submitted' && !view.yourDecision;
}

export type ClientInspectionAction = 'review_pickup' | 'review_return' | 'none';

export function clientInspectionAction(input: {
  status: string;
  pickup: InspectionView | null;
  returnView: InspectionView | null;
}): ClientInspectionAction {
  const beforeStart = input.status === 'reserved' || input.status === 'confirmed';
  if (beforeStart && clientCanRespond(input.pickup)) return 'review_pickup';
  const during = input.status === 'active' || input.status === 'awaiting_return';
  if (during && clientCanRespond(input.returnView)) return 'review_return';
  return 'none';
}

export type InspectionErrorKind = 'update_required' | 'conflict' | 'other';

export function classifyInspectionError(error: unknown): InspectionErrorKind {
  const err = error as {
    status?: number;
    code?: string;
    response?: { status?: number; data?: { code?: string } };
  };
  const status = err?.status ?? err?.response?.status;
  const code = err?.code ?? err?.response?.data?.code;
  if (status === 426 || code === 'RENTAL_INSPECTION_UPDATE_REQUIRED') return 'update_required';
  if (status === 409) return 'conflict';
  return 'other';
}

export function normalizeAccessories(value: unknown): InspectionAccessory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const item = row as { name?: unknown; count?: unknown };
      return { name: String(item?.name ?? '').trim(), count: Number(item?.count) };
    })
    .filter((row) => row.name.length > 0 && Number.isInteger(row.count) && row.count >= 1);
}

export function correctionReasonText(
  codes: string[],
  details: string,
  labels: Record<string, string>
): string {
  const picked = codes.map((code) => labels[code] || code).filter((line) => line.trim());
  const note = details.trim();
  return [...picked, note].filter(Boolean).join('. ');
}

export function sameConditionPayload(pickup: InspectionUnit | undefined): {
  condition: 'good' | 'fair' | 'damaged';
  accessories: InspectionAccessory[];
  wear: string;
} {
  const condition = pickup?.condition;
  const safe = condition === 'fair' || condition === 'damaged' ? condition : 'good';
  return {
    condition: safe,
    accessories: pickup?.accessories ?? [],
    wear: pickup?.wear?.trim() || 'none',
  };
}
