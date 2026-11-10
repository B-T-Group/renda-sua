import { readFileSync } from 'fs';
import { join } from 'path';
import {
  INSPECTION_CODES,
  INSPECTION_POLICY_VERSION,
  applyDispute,
  applyPickupAccept,
  applyPickupSubmit,
  applySettlementClaim,
  applyStart,
  buildManifest,
  damageCollectedOnAgree,
  decideInspectionEnrolment,
  extendedReservedDeadline,
  missingPhotoRequirements,
  pickupStartAllowed,
  presentInspection,
  priceEnrolledCapture,
  reservedBookingExpired,
  settlementGate,
  stripeReviewFits,
  unitDisplayLabel,
  type PickupAckState,
  type ReturnMoneyState,
} from './rental-inspection.policy';

const NOW = new Date('2026-11-09T16:00:00.000Z');
const DAY = 86400000;

function enrol(overrides: Partial<Parameters<typeof decideInspectionEnrolment>[0]> = {}) {
  return decideInspectionEnrolment({
    enabled: true,
    windowCount: 1,
    clientUserId: 'client-user',
    businessUserId: 'business-user',
    rail: 'mobile_money',
    endAt: new Date(NOW.getTime() + 2 * DAY),
    now: NOW,
    ...overrides,
  });
}

describe('rental inspection enrolment', () => {
  it('leaves every booking on the legacy path while the flag is off', () => {
    expect(enrol({ enabled: false, windowCount: 3, clientUserId: 'same', businessUserId: 'same' })).toEqual({
      outcome: 'legacy',
    });
  });

  it('enrols a single-window booking between two people', () => {
    expect(enrol()).toEqual({ outcome: 'enrol', policyVersion: INSPECTION_POLICY_VERSION });
  });

  it('rejects multi-window bookings when inspections are on', () => {
    const decision = enrol({ windowCount: 2 });
    expect(decision).toMatchObject({ outcome: 'reject', code: INSPECTION_CODES.MULTI_WINDOW });
  });

  it('rejects a self-rental when inspections are on', () => {
    const decision = enrol({ clientUserId: 'same', businessUserId: 'same' });
    expect(decision).toMatchObject({ outcome: 'reject', code: INSPECTION_CODES.SELF_RENTAL });
  });

  it('rejects an enrolled card booking whose end plus 72h misses the 6-day auth window', () => {
    const endAt = new Date(NOW.getTime() + 4 * DAY);
    expect(stripeReviewFits({ endAt, now: NOW })).toBe(false);
    expect(enrol({ rail: 'stripe', endAt })).toMatchObject({
      outcome: 'reject',
      code: INSPECTION_CODES.STRIPE_WINDOW,
    });
  });

  it('enrols a card booking when the review still fits', () => {
    const endAt = new Date(NOW.getTime() + 2 * DAY);
    expect(stripeReviewFits({ endAt, now: NOW })).toBe(true);
    expect(enrol({ rail: 'stripe', endAt }).outcome).toBe('enrol');
  });

  it('does not apply the card window to wallet or mobile-money bookings', () => {
    const endAt = new Date(NOW.getTime() + 20 * DAY);
    expect(enrol({ rail: 'mobile_money', endAt }).outcome).toBe('enrol');
  });

  it('fails closed when a participant id is missing', () => {
    expect(enrol({ clientUserId: null }).outcome).toBe('reject');
  });
});

describe('pickup start gate', () => {
  const enrolled = {
    inspectionPolicyVersion: 1,
    pickupAckCurrent: false,
    pickupAcceptedVersionId: null,
    pickupCurrentVersionId: 'v1',
  };

  it('does not gate a legacy booking', () => {
    expect(pickupStartAllowed({ ...enrolled, inspectionPolicyVersion: null })).toBe(true);
  });

  it('blocks start until the client has accepted the current version', () => {
    expect(pickupStartAllowed(enrolled)).toBe(false);
    expect(
      pickupStartAllowed({
        ...enrolled,
        pickupAckCurrent: true,
        pickupAcceptedVersionId: 'v1',
        pickupCurrentVersionId: 'v2',
      })
    ).toBe(false);
  });

  it('allows start only for the accepted current version', () => {
    expect(
      pickupStartAllowed({
        ...enrolled,
        pickupAckCurrent: true,
        pickupAcceptedVersionId: 'v1',
        pickupCurrentVersionId: 'v1',
      })
    ).toBe(true);
  });
});

describe('ack versus start', () => {
  const open: PickupAckState = {
    status: 'confirmed',
    currentVersionId: 'v1',
    acceptedVersionId: null,
    ackCurrent: false,
    allocationVersion: 1,
  };

  it('a newer submit clears the acceptance before start can win', () => {
    const accepted = applyPickupAccept(open, 'v1', 1);
    expect(accepted.won).toBe(true);
    const revised = applyPickupSubmit(accepted.state, 'v2');
    expect(applyStart(revised).won).toBe(false);
  });

  it('accepting a stale version loses to the submit that already landed', () => {
    const revised = applyPickupSubmit(open, 'v2');
    expect(applyPickupAccept(revised, 'v1', 1).won).toBe(false);
    expect(applyStart(revised).won).toBe(false);
  });

  it('start wins when the acceptance still matches, and a later submit cannot rewind it', () => {
    const accepted = applyPickupAccept(open, 'v1', 1).state;
    const started = applyStart(accepted);
    expect(started.won).toBe(true);
    expect(applyPickupSubmit(started.state, 'v2').status).toBe('active');
  });

  it('does not accept a version from an older allocation', () => {
    expect(applyPickupAccept({ ...open, allocationVersion: 2 }, 'v1', 1).won).toBe(false);
  });
});

describe('dispute versus settlement', () => {
  const ready: ReturnMoneyState = {
    resolution: 'accepted',
    handbackAt: NOW.toISOString(),
    claimedAt: null,
    completedAt: null,
    openDispute: false,
    status: 'awaiting_return',
  };

  it('does not claim while the renter has not answered', () => {
    expect(settlementGate(gate({ ...ready, resolution: 'pending' })).state).toBe('blocked');
  });

  it('a dispute opened before the claim blocks settlement', () => {
    const pending = { ...ready, resolution: 'pending' };
    const disputed = applyDispute(pending);
    expect(disputed.won).toBe(true);
    expect(applySettlementClaim(disputed.state).won).toBe(false);
  });

  it('a claim that lands first cannot be disputed afterwards', () => {
    const claimed = applySettlementClaim(ready);
    expect(claimed.won).toBe(true);
    expect(applyDispute({ ...claimed.state, resolution: 'pending' }).won).toBe(false);
  });

  it('review escalation blocks settlement and is not an acceptance', () => {
    expect(settlementGate(gate({ ...ready, resolution: 'review' })).state).toBe('blocked');
  });

  it('an admin clearance can claim exactly once', () => {
    const cleared = { ...ready, resolution: 'admin_cleared' };
    expect(applySettlementClaim(cleared).won).toBe(true);
    expect(applySettlementClaim({ ...cleared, claimedAt: 'claimed' }).won).toBe(false);
    expect(settlementGate(gate({ ...cleared, claimedAt: 'claimed' })).state).toBe('resume');
    expect(settlementGate(gate({ ...cleared, completedAt: NOW.toISOString() })).state).toBe('already');
  });

  it('leaves legacy bookings on their existing settlement path', () => {
    expect(
      settlementGate({
        inspectionPolicyVersion: null,
        returnHandedBackAt: null,
        returnResolution: null,
        settlementClaimedAt: null,
        settlementCompletedAt: null,
        openDispute: false,
        status: 'active',
      }).state
    ).toBe('legacy');
  });
});

describe('damage capture', () => {
  const base = { contract: 100, overtime: 30, deposit: 80, authorized: 180, damage: 50 };

  it('keeps wallet and mobile-money damage as a record and does not add it to the charge', () => {
    const quote = priceEnrolledCapture({ ...base, collectDamage: false });
    expect(quote.damageTaken).toBe(0);
    expect(quote.overtimeTaken).toBe(30);
    expect(quote.charge).toBe(130);
  });

  it('takes Stripe damage only from the deposit left after overtime, inside the authorization', () => {
    const quote = priceEnrolledCapture({ ...base, collectDamage: true });
    expect(quote.overtimeTaken).toBe(30);
    expect(quote.damageTaken).toBe(50);
    expect(quote.charge).toBe(180);
  });

  it('drops damage that no longer fits in the deposit', () => {
    const quote = priceEnrolledCapture({
      ...base,
      overtime: 80,
      damage: 40,
      collectDamage: true,
    });
    expect(quote.overtimeTaken).toBe(80);
    expect(quote.damageTaken).toBe(0);
    expect(quote.charge).toBe(180);
  });
});

describe('damage collected when the client agrees', () => {
  it('captures the business claim from a card hold and records wallet claims only', () => {
    expect(
      damageCollectedOnAgree({
        paymentStatus: 'authorized',
        claimedAmount: 40,
        upheldAmount: 0,
        decision: null,
      })
    ).toBe(40);
    expect(
      damageCollectedOnAgree({
        paymentStatus: 'paid',
        claimedAmount: 25000,
        upheldAmount: 0,
        decision: null,
      })
    ).toBe(0);
  });

  it('uses an admin decision instead of the claim, and does not let a rejection fall back to the claim', () => {
    expect(
      damageCollectedOnAgree({
        paymentStatus: 'authorized',
        claimedAmount: 40,
        upheldAmount: 25,
        decision: 'damage_upheld',
      })
    ).toBe(25);
    expect(
      damageCollectedOnAgree({
        paymentStatus: 'authorized',
        claimedAmount: 40,
        upheldAmount: 0,
        decision: 'damage_rejected',
      })
    ).toBe(0);
  });
});

describe('reserved auto-cancel while pickup inspection is pending', () => {
  const startAt = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

  it('still cancels a legacy reservation 60 minutes after the start', () => {
    expect(
      reservedBookingExpired({
        now: NOW,
        startAt,
        policyVersion: null,
        pickupInspectionPending: false,
        reservedCancelAfter: null,
      })
    ).toBe(true);
  });

  it('pauses the cancel while the pickup inspection is pending', () => {
    expect(
      reservedBookingExpired({
        now: NOW,
        startAt,
        policyVersion: 1,
        pickupInspectionPending: true,
        reservedCancelAfter: null,
      })
    ).toBe(false);
  });

  it('starts the 60-minute clock when the client accepts, even if that is before the rental start', () => {
    const acceptedAt = new Date(startAt.getTime() - 3 * 60 * 60 * 1000);
    const deadline = extendedReservedDeadline(startAt, acceptedAt);
    expect(deadline.toISOString()).toBe(new Date(acceptedAt.getTime() + 60 * 60 * 1000).toISOString());
    expect(deadline.getTime()).toBeLessThan(startAt.getTime() + 60 * 60 * 1000);
    expect(
      reservedBookingExpired({
        now: new Date(acceptedAt.getTime() + 30 * 60 * 1000),
        startAt,
        policyVersion: 1,
        pickupInspectionPending: false,
        reservedCancelAfter: deadline,
      })
    ).toBe(false);
  });
});

describe('photos, labels, and client view', () => {
  it('requires overview, the other side, and accessories, and honours a higher minimum', () => {
    expect(missingPhotoRequirements(['overview', 'other_side'], 3)).toEqual([
      'accessories',
      'min_count',
    ]);
    expect(missingPhotoRequirements(['overview', 'other_side', 'accessories'], 4)).toEqual(['min_count']);
    expect(missingPhotoRequirements(['overview', 'other_side', 'accessories', 'wear'], 4)).toEqual([]);
  });

  it('labels slots Unit 1, Unit 2, Unit 3', () => {
    expect([1, 2, 3].map(unitDisplayLabel)).toEqual(['Unit 1', 'Unit 2', 'Unit 3']);
  });

  it('hides report version numbers from the client and shows them to the business', () => {
    const view = {
      versionId: 'ver',
      versionNo: 2,
      allocationVersion: 1,
      submittedAt: NOW.toISOString(),
      status: 'submitted',
      units: [],
      yourDecision: null,
    };
    expect(presentInspection(view, 'client')).not.toHaveProperty('versionNo');
    expect(presentInspection(view, 'business')).toMatchObject({ versionNo: 2 });
  });

  it('hashes a canonical manifest so key order does not change the digest', () => {
    const first = buildManifest({
      stage: 'pickup',
      allocationVersion: 1,
      units: [
        {
          unitId: 'u',
          slotIndex: 1,
          displayLabel: 'Unit A',
          physicalLabel: null,
          condition: 'good',
          accessories: [],
          wear: 'none',
          photos: [{ id: 'p', role: 'overview', sha256: 'abc', bytes: 10 }],
        },
      ],
    });
    const second = buildManifest({
      stage: 'pickup',
      allocationVersion: 1,
      units: [
        {
          slotIndex: 1,
          wear: 'none',
          unitId: 'u',
          displayLabel: 'Unit A',
          physicalLabel: null,
          condition: 'good',
          accessories: [],
          photos: [{ bytes: 10, sha256: 'abc', role: 'overview', id: 'p' }],
        } as any,
      ],
    });
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toHaveLength(64);
  });
});

describe('inspection SQL enforces the same gates', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../../hasura/migrations/Rendasua/20261109120000_rental_condition_inspections/up.sql'
    ),
    'utf8'
  );

  it('starts an enrolled booking only when the current pickup version is accepted', () => {
    expect(sql).toContain('pickup_ack_current = true');
    expect(sql).toContain('pickup_accepted_version_id IS NOT DISTINCT FROM pickup_current_version_id');
    expect(sql).toContain('inspection_policy_version IS NULL');
  });

  it('claims settlement only after handback, with no open dispute or pending acknowledgment', () => {
    expect(sql).toContain("return_resolution IN ('accepted', 'admin_cleared')");
    expect(sql).toContain('settlement_claimed_at IS NULL');
    expect(sql).toContain("d.status IN ('open', 'escalated')");
  });

  it('blocks edits to a submitted version and never deletes evidence rows', () => {
    expect(sql).toContain('rental_inspection_version_immutable');
    expect(sql).toContain('rental_inspection_media_immutable');
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
  });

  it('rejects damage_upheld without a positive damage amount', () => {
    expect(sql).toContain("p_outcome = 'damage_upheld' AND (p_damage IS NULL OR p_damage <= 0)");
    expect(sql).toContain("RAISE EXCEPTION 'rental_inspection_damage_amount'");
  });

  it('starts the unpaid clock when Collect payment opens', () => {
    const revised = readFileSync(
      join(__dirname, '../../../../hasura/migrations/Rendasua/20261110013000_rental_inspection_revised_flow/up.sql'),
      'utf8'
    );
    expect(revised).toContain("THEN now() + interval '60 minutes'");
    expect(revised).toContain('ADD COLUMN IF NOT EXISTS claimed_damage_amount numeric');
    expect(revised).toContain('ADD COLUMN IF NOT EXISTS overtime_amount_override numeric');
    expect(revised).not.toContain('GREATEST(start_at');
  });

  it('records handback at server time and keeps the flag off', () => {
    expect(sql).toContain('return_handed_back_at = v_at');
    expect(sql).toContain('actual_end_at = v_end');
    expect(sql).toContain('LEAST(v_at, COALESCE(v_reported, v_at))');
    expect(sql).toContain("'rental_inspection_enabled'");
    expect(sql).toMatch(/'rental_inspection_enabled'[\s\S]*false/);
  });
});

function gate(state: ReturnMoneyState) {
  return {
    inspectionPolicyVersion: 1 as number | null,
    returnHandedBackAt: state.handbackAt,
    returnResolution: state.resolution,
    settlementClaimedAt: state.claimedAt,
    settlementCompletedAt: state.completedAt,
    openDispute: state.openDispute,
    status: state.status,
  };
}
