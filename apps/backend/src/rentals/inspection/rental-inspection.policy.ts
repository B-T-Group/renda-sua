import { createHash } from 'crypto';

/** Stamped on bookings created while the flag is on. NULL stays legacy. */
export const INSPECTION_POLICY_VERSION = 1;
export const STRIPE_AUTH_WINDOW_DAYS = 6;
export const DEFAULT_STRIPE_REVIEW_HOURS = 72;
export const DEFAULT_MIN_PHOTOS = 3;
export const DEFAULT_REMINDER_HOURS = 24;
export const DEFAULT_REVIEW_HOURS = 48;
export const RESERVED_UNPAID_GRACE_MINUTES = 60;
/** Sweep must not send a fresh overtime prompt on every pass. */
export const OVERTIME_PROMPT_BACKOFF_MS = 6 * 60 * 60 * 1000;
export const REQUIRED_PHOTO_ROLES = ['overview', 'other_side', 'accessories'] as const;

export const INSPECTION_CODES = {
  MULTI_WINDOW: 'RENTAL_INSPECTION_MULTI_WINDOW',
  SELF_RENTAL: 'RENTAL_INSPECTION_SELF_RENTAL',
  STRIPE_WINDOW: 'RENTAL_INSPECTION_STRIPE_WINDOW',
  PARTICIPANTS: 'RENTAL_INSPECTION_PARTICIPANTS',
  UPDATE_REQUIRED: 'RENTAL_INSPECTION_UPDATE_REQUIRED',
} as const;

export type InspectionRejectCode =
  (typeof INSPECTION_CODES)[keyof typeof INSPECTION_CODES];

export type EnrolmentDecision =
  | { outcome: 'legacy' }
  | { outcome: 'enrol'; policyVersion: number }
  | { outcome: 'reject'; code: InspectionRejectCode; message: string };

export interface EnrolmentInput {
  enabled: boolean;
  windowCount: number;
  clientUserId: string | null | undefined;
  businessUserId: string | null | undefined;
  rail: string;
  endAt: Date;
  now: Date;
  reviewHours?: number;
  authWindowDays?: number;
  /** Skip only the self-rental rejection. Other enrolment checks still apply. */
  allowSelfBooking?: boolean;
}

export function decideInspectionEnrolment(input: EnrolmentInput): EnrolmentDecision {
  if (!input.enabled) return { outcome: 'legacy' };
  if (!input.clientUserId || !input.businessUserId) {
    return reject(
      INSPECTION_CODES.PARTICIPANTS,
      'This booking is missing a client or business account, so it cannot use condition inspections.'
    );
  }
  if (input.clientUserId === input.businessUserId && !input.allowSelfBooking) {
    return reject(
      INSPECTION_CODES.SELF_RENTAL,
      'You cannot book your own listing while condition inspections are enabled.'
    );
  }
  if (input.windowCount > 1) {
    return reject(
      INSPECTION_CODES.MULTI_WINDOW,
      'Condition inspections do not support multi-window bookings yet. Book a single window.'
    );
  }
  if (input.rail === 'stripe' && !stripeReviewFits(input)) {
    return reject(
      INSPECTION_CODES.STRIPE_WINDOW,
      'Card payments for inspected rentals must end early enough that the 72-hour review still fits inside the 6-day card authorization.'
    );
  }
  return { outcome: 'enrol', policyVersion: INSPECTION_POLICY_VERSION };
}

export function stripeReviewFits(input: {
  endAt: Date;
  now: Date;
  reviewHours?: number;
  authWindowDays?: number;
}): boolean {
  const reviewMs = (input.reviewHours ?? DEFAULT_STRIPE_REVIEW_HOURS) * 3600000;
  const authMs = (input.authWindowDays ?? STRIPE_AUTH_WINDOW_DAYS) * 86400000;
  return input.endAt.getTime() + reviewMs <= input.now.getTime() + authMs;
}

export interface PickupGateBooking {
  inspectionPolicyVersion: number | null;
  pickupAckCurrent: boolean;
  pickupAcceptedVersionId: string | null;
  pickupCurrentVersionId: string | null;
}

/** True when a new version would undo a client accept, dispute, or settlement claim. */
export function inspectionSubmitLocked(
  booking: {
    pickupAckCurrent?: boolean | null;
    returnResolution?: string | null;
    settlementClaimedAt?: string | null;
  },
  stage: 'pickup' | 'return'
): boolean {
  if (booking.settlementClaimedAt) return true;
  if (stage === 'pickup') return !!booking.pickupAckCurrent;
  return ['accepted', 'disputed', 'review', 'admin_cleared'].includes(
    booking.returnResolution ?? ''
  );
}

/** Mirrors rental_mark_started. Legacy bookings are always allowed. */
export function pickupStartAllowed(booking: PickupGateBooking): boolean {
  if (booking.inspectionPolicyVersion == null) return true;
  return (
    booking.pickupAckCurrent &&
    !!booking.pickupAcceptedVersionId &&
    booking.pickupAcceptedVersionId === booking.pickupCurrentVersionId
  );
}

export const DIDNT_RECEIVE_WINDOW_MINUTES = 30;

export type AcceptStartPaymentRail = 'card' | 'wallet' | 'mobile_money';

export interface AcceptAndStartResult {
  success: true;
  accepted: true;
  started: boolean;
  alreadyStarted: boolean;
  paymentPending: boolean;
  payment_rail: AcceptStartPaymentRail;
  amount_due_at_pickup: number;
  bookingId: string;
}

/** Card is already authorized. Wallet covers the contract. Otherwise Mobile Money. */
export function acceptStartPaymentRail(input: {
  status: string;
  paymentStatus: string | null | undefined;
  walletCovers: boolean;
}): AcceptStartPaymentRail | null {
  if (input.status === 'confirmed' && input.paymentStatus === 'authorized') return 'card';
  if (input.status === 'confirmed' && input.paymentStatus === 'paid') return 'wallet';
  if (input.status !== 'reserved') return null;
  return input.walletCovers ? 'wallet' : 'mobile_money';
}

export function didntReceiveWindowOpen(
  startedAt: string | null | undefined,
  now: Date,
  minutes = DIDNT_RECEIVE_WINDOW_MINUTES
): boolean {
  if (!startedAt) return false;
  const at = new Date(startedAt).getTime();
  if (!Number.isFinite(at)) return false;
  const elapsed = now.getTime() - at;
  return elapsed >= 0 && elapsed <= minutes * 60000;
}

export interface SettlementGateBooking {
  inspectionPolicyVersion: number | null;
  returnHandedBackAt: string | null;
  returnResolution: string | null;
  settlementClaimedAt: string | null;
  settlementCompletedAt: string | null;
  openDispute: boolean;
  status: string;
  settlementAttention?: string | null;
  overtimePromptedAt?: string | null;
}

export type SettlementGate =
  | { state: 'legacy' }
  | { state: 'already' }
  | { state: 'resume' }
  | { state: 'ready' }
  | { state: 'blocked'; reason: string };

/** Mirrors rental_claim_inspection_settlement. */
export function settlementGate(booking: SettlementGateBooking): SettlementGate {
  if (booking.inspectionPolicyVersion == null) return { state: 'legacy' };
  if (booking.settlementCompletedAt) return { state: 'already' };
  if (booking.settlementClaimedAt) return { state: 'resume' };
  if (!booking.returnHandedBackAt) return blocked('handback_missing');
  if (booking.openDispute) return blocked('dispute_open');
  if (booking.returnResolution === 'pending') return blocked('ack_pending');
  if (booking.returnResolution === 'disputed' || booking.returnResolution === 'review') {
    return blocked('dispute_open');
  }
  if (booking.returnResolution !== 'accepted' && booking.returnResolution !== 'admin_cleared') {
    return blocked('ack_pending');
  }
  if (booking.status !== 'active' && booking.status !== 'awaiting_return') {
    return blocked('status');
  }
  return { state: 'ready' };
}

export interface CaptureInput {
  contract: number;
  overtime: number;
  deposit: number;
  authorized: number;
  damage: number;
  collectDamage: boolean;
}

export interface CaptureQuote {
  charge: number;
  overtimeTaken: number;
  damageTaken: number;
}

/** Stripe damage comes only from deposit left after overtime, and only inside the auth. */
export function priceEnrolledCapture(input: CaptureInput): CaptureQuote {
  const contract = round2(Math.max(0, input.contract));
  const deposit = round2(Math.max(0, input.deposit));
  const authorized = round2(Math.max(0, input.authorized));
  const extraRoom = round2(Math.min(deposit, Math.max(0, authorized - contract)));
  const overtimeTaken = round2(Math.min(Math.max(0, input.overtime), extraRoom));
  const damageTaken = input.collectDamage
    ? round2(Math.min(Math.max(0, input.damage), round2(extraRoom - overtimeTaken)))
    : 0;
  const charge = round2(Math.min(authorized, contract + overtimeTaken + damageTaken));
  return { charge, overtimeTaken, damageTaken };
}

export interface ReservedExpiryInput {
  now: Date;
  startAt: Date;
  policyVersion: number | null;
  pickupInspectionPending: boolean;
  reservedCancelAfter: Date | null;
  graceMinutes?: number;
}

/** Pause cancel while a pickup inspection is pending. After accept, use the stored deadline. */
export function reservedBookingExpired(input: ReservedExpiryInput): boolean {
  if (input.policyVersion != null && input.pickupInspectionPending) return false;
  const graceMs = (input.graceMinutes ?? RESERVED_UNPAID_GRACE_MINUTES) * 60000;
  const deadline =
    input.policyVersion != null && input.reservedCancelAfter
      ? input.reservedCancelAfter
      : new Date(input.startAt.getTime() + graceMs);
  return input.now.getTime() >= deadline.getTime();
}

/** Later of start+60 and accept+60. An early accept stays open until the start window. */
export function extendedReservedDeadline(startAt: Date, acceptedAt: Date): Date {
  const graceMs = RESERVED_UNPAID_GRACE_MINUTES * 60000;
  return new Date(Math.max(startAt.getTime() + graceMs, acceptedAt.getTime() + graceMs));
}

/**
 * Card "I agree" captures the business claim from the hold.
 * A later admin decision replaces that claim. Wallet and MoMo capture nothing.
 */
export function damageCollectedOnAgree(input: {
  paymentStatus: string | null;
  claimedAmount: number | null;
  upheldAmount: number;
  decision: string | null;
}): number {
  if (input.paymentStatus !== 'authorized') return 0;
  if (input.decision === 'damage_upheld') return round2(Math.max(0, input.upheldAmount));
  if (input.decision === 'no_damage' || input.decision === 'damage_rejected') return 0;
  const claimed = Number(input.claimedAmount);
  return Number.isFinite(claimed) && claimed > 0 ? round2(claimed) : 0;
}

export function missingPhotoRequirements(roles: string[], minPhotos: number): string[] {
  const floor = Math.max(DEFAULT_MIN_PHOTOS, minPhotos);
  const missing: string[] = REQUIRED_PHOTO_ROLES.filter((role) => !roles.includes(role));
  const counted = roles.filter((role) => role !== 'counter');
  if (counted.length < floor) missing.push('min_count');
  return missing;
}

export function unitDisplayLabel(slotIndex: number): string {
  return `Unit ${slotIndex}`;
}

/** Enrolled handback ignores any client-supplied time. */
export function enrolledHandbackAt(serverNow: Date): Date {
  return serverNow;
}

export interface InspectionViewUnit {
  unitId: string;
  slotIndex: number;
  displayLabel: string;
  physicalLabel: string | null;
  condition: string;
  accessories: unknown;
  wear: string;
  photos: Array<{ id: string; role: string }>;
}

export interface InspectionView {
  versionId: string | null;
  versionNo: number | null;
  allocationVersion: number | null;
  submittedAt: string | null;
  status: string;
  units: InspectionViewUnit[];
  yourDecision: string | null;
}

/** Report version numbers stay off the client payload. The version id is how they ack. */
export function presentInspection(
  view: InspectionView,
  audience: 'client' | 'business' | 'admin'
): Record<string, unknown> {
  const shared = {
    status: view.status,
    submittedAt: view.submittedAt,
    yourDecision: view.yourDecision,
    units: view.units,
    versionId: view.versionId,
  };
  if (audience === 'client') return shared;
  return {
    ...shared,
    versionNo: view.versionNo,
    allocationVersion: view.allocationVersion,
  };
}

export interface ManifestUnit {
  unitId: string;
  slotIndex: number;
  displayLabel: string;
  physicalLabel: string | null;
  condition: string;
  accessories: unknown;
  wear: string;
  photos: Array<{ id: string; role: string; sha256: string; bytes: number }>;
}

export function buildManifest(input: {
  stage: string;
  allocationVersion: number;
  units: ManifestUnit[];
}): { text: string; sha256: string } {
  const units = [...input.units].sort((a, b) => a.slotIndex - b.slotIndex);
  const text = stableStringify({
    allocationVersion: input.allocationVersion,
    stage: input.stage,
    units,
  });
  return { text, sha256: sha256Hex(text) };
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface PickupAckState {
  status: 'reserved' | 'confirmed' | 'active';
  currentVersionId: string | null;
  acceptedVersionId: string | null;
  ackCurrent: boolean;
  allocationVersion: number;
}

export function applyPickupSubmit(state: PickupAckState, versionId: string): PickupAckState {
  if (state.status === 'active') return state;
  return {
    ...state,
    currentVersionId: versionId,
    acceptedVersionId: null,
    ackCurrent: false,
  };
}

export function applyPickupAccept(
  state: PickupAckState,
  versionId: string,
  versionAllocation: number
): { state: PickupAckState; won: boolean } {
  const matches =
    state.status !== 'active' &&
    state.currentVersionId === versionId &&
    !state.ackCurrent &&
    versionAllocation === state.allocationVersion;
  if (!matches) return { state, won: false };
  return {
    won: true,
    state: { ...state, acceptedVersionId: versionId, ackCurrent: true },
  };
}

export function applyStart(state: PickupAckState): { state: PickupAckState; won: boolean } {
  const allowed = pickupStartAllowed({
    inspectionPolicyVersion: INSPECTION_POLICY_VERSION,
    pickupAckCurrent: state.ackCurrent,
    pickupAcceptedVersionId: state.acceptedVersionId,
    pickupCurrentVersionId: state.currentVersionId,
  });
  if (state.status !== 'confirmed' || !allowed) return { state, won: false };
  return { won: true, state: { ...state, status: 'active' } };
}

export interface ReturnMoneyState {
  resolution: string | null;
  handbackAt: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  openDispute: boolean;
  status: string;
}

export function applyDispute(state: ReturnMoneyState): { state: ReturnMoneyState; won: boolean } {
  const won =
    state.resolution === 'pending' && !state.claimedAt && !state.completedAt && !state.openDispute;
  if (!won) return { state, won: false };
  return {
    won: true,
    state: { ...state, resolution: 'disputed', openDispute: true },
  };
}

export function applySettlementClaim(
  state: ReturnMoneyState
): { state: ReturnMoneyState; won: boolean } {
  const gate = settlementGate({
    inspectionPolicyVersion: INSPECTION_POLICY_VERSION,
    returnHandedBackAt: state.handbackAt,
    returnResolution: state.resolution,
    settlementClaimedAt: state.claimedAt,
    settlementCompletedAt: state.completedAt,
    openDispute: state.openDispute,
    status: state.status,
  });
  if (gate.state !== 'ready') return { state, won: false };
  return { won: true, state: { ...state, claimedAt: 'claimed' } };
}

function reject(code: InspectionRejectCode, message: string): EnrolmentDecision {
  return { outcome: 'reject', code, message };
}

function blocked(reason: string): SettlementGate {
  return { state: 'blocked', reason };
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
