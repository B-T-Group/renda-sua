import { HttpException } from '@nestjs/common';
import { PickupPhotoRulesService } from './pickup-photo-rules.service';
import {
  PICKUP_GUIDE_RETAKE_REQUIRED,
  PICKUP_GUIDE_SKIP_REASON,
  PICKUP_GUIDE_SLOT_REQUIRED,
  PICKUP_PHOTO_APP_ONLY,
  PICKUP_PHOTO_NOT_PICKUP_DAY,
} from './pickup-photo-rules';

const START = '2026-11-17T15:00:00.000Z';

function booking(country: string, startAt: string | null = START) {
  return {
    rental_bookings_by_pk: {
      id: '11111111-1111-4111-8111-111111111111',
      start_at: startAt,
      status: 'confirmed',
      business_id: 'biz-1',
      rental_location_listing_id: '22222222-2222-4222-8222-222222222222',
      inspection_policy_version: 1,
      rental_location_listing: { business_location: { address: { country } } },
    },
  };
}

function service(nowEnabled: boolean, rows: Record<string, unknown>, persona: { active_persona: string; businessId: string | null } = { active_persona: 'business', businessId: 'biz-1' }) {
  const hasura = {
    executeQuery: jest.fn(async (query: string) => {
      const name = Object.keys(rows).find((key) => query.includes(key));
      if (!name) throw new Error(query.slice(0, 80));
      return rows[name];
    }),
    executeMutation: jest.fn(async () => ({ update_rental_inspection_items: { affected_rows: 1 } })),
  };
  const flags = { pickupPhotoRulesEnabled: jest.fn(async () => nowEnabled) };
  const users = {
    getUser: jest.fn(async () => ({
      id: 'user-1',
      active_persona: persona.active_persona,
      business: persona.businessId ? { id: persona.businessId } : null,
    })),
  };
  const aws = { generatePresignedDownloadUrl: jest.fn(async () => ({ url: 'https://signed.example/photo', expiresAt: new Date() })) };
  const rules = new PickupPhotoRulesService(hasura as any, users as any, flags as any, aws as any);
  return { rules, hasura };
}

function codeOf(error: unknown): string {
  return (error as HttpException).getResponse()['code' as never] as string;
}

async function expectStatus(pending: Promise<unknown>, status: number) {
  try {
    await pending;
    throw new Error(`expected HTTP ${status}`);
  } catch (error: any) {
    if (error instanceof HttpException) expect(error.getStatus()).toBe(status);
    else throw error;
  }
}

describe('pickup photo upload gate', () => {
  const gate = { bookingId: '11111111-1111-4111-8111-111111111111', role: 'overview', platform: 'ios', slotKey: 'overview' };

  it('rejects Toronto just before midnight and allows the pickup day', async () => {
    const early = service(true, { PickupRulesBooking: booking('Canada') });
    await expect(early.rules.assertUpload(gate, new Date('2026-11-17T04:59:59.000Z'))).rejects.toBeInstanceOf(HttpException);
    await expect(early.rules.assertUpload(gate, new Date('2026-11-17T04:59:59.000Z'))).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_NOT_PICKUP_DAY }),
    });
    await expect(early.rules.assertUpload(gate, new Date('2026-11-17T05:00:00.000Z'))).resolves.toBeUndefined();
  });

  it('rejects Douala just before midnight and the day after', async () => {
    const rules = service(true, { PickupRulesBooking: booking('Cameroon') }).rules;
    await expect(rules.assertUpload(gate, new Date('2026-11-16T22:59:59.000Z'))).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_NOT_PICKUP_DAY }),
    });
    await expect(rules.assertUpload(gate, new Date('2026-11-16T23:00:00.000Z'))).resolves.toBeUndefined();
    await expect(rules.assertUpload(gate, new Date('2026-11-17T23:00:00.000Z'))).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_NOT_PICKUP_DAY }),
    });
  });

  it('rejects a web upload and a missing start only when the flag is on', async () => {
    const on = service(true, { PickupRulesBooking: booking('Canada') }).rules;
    await expect(on.assertUpload({ ...gate, platform: undefined }, new Date(START))).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_APP_ONLY }),
    });
    const noStart = service(true, { PickupRulesBooking: booking('Canada', null) }).rules;
    await expect(noStart.assertUpload(gate, new Date(START))).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_NOT_PICKUP_DAY }),
    });
    const off = service(false, { PickupRulesBooking: booking('Canada', null) }).rules;
    await expect(off.assertUpload({ ...gate, platform: 'web' }, new Date('2026-11-16T22:59:59.000Z'))).resolves.toBeUndefined();
  });
});

describe('guide retake gate and skip reason', () => {
  const version = {
    id: '33333333-3333-4333-8333-333333333333',
    submitted_at: '2026-11-10T15:00:00.000Z',
    items: [
      {
        unit_id: 'old-unit',
        condition: 'good',
        accessories: [],
        wear: 'none',
        checklist_note: 'Case scuffed',
        unit: { slot_index: 1 },
      },
    ],
  };
  const media = {
    rental_inspection_media: [
      { id: 'p1', unit_id: 'old-unit', role: 'overview', created_at: '2026-11-10T10:00:00.000Z', derivative_key: 'dev/rental-inspection/x/p1.view.jpg', object_key: 'orig' },
      { id: 'p2', unit_id: 'old-unit', role: 'other_side', created_at: '2026-11-10T10:01:00.000Z', derivative_key: null, object_key: 'dev/rental-inspection/x/p2.view.jpg' },
      { id: 'p3', unit_id: 'old-unit', role: 'accessories', created_at: '2026-11-10T10:02:00.000Z', derivative_key: null, object_key: null },
      { id: 'p4', unit_id: 'old-unit', role: 'wear', created_at: '2026-11-10T10:03:00.000Z', derivative_key: null, object_key: null },
    ],
  };

  function rows(photos: unknown, skips: unknown) {
    return {
      PickupRulesBooking: booking('Canada'),
      PickupRulesInspection: {
        rental_inspections: [{ id: 'ins-1', pickup_guide_mode: 'guide', pickup_guide_version_id: version.id }],
      },
      GuideVersion: { rental_inspection_versions: [version] },
      GuideMedia: media,
      PickupRulesUnits: { rental_booking_units: [{ id: 'unit-1' }] },
      PickupReadyPhotos: { rental_inspection_media: photos },
      PickupSlotSkips: { rental_inspection_slot_skips: skips },
    };
  }

  const ready = [
    { unit_id: 'unit-1', slot_key: 'overview', status: 'ready', captured_at: START },
    { unit_id: 'unit-1', slot_key: 'other_side', status: 'ready', captured_at: START },
    { unit_id: 'unit-1', slot_key: 'accessories', status: 'ready', captured_at: START },
  ];

  it('blocks submit while an extra guide slot is open', async () => {
    const rules = service(true, rows(ready, [])).rules;
    try {
      await rules.assertSubmit('11111111-1111-4111-8111-111111111111', 'pickup', new Date(START));
      throw new Error('expected retake');
    } catch (error: any) {
      expect(codeOf(error)).toBe(PICKUP_GUIDE_RETAKE_REQUIRED);
      expect(error.getResponse().missing).toEqual([{ unitId: 'unit-1', slotKey: 'extra:1', required: false }]);
    }
  });

  it('accepts a skip reason and stores it without copying photos', async () => {
    const built = service(true, {
      ...rows(ready, []),
      LatestReturnGuide: { rental_inspection_versions: [version] },
    });
    await expect(
      built.rules.skipSlot('11111111-1111-4111-8111-111111111111', 'unit-1', 'extra:1', 'Same as the overview')
    ).resolves.toEqual({ saved: true });
    const queries = built.hasura.executeMutation.mock.calls.map((call) => String(call[0]));
    expect(queries.some((query) => query.includes('insert_rental_inspection_media'))).toBe(false);
    expect(queries.some((query) => query.includes('InsertSlotSkip'))).toBe(true);
  });

  it('rejects a required slot and a blank reason', async () => {
    const rules = service(true, rows(ready, [])).rules;
    await expect(rules.skipSlot('11111111-1111-4111-8111-111111111111', 'unit-1', 'overview', 'no')).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_GUIDE_SLOT_REQUIRED }),
    });
    const blank = service(true, rows(ready, [])).rules;
    await expect(blank.skipSlot('11111111-1111-4111-8111-111111111111', 'unit-1', 'extra:1', '   ')).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_GUIDE_SKIP_REASON }),
    });
  });

  it('lets submit through once the extra angle is skipped and the stamp is on pickup day', async () => {
    const rules = service(true, rows(ready, [{ unit_id: 'unit-1', slot_key: 'extra:1', reason: 'Same as the overview' }])).rules;
    await expect(
      rules.assertSubmit('11111111-1111-4111-8111-111111111111', 'pickup', new Date(START))
    ).resolves.toBeUndefined();
  });

  it('copies the checklist and never inserts last-report media', async () => {
    const built = service(true, {
      ...rows([], []),
      LatestReturnGuide: { rental_inspection_versions: [version] },
    });
    const result = await built.rules.applyGuide('11111111-1111-4111-8111-111111111111', 'guide');
    const calls = built.hasura.executeMutation.mock.calls.map((call) => ({ query: String(call[0]), vars: call[1] }));
    expect(calls.some((call) => call.query.includes('insert_rental_inspection_media'))).toBe(false);
    expect(JSON.stringify(calls)).not.toContain('object_key');
    expect(calls.some((call) => call.query.includes('SaveGuideItem'))).toBe(true);
    expect(result.guide?.photoCount).toBe(4);
    expect(result.guide?.checkCount).toBe(4);
    expect(result.guide?.slots.some((slot) => slot.slotKey === 'extra:1' && slot.required === false)).toBe(true);
  });

  it('requires the default angles when the guide version is gone', async () => {
    const gone = {
      ...rows([], []),
      GuideVersion: { rental_inspection_versions: [] },
    };
    const cleared = {
      ...gone,
      PickupRulesInspection: {
        rental_inspections: [{ id: 'ins-1', pickup_guide_mode: 'guide', pickup_guide_version_id: null }],
      },
    };
    for (const table of [gone, cleared]) {
      try {
        await service(true, table).rules.assertSubmit('11111111-1111-4111-8111-111111111111', 'pickup', new Date(START));
        throw new Error('expected retake');
      } catch (error: any) {
        expect(codeOf(error)).toBe(PICKUP_GUIDE_RETAKE_REQUIRED);
        expect(error.getResponse().missing.map((row: { slotKey: string }) => row.slotKey)).toEqual([
          'overview',
          'other_side',
          'accessories',
        ]);
      }
    }
  });

  it('loads a stored guide only for this listing', async () => {
    const built = service(true, rows(ready, []));
    await built.rules.assertSubmit('11111111-1111-4111-8111-111111111111', 'pickup', new Date(START)).catch(() => undefined);
    const call = built.hasura.executeQuery.mock.calls.find((row) => String(row[0]).includes('GuideVersion'));
    expect(String(call?.[0])).toContain('rental_location_listing_id');
    expect(call?.[1]).toEqual(expect.objectContaining({ listingId: '22222222-2222-4222-8222-222222222222' }));
  });

  it('refuses a client, another business, and a unit from another booking', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const client = service(true, rows(ready, []), { active_persona: 'client', businessId: 'biz-1' });
    const other = service(true, rows(ready, []), { active_persona: 'business', businessId: 'biz-2' });
    await expect(client.rules.skipSlot(id, 'unit-1', 'extra:1', 'Same view')).rejects.toBeInstanceOf(HttpException);
    await expect(other.rules.getRules(id)).rejects.toBeInstanceOf(HttpException);
    const own = service(true, rows(ready, [])).rules;
    await expect(own.skipSlot(id, 'unit-9', 'extra:1', 'Same view')).rejects.toBeInstanceOf(HttpException);
    await expectStatus(client.rules.skipSlot(id, 'unit-1', 'extra:1', 'Same view'), 403);
    await expectStatus(other.rules.getRules(id), 403);
    await expectStatus(own.skipSlot(id, 'unit-9', 'extra:1', 'Same view'), 404);
  });

  it('stores a cleaned reason and updates it on a repeat skip', async () => {
    const built = service(true, rows(ready, []));
    const id = '11111111-1111-4111-8111-111111111111';
    await built.rules.skipSlot(id, 'unit-1', 'extra:1', 'Same\u0000 as the overview');
    await built.rules.skipSlot(id, 'unit-1', 'extra:1', 'Covered by the front');
    const writes = built.hasura.executeMutation.mock.calls.filter((call) => String(call[0]).includes('InsertSlotSkip'));
    expect(writes).toHaveLength(2);
    expect(String(writes[0][0])).toContain('on_conflict');
    expect(writes[0][1].object.reason).toBe('Same as the overview');
    expect(writes[1][1].object.reason).toBe('Covered by the front');
  });

  it('deletes a skip when that angle is taken instead', async () => {
    const built = service(true, rows(ready, []));
    const id = '11111111-1111-4111-8111-111111111111';
    await built.rules.clearSlot(id, 'unit-1', 'extra:1');
    const writes = built.hasura.executeMutation.mock.calls.filter((call) => String(call[0]).includes('ClearSlotSkip'));
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toEqual({ inspectionId: 'ins-1', unitId: 'unit-1', slotKey: 'extra:1' });
  });
});
