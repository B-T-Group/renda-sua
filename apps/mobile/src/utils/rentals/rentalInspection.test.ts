import { describe, expect, it } from 'vitest';
import {
  allUnitsReviewed,
  businessCanReplaceReport,
  classifyInspectionError,
  clientInspectionAction,
  damageRail,
  derivedOvertime,
  handbackEnabled,
  isInspectionEnrolled,
  photoRolesForMinimum,
  pickupGate,
  reportReadyToSubmit,
  returnHasDamage,
  notReceivedErrorKey,
  notReceivedFailure,
  showDidntReceiveLink,
  showLegacyReturnPicker,
  unitPhotosMeetMinimum,
  type InspectionUnit,
  type InspectionView,
} from './rentalInspection';

const unit = (partial: Partial<InspectionUnit> = {}): InspectionUnit => ({
  unitId: 'u1',
  slotIndex: 1,
  displayLabel: 'Unit A',
  physicalLabel: null,
  condition: 'good',
  accessories: [],
  wear: 'none',
  photos: [
    { id: '1', role: 'overview' },
    { id: '2', role: 'other_side' },
    { id: '3', role: 'accessories' },
  ],
  ...partial,
});

const view = (partial: Partial<InspectionView> = {}): InspectionView => ({
  status: 'submitted',
  submittedAt: '2026-11-09T12:00:00Z',
  yourDecision: null,
  units: [unit()],
  versionId: 'ver-1',
  minPhotos: 3,
  ...partial,
});

describe('inspection enrolment', () => {
  it('treats a null policy as the legacy booking', () => {
    expect(isInspectionEnrolled({ inspection_policy_version: null })).toBe(false);
    expect(isInspectionEnrolled({})).toBe(false);
    expect(isInspectionEnrolled({ inspection_policy_version: 1 })).toBe(true);
  });

  it('keeps collect payment, start, and the support code on legacy bookings', () => {
    expect(pickupGate({ enrolled: false, status: 'reserved', submitted: false, accepted: false })).toEqual({
      mode: 'legacy',
      showCollectPayment: true,
      showStart: false,
      showOverwrite: false,
    });
    expect(pickupGate({ enrolled: false, status: 'confirmed', submitted: false, accepted: false }).showOverwrite).toBe(
      true
    );
    expect(showLegacyReturnPicker(false, 'active')).toBe(true);
  });
});

describe('enrolled pickup gate', () => {
  it('hides payment and the support code until the client accepts', () => {
    const waiting = pickupGate({ enrolled: true, status: 'reserved', submitted: true, accepted: false });
    expect(waiting.mode).toBe('waiting');
    expect(waiting.showCollectPayment).toBe(false);
    expect(waiting.showOverwrite).toBe(false);
    const ready = pickupGate({ enrolled: true, status: 'reserved', submitted: true, accepted: true });
    expect(ready.showCollectPayment).toBe(false);
    expect(ready.showStart).toBe(false);
    expect(pickupGate({ enrolled: true, status: 'confirmed', submitted: true, accepted: true })).toMatchObject({
      showStart: false,
      showOverwrite: false,
      showCollectPayment: false,
    });
  });

  it('asks the business to capture when nothing is submitted', () => {
    expect(pickupGate({ enrolled: true, status: 'confirmed', submitted: false, accepted: false }).mode).toBe('capture');
  });
});

describe('photos and handback', () => {
  it('reads the photo floor from the supplied minimum', () => {
    expect(photoRolesForMinimum(3)).toEqual(['overview', 'other_side', 'accessories']);
    expect(photoRolesForMinimum(4)).toEqual(['overview', 'other_side', 'accessories', 'wear']);
    expect(unitPhotosMeetMinimum(unit().photos, 4)).toBe(false);
    expect(unitPhotosMeetMinimum([...unit().photos, { id: '4', role: 'wear' }], 4)).toBe(true);
  });

  it('does not enable handback before every unit is in the submitted report', () => {
    expect(handbackEnabled(view(), 2)).toBe(false);
    expect(handbackEnabled(view({ status: 'draft', versionId: null }), 1)).toBe(false);
    expect(handbackEnabled(view(), 1)).toBe(true);
    expect(reportReadyToSubmit([unit({ wear: '' })], 3)).toBe(false);
    expect(reportReadyToSubmit([unit()], 3)).toBe(true);
  });
});

describe('client review and money copy', () => {
  it('asks for one accept after the pickup report, then the return report', () => {
    expect(
      clientInspectionAction({ status: 'confirmed', pickup: view(), returnView: null })
    ).toBe('review_pickup');
    expect(
      clientInspectionAction({
        status: 'awaiting_return',
        pickup: view({ yourDecision: 'accept' }),
        returnView: view(),
      })
    ).toBe('review_return');
    expect(allUnitsReviewed(['a', 'b'], new Set(['a']))).toBe(false);
    expect(
      clientInspectionAction({
        status: 'reserved',
        pickup: view({ yourDecision: 'accept' }),
        returnView: null,
      })
    ).toBe('review_pickup');
  });

  it('derives overtime from the server handback and keeps a support override read-only', () => {
    const end = '2026-11-09T16:00:00.000Z';
    const back = '2026-11-09T18:40:00.000Z';
    expect(
      derivedOvertime({
        end_at: end,
        return_handed_back_at: back,
        units_booked: 1,
        rental_pricing_snapshot: { ratePerHour: 4000 },
      })
    ).toEqual({ hours: 3, amount: 12000, adjusted: false });
    expect(
      derivedOvertime({
        end_at: end,
        return_handed_back_at: back,
        units_booked: 1,
        overtime_amount_override: 8000,
        rental_pricing_snapshot: { ratePerHour: 4000 },
      })?.adjusted
    ).toBe(true);
  });

  it('uses card copy only when a deposit is authorized', () => {
    expect(damageRail({ payment_status: 'authorized', security_deposit_amount: 80, authorized_amount: 100 })).toBe(
      'card'
    );
    expect(damageRail({ payment_status: 'paid', security_deposit_amount: 0, authorized_amount: 0 })).toBe('recorded');
    expect(returnHasDamage(view({ units: [unit({ condition: 'damaged' })] }))).toBe(true);
  });

  it('stops the business replacing a report after accept or dispute', () => {
    expect(businessCanReplaceReport(view())).toBe(true);
    expect(businessCanReplaceReport(view({ yourDecision: 'correction' }))).toBe(true);
    expect(businessCanReplaceReport(view({ yourDecision: 'accept' }))).toBe(false);
    expect(businessCanReplaceReport(view({ yourDecision: 'dispute' }))).toBe(false);
  });

  it('maps 426 and 409 to a refetch', () => {
    expect(classifyInspectionError({ status: 426, code: 'RENTAL_INSPECTION_UPDATE_REQUIRED' })).toBe(
      'update_required'
    );
    expect(classifyInspectionError({ response: { status: 409, data: { code: 'CONFLICT' } } })).toBe('conflict');
    expect(classifyInspectionError({ status: 400 })).toBe('other');
    expect(classifyInspectionError({ status: 503 })).toBe('unavailable');
    expect(classifyInspectionError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('unavailable');
  });

  it('shows Didn\'t receive only for an inspected rental in the first 30 minutes', () => {
    const start = '2026-11-12T14:20:00.000Z';
    const soon = new Date('2026-11-12T14:40:00.000Z').getTime();
    const late = new Date('2026-11-12T15:00:00.000Z').getTime();
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: soon })).toBe(true);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: late })).toBe(false);
    expect(showDidntReceiveLink({ enrolled: false, startedAt: start, now: soon })).toBe(false);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: null, now: soon })).toBe(false);
    const at = new Date(start).getTime();
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: at })).toBe(true);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: at + 30 * 60000 })).toBe(true);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: at + 30 * 60000 + 1 })).toBe(
      false
    );
    expect(showDidntReceiveLink({ enrolled: true, startedAt: start, now: at - 1 })).toBe(false);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: 'not-a-date', now: at })).toBe(false);
    expect(showDidntReceiveLink({ enrolled: true, startedAt: '', now: at })).toBe(false);
  });

  it('maps a not-received rejection to its message', () => {
    expect(notReceivedErrorKey('RENTAL_NOT_RECEIVED_WINDOW_CLOSED')).toBe(
      'rentalInspection.didntReceiveWindow'
    );
    expect(notReceivedErrorKey('RENTAL_NOT_RECEIVED_NOT_INSPECTED')).toBe(
      'rentalInspection.didntReceiveNotInspected'
    );
    expect(notReceivedErrorKey('RENTAL_NOT_RECEIVED_ALREADY')).toBe('rentalInspection.didntReceiveAlready');
    expect(notReceivedErrorKey(null)).toBe('rentalInspection.didntReceiveStopped');
    expect(notReceivedErrorKey('OTHER')).toBe('rentalInspection.didntReceiveStopped');
    expect(notReceivedFailure(null)).toBe('retry');
    expect(notReceivedFailure({ code: 'ERR_NETWORK' })).toBe('retry');
    expect(notReceivedFailure({ status: 500 })).toBe('retry');
    expect(notReceivedFailure({ response: { status: 503 } })).toBe('retry');
    expect(notReceivedFailure({ status: 401 })).toBe('terminal');
    expect(notReceivedFailure({ response: { status: 404 } })).toBe('terminal');
    expect(notReceivedFailure({ response: { status: 409, data: { code: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED' } } })).toBe(
      'terminal'
    );
  });
});
