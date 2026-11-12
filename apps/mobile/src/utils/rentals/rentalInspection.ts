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
  claimedDamageAmount?: number | null;
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
    return { mode: 'ready', showCollectPayment: false, showStart: false, showOverwrite: false };
  }
  return {
    mode: input.submitted ? 'waiting' : 'capture',
    showCollectPayment: false,
    showStart: false,
    showOverwrite: false,
  };
}

export function notReceivedErrorKey(code: string | null | undefined): string {
  if (code === 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED') return 'rentalInspection.didntReceiveWindow';
  if (code === 'RENTAL_NOT_RECEIVED_NOT_INSPECTED') return 'rentalInspection.didntReceiveNotInspected';
  if (code === 'RENTAL_NOT_RECEIVED_ALREADY') return 'rentalInspection.didntReceiveAlready';
  return 'rentalInspection.didntReceiveStopped';
}

/** Retry only when the request never reached a definite rejection. */
export function notReceivedFailure(error: unknown): 'retry' | 'terminal' {
  const status = httpStatus(error);
  if (status == null || status >= 500) return 'retry';
  return 'terminal';
}

function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const response = (error as { response?: { status?: number } }).response;
  if (typeof response?.status === 'number') return response.status;
  const direct = (error as { status?: number }).status;
  return typeof direct === 'number' ? direct : null;
}

export function showDidntReceiveLink(input: {
  enrolled: boolean;
  startedAt: string | null | undefined;
  now?: number;
}): boolean {
  if (!input.enrolled) return false;
  return didntReceiveWindowOpen(input.startedAt, input.now ?? Date.now());
}

export function didntReceiveWindowOpen(
  startedAt: string | null | undefined,
  now = Date.now(),
  minutes = 30
): boolean {
  if (!startedAt) return false;
  const at = new Date(startedAt).getTime();
  if (!Number.isFinite(at)) return false;
  const elapsed = now - at;
  return elapsed >= 0 && elapsed <= minutes * 60000;
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

/** A new version is allowed until the client accepts or disputes this one. */
export function businessCanReplaceReport(view: { yourDecision?: string | null } | null): boolean {
  const decision = view?.yourDecision;
  return decision !== 'accept' && decision !== 'dispute';
}

export type ClientInspectionAction = 'review_pickup' | 'review_return' | 'none';

export function clientInspectionAction(input: {
  status: string;
  pickup: InspectionView | null;
  returnView: InspectionView | null;
}): ClientInspectionAction {
  const beforeStart = input.status === 'reserved' || input.status === 'confirmed';
  const pickupOpen = clientCanRespond(input.pickup) || input.pickup?.yourDecision === 'accept';
  if (beforeStart && pickupOpen && input.pickup?.status === 'submitted') return 'review_pickup';
  const during = input.status === 'active' || input.status === 'awaiting_return';
  if (during && clientCanRespond(input.returnView)) return 'review_return';
  return 'none';
}

export type InspectionErrorKind = 'update_required' | 'conflict' | 'unavailable' | 'other';

export function classifyInspectionError(error: unknown): InspectionErrorKind {
  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    response?: { status?: number; data?: { code?: string } };
  };
  const status = err?.status ?? err?.response?.status;
  const code = err?.code ?? err?.response?.data?.code;
  if (status === 426 || code === 'RENTAL_INSPECTION_UPDATE_REQUIRED') return 'update_required';
  if (status === 409 || code === 'RENTAL_ACCEPT_START_CONFLICT') return 'conflict';
  if (
    status === 503 ||
    status === 0 ||
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'RENTAL_INSPECTION_UNAVAILABLE' ||
    (status == null && /network/i.test(String(err?.message ?? '')))
  ) {
    return 'unavailable';
  }
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

export function unpaidCancelMinutesLeft(
  reservedCancelAfter: string | null | undefined,
  now = Date.now()
): number | null {
  if (!reservedCancelAfter) return null;
  const at = new Date(reservedCancelAfter).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 60000));
}

export function derivedOvertime(booking: {
  end_at?: string | null;
  return_handed_back_at?: string | null;
  units_booked?: number | string | null;
  overtime_amount_override?: number | string | null;
  rental_pricing_snapshot?: unknown;
}): { hours: number; amount: number; adjusted: boolean } | null {
  const end = booking.end_at ? new Date(booking.end_at).getTime() : Number.NaN;
  const back = booking.return_handed_back_at ? new Date(booking.return_handed_back_at).getTime() : Number.NaN;
  if (!Number.isFinite(end) || !Number.isFinite(back)) return null;
  const hours = Math.max(0, Math.ceil((back - end) / 3600000));
  const units = Math.max(1, Number(booking.units_booked) || 1);
  const snapshot = booking.rental_pricing_snapshot;
  const record = snapshot && typeof snapshot === 'object' ? snapshot as { ratePerHour?: number; lines?: Array<{ kind?: string; ratePerHour?: number }> } : null;
  const lines = record?.lines ?? [];
  const hourlyLine = lines.find((line) => line.kind === 'hourly');
  const hourly = Number(hourlyLine?.ratePerHour) || Number(record?.ratePerHour) || 0;
  const derived = Number((hours * hourly * units).toFixed(2));
  const override = booking.overtime_amount_override;
  if (override != null && override !== '' && Number.isFinite(Number(override))) {
    return { hours, amount: Math.max(0, Number(override)), adjusted: true };
  }
  return { hours, amount: derived, adjusted: false };
}
