import { HttpException } from '@nestjs/common';
import { photoSha256, stripPhoto } from './inspection-photo-bytes';
import { InspectionOptInService } from './inspection-optin.service';
import {
  INSPECTION_BASELINE_REQUIRED,
  PICKUP_PHOTO_AFTER_START,
  PICKUP_REUSE_BLOCKED_DAMAGE,
  baselineReady,
  isBeforeRentalStart,
  itemOptInStamps,
  optInCaptureColumns,
  optOutKeepsStamp,
  parseExifCapture,
  reuseChoice,
  reuseDamage,
} from './inspection-optin';
import { PickupPhotoRulesService } from './pickup-photo-rules.service';

const ITEM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const START = '2026-11-17T15:00:00.000Z';
const BEFORE = '2026-11-17T14:59:59.000Z';
const CLOCK = '2026-11-17T14:00:00.000Z';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('inspection opt-in rules', () => {
  it('stamps only an opted-in item with a full baseline', () => {
    expect(itemOptInStamps(true, true)).toBe(true);
    expect(itemOptInStamps(true, false)).toBe(false);
    expect(itemOptInStamps(false, true)).toBe(false);
    expect(baselineReady(['overview', 'other_side'])).toBe(false);
    expect(baselineReady(['overview', 'other_side', 'accessories'])).toBe(true);
  });

  it('keeps an existing booking stamp when the item opts out', () => {
    expect(optOutKeepsStamp(1)).toBe(1);
    expect(optOutKeepsStamp(null)).toBeNull();
  });

  it('accepts photos before start and rejects the start instant', () => {
    const start = new Date(START);
    expect(isBeforeRentalStart(start, new Date(BEFORE))).toBe(true);
    expect(isBeforeRentalStart(start, new Date(START))).toBe(false);
  });

  it('reuses only when every latest same-unit return is accepted and clean', () => {
    expect(reuseDamage({ claimed: 40, upheld: false, reported: false })).toBe('reported');
    expect(reuseDamage({ claimed: 0, upheld: true, reported: false })).toBe('upheld');
    const dirty = { clean: false };
    const clean = { clean: true };
    expect(reuseChoice({ returns: [clean, dirty], hasBaseline: true }).ok).toBe(false);
    expect(reuseChoice({ returns: [clean], hasBaseline: false })).toEqual({ ok: true, source: 'return' });
    expect(reuseChoice({ returns: [], hasBaseline: true })).toEqual({ ok: true, source: 'baseline' });
    expect(reuseChoice({ returns: [], hasBaseline: false })).toEqual({ ok: false, code: 'PICKUP_REUSE_UNAVAILABLE' });
  });

  it('shows the server receive time and only keeps a clamped EXIF time', () => {
    const clock = new Date(START);
    const exif = optInCaptureColumns({
      slotKey: 'overview',
      clock,
      timeZone: 'America/Toronto',
      exif: '2026:11:10 09:30:00',
      source: 'gallery',
    });
    expect(exif.captured_at).toBe(START);
    expect(exif.captured_at_source).toBe('upload');
    expect(exif.exif_captured_at).toBe('2026-11-10T14:30:00.000Z');
    expect(exif.capture_source).toBe('gallery');
    const future = optInCaptureColumns({
      slotKey: 'overview',
      clock,
      timeZone: 'America/Toronto',
      exif: '2030:01:01 00:00:00',
      platform: 'web',
    });
    expect(future.captured_at).toBe(START);
    expect(future.exif_captured_at).toBeNull();
    expect(future.captured_at_source).toBe('upload');
    expect(parseExifCapture('2026-11-10T14:30:00Z', 'America/Toronto')?.toISOString()).toBe('2026-11-10T14:30:00.000Z');
  });
});

describe('inspection opt-in service', () => {
  function harness(rows: Record<string, unknown>, optInOn = true) {
    const mutations: Array<{ query: string; variables: any }> = [];
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('ItemCountry')) {
          return { rental_location_listings: [{ business_location: { address: { country: 'Canada' } } }] };
        }
        const name = Object.keys(rows).find((key) => query.includes(key));
        if (!name) throw new Error(query.slice(0, 160));
        return rows[name];
      }),
      executeMutation: jest.fn(async (query: string, variables: any) => {
        mutations.push({ query, variables });
        const copies = Array.isArray(variables?.copies) ? variables.copies.length : 0;
        return {
          insert_rental_item_baseline_photos_one: { id: 'photo-1' },
          update_rental_items_by_pk: { id: ITEM },
          rental_apply_pickup_reuse: [copies],
        };
      }),
    };
    const users = {
      getUser: jest.fn(async () => ({ id: 'user-1', active_persona: 'business', business: { id: 'biz-1' } })),
    };
    const flags = { optInEnabled: jest.fn(async () => optInOn), pickupPhotoRulesEnabled: jest.fn(async () => false) };
    const aws = {
      generateStrictUploadUrl: jest.fn(async () => ({ url: 'https://upload.example', expiresAt: new Date() })),
      headObjectMeta: jest.fn(async () => ({ contentLength: 10, contentType: 'image/jpeg', versionId: null })),
      readObjectBytes: jest.fn(async () => PNG),
      putPrivateObject: jest.fn(async () => 'v1'),
      generatePresignedDownloadUrl: jest.fn(async () => ({ url: 'https://signed.example', expiresAt: new Date() })),
    };
    const payments = { resolveRailForCountry: jest.fn(async () => 'stripe') };
    const svc = new InspectionOptInService(hasura as any, users as any, flags as any, aws as any, payments as any);
    return { svc, mutations, hasura, flags, aws, users };
  }

  const item = {
    rental_items_by_pk: { id: ITEM, business_id: 'biz-1', inspection_opt_in: false, inspection_opted_in_at: null },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(CLOCK));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects opt-in without a full baseline and does not touch bookings', async () => {
    const { svc, mutations } = harness({
      OptInItem: item,
      ItemBaseline: { rental_item_baseline_photos: [{ id: '1', slot_key: 'overview', status: 'ready', object_key: 'k', captured_at: null, capture_source: null, captured_at_source: null }] },
    });
    await expect(svc.setOptIn(ITEM, true)).rejects.toMatchObject({
      response: expect.objectContaining({ code: INSPECTION_BASELINE_REQUIRED }),
    });
    expect(mutations).toHaveLength(0);
  });

  it('opts out by updating only the item', async () => {
    const { svc, mutations } = harness({ OptInItem: item, ItemBaseline: { rental_item_baseline_photos: [] } });
    await expect(svc.setOptIn(ITEM, false)).resolves.toEqual({ enabled: false });
    expect(mutations[0].query).toContain('update_rental_items_by_pk');
    expect(mutations[0].query).not.toContain('rental_bookings');
    expect(mutations[0].variables).toEqual({ id: ITEM, on: false, at: null });
  });

  it('stamps from the stored opt-in and ready slots', async () => {
    const ready = ['overview', 'other_side', 'accessories'].map((slot, index) => ({
      id: String(index), slot_key: slot, status: 'ready', object_key: 'k', captured_at: null, capture_source: 'camera', captured_at_source: 'upload',
    }));
    const on = harness({
      OptInItem: { rental_items_by_pk: { ...item.rental_items_by_pk, inspection_opt_in: true } },
      ItemBaseline: { rental_item_baseline_photos: ready },
    });
    await expect(on.svc.stampsNewBooking(ITEM)).resolves.toBe(true);
    const off = harness({
      OptInItem: item,
      ItemBaseline: { rental_item_baseline_photos: ready },
    });
    await expect(off.svc.stampsNewBooking(ITEM)).resolves.toBe(false);
  });

  function bookingRow() {
    return {
      rental_bookings_by_pk: {
        id: '11111111-1111-4111-8111-111111111111',
        start_at: START,
        status: 'confirmed',
        business_id: 'biz-1',
        rental_location_listing: {
          id: '22222222-2222-4222-8222-222222222222',
          rental_item: { id: ITEM },
          business_location: { address: { country: 'Canada' } },
        },
      },
    };
  }

  function version(id: string, submittedAt: string, resolution: string, condition: string, extra: Record<string, unknown> = {}) {
    return {
      id,
      submitted_at: submittedAt,
      items: [{ condition, unit: { slot_index: 1, physical_label: 'A' } }],
      inspection: {
        rental_booking: {
          return_resolution: resolution,
          claimed_damage_amount: 0,
          rental_inspection_disputes: [],
          ...extra,
        },
      },
    };
  }

  function lockedMedia(versionId: string, slotIndex = 1) {
    return ['overview', 'other_side', 'accessories'].map((slot) => ({
      id: `${versionId}-${slot}`,
      role: slot,
      slot_key: slot,
      status: 'locked',
      version_id: versionId,
      object_key: `dev/rental-inspection/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png`,
      content_type: 'image/png',
      captured_at: '2026-11-02T15:00:00.000Z',
      capture_source: 'camera',
      captured_at_source: 'upload',
      unit: { slot_index: slotIndex, physical_label: slotIndex === 1 ? 'A' : 'B' },
    }));
  }

  async function expectBlocked(versions: unknown[]) {
    const booking = bookingRow();
    const built = harness({
      OptInBooking: booking,
      LatestUnitReturns: { rental_inspection_versions: versions },
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    await expect(built.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_REUSE_BLOCKED_DAMAGE }),
    });
    const text = built.hasura.executeQuery.mock.calls.map((call) => String(call[0])).join('\n');
    expect(text).not.toContain('return_resolution: { _eq: "accepted" }');
    expect(text).toContain('LatestUnitReturns');
  }

  it('blocks a newer disputed return even when an older return was clean', async () => {
    await expectBlocked([
      version('new', '2026-11-10T15:00:00.000Z', 'disputed', 'good'),
      version('old', '2026-11-01T15:00:00.000Z', 'accepted', 'good'),
    ]);
  });

  it('blocks review, an upheld admin clear, a claim, and reported damage', async () => {
    await expectBlocked([version('review', '2026-11-10T15:00:00.000Z', 'review', 'good')]);
    await expectBlocked([
      version('cleared', '2026-11-10T15:00:00.000Z', 'admin_cleared', 'good', {
        rental_inspection_disputes: [{ decision: 'damage_upheld' }],
      }),
    ]);
    await expectBlocked([
      version('claim', '2026-11-10T15:00:00.000Z', 'accepted', 'good', { claimed_damage_amount: 40 }),
    ]);
    await expectBlocked([version('damaged', '2026-11-10T15:00:00.000Z', 'accepted', 'damaged')]);
  });

  it('copies locked photos for the matching unit and records the hash', async () => {
    const booking = bookingRow();
    const built = harness({
      OptInBooking: booking,
      LatestUnitReturns: {
        rental_inspection_versions: [version('ver-1', '2026-11-02T15:00:00.000Z', 'accepted', 'good')],
      },
      ReturnUnitMedia: { rental_inspection_media: lockedMedia('ver-1') },
      TargetUnits: { rental_booking_units: [{ id: 'unit-1', slot_index: 1, physical_label: 'A' }] },
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    await expect(built.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).resolves.toEqual({
      reused: true, source: 'return', count: 3,
    });
    const query = built.hasura.executeQuery.mock.calls.map((call) => String(call[0])).join('\n');
    expect(query).toContain('"locked"');
    expect(query).not.toContain('status: { _eq: "ready" }');
    const applied = built.mutations.find((row) => row.query.includes('rental_apply_pickup_reuse'));
    const copies = applied?.variables.copies as Array<Record<string, unknown>>;
    expect(copies).toHaveLength(3);
    const stripped = await stripPhoto(PNG, 'image/png');
    expect(copies.every((copy) => copy.unitId === 'unit-1')).toBe(true);
    expect(copies[0]).toEqual(expect.objectContaining({
      contentType: 'image/png',
      sha256: photoSha256(stripped.bytes),
      byteSize: stripped.bytes.length,
      captured_at: '2026-11-02T15:00:00.000Z',
    }));
    expect(String(copies[0].derivativeKey)).toMatch(/\.view\.png$/);
  });

  it('does not report reused when a locked role is missing', async () => {
    const booking = bookingRow();
    const built = harness({
      OptInBooking: booking,
      LatestUnitReturns: {
        rental_inspection_versions: [version('ver-1', '2026-11-02T15:00:00.000Z', 'accepted', 'good')],
      },
      ReturnUnitMedia: { rental_inspection_media: [lockedMedia('ver-1')[0]] },
      TargetUnits: { rental_booking_units: [{ id: 'unit-1', slot_index: 1, physical_label: 'A' }] },
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    await expect(built.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PICKUP_REUSE_UNAVAILABLE' }),
    });
    expect(built.mutations.some((row) => row.query.includes('rental_apply_pickup_reuse'))).toBe(false);
  });

  it('copies each unit onto the unit with the same slot', async () => {
    const booking = bookingRow();
    const media = [...lockedMedia('ver-1', 1), ...lockedMedia('ver-1', 2)];
    const built = harness({
      OptInBooking: booking,
      LatestUnitReturns: {
        rental_inspection_versions: [{
          ...version('ver-1', '2026-11-02T15:00:00.000Z', 'accepted', 'good'),
          items: [
            { condition: 'good', unit: { slot_index: 1, physical_label: 'A' } },
            { condition: 'good', unit: { slot_index: 2, physical_label: 'B' } },
          ],
        }],
      },
      ReturnUnitMedia: { rental_inspection_media: media },
      TargetUnits: {
        rental_booking_units: [
          { id: 'unit-1', slot_index: 1, physical_label: 'A' },
          { id: 'unit-2', slot_index: 2, physical_label: 'B' },
        ],
      },
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    await built.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined);
    const copies = built.mutations.find((row) => row.query.includes('rental_apply_pickup_reuse'))?.variables.copies;
    const slots = new Set(copies.map((copy: { unitId: string; slotIndex: number }) => `${copy.unitId}:${copy.slotIndex}`));
    expect(slots).toEqual(new Set(['unit-1:1', 'unit-2:2']));
  });

  it('hides opt-in routes and skips the baseline query when the flag is off', async () => {
    const off = harness({ OptInItem: item }, false);
    await expect(off.svc.setOptIn(ITEM, false)).rejects.toMatchObject({ status: 404 });
    await expect(off.svc.summaryIfEnabled(ITEM)).resolves.toBeNull();
    const queries = off.hasura.executeQuery.mock.calls.map((call) => String(call[0]));
    expect(queries.some((query) => query.includes('ItemBaseline'))).toBe(false);
  });

  it('checks ownership and the signed type before a baseline is ready', async () => {
    const row = {
      id: 'photo-1', slot_key: 'overview', status: 'pending',
      object_key: 'dev/rental-inspection/baseline/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/photo-1.png',
      content_type: 'image/png', byte_size: PNG.length,
      captured_at: null, capture_source: null, captured_at_source: null,
    };
    const built = harness({
      OptInItem: item,
      ItemBaseline: { rental_item_baseline_photos: [row] },
    });
    built.aws.headObjectMeta.mockResolvedValue({ contentLength: PNG.length, contentType: 'image/png', versionId: null });
    await expect(built.svc.finalizeBaseline(ITEM, 'photo-1')).resolves.toEqual({ photoId: 'photo-1', status: 'ready' });
    const ready = built.mutations.find((call) => call.query.includes('ReadyBaseline'));
    expect(ready?.variables.type).toBe('image/png');
    expect(ready?.variables.bytes).toBeGreaterThan(0);
    built.users.getUser.mockResolvedValue({ id: 'user-2', active_persona: 'business', business: { id: 'biz-2' } });
    await expect(built.svc.finalizeBaseline(ITEM, 'photo-1')).rejects.toMatchObject({ status: 403 });
  });

  it('rejects reuse at the start instant', async () => {
    const booking = {
      rental_bookings_by_pk: {
        id: '11111111-1111-4111-8111-111111111111',
        start_at: START,
        status: 'confirmed',
        business_id: 'biz-1',
        rental_location_listing: {
          id: '22222222-2222-4222-8222-222222222222',
          rental_item: { id: ITEM },
          business_location: { address: { country: 'Canada' } },
        },
      },
    };
    const { svc } = harness({ OptInBooking: booking, ItemBaseline: { rental_item_baseline_photos: [] } });
    jest.useFakeTimers().setSystemTime(new Date(START));
    await expect(svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_PHOTO_AFTER_START }),
    });
    jest.useRealTimers();
  });
});

describe('opt-in upload gate on pickup rules', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  function rules(optInOn: boolean) {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (!query.includes('PickupRulesBooking')) throw new Error(query.slice(0, 40));
        return {
          rental_bookings_by_pk: {
            id, start_at: START, status: 'confirmed', business_id: 'biz-1',
            rental_location_listing_id: '22222222-2222-4222-8222-222222222222',
            inspection_policy_version: 1,
            rental_location_listing: { business_location: { address: { country: 'Canada' } } },
          },
        };
      }),
      executeMutation: jest.fn(),
    };
    const flags = {
      pickupPhotoRulesEnabled: jest.fn(async () => true),
      optInEnabled: jest.fn(async () => optInOn),
    };
    const users = { getUser: jest.fn() };
    const aws = {};
    const optIn = { reuseStatus: jest.fn() };
    return new PickupPhotoRulesService(hasura as any, users as any, flags as any, aws as any, optIn as any);
  }

  it('allows a web upload before start and stores the source', async () => {
    const svc = rules(true);
    const gate = { bookingId: id, role: 'overview', platform: 'web', slotKey: 'overview' };
    await expect(svc.assertUpload(gate, new Date(BEFORE))).resolves.toBeUndefined();
    await expect(svc.assertUpload(gate, new Date(START))).resolves.toBeUndefined();
    await expect(svc.assertSubmit(id, 'pickup', new Date(START))).resolves.toBeUndefined();
    const columns = await svc.mediaColumns(id, 'overview', {
      slotKey: 'overview', exifDateTime: '2026:11:10 09:30:00', captureSource: 'web', platform: 'web',
    }, new Date(BEFORE));
    expect(columns).toEqual(expect.objectContaining({
      captured_at: BEFORE,
      capture_source: 'web',
      captured_at_source: 'upload',
      exif_captured_at: '2026-11-10T14:30:00.000Z',
      reused: false,
    }));
  });

  it('still rejects a started or cancelled booking after the scheduled start', async () => {
    const gate = { bookingId: id, role: 'overview', platform: 'web', slotKey: 'overview' };
    const hasura = {
      executeQuery: jest.fn(async () => ({
        rental_bookings_by_pk: {
          id, start_at: START, actual_start_at: START, status: 'confirmed', business_id: 'biz-1',
          rental_location_listing_id: '22222222-2222-4222-8222-222222222222',
          inspection_policy_version: 1,
          rental_location_listing: { business_location: { address: { country: 'Canada' } } },
        },
      })),
      executeMutation: jest.fn(),
    };
    const flags = {
      pickupPhotoRulesEnabled: jest.fn(async () => true),
      optInEnabled: jest.fn(async () => true),
    };
    const startedRules = new PickupPhotoRulesService(hasura as any, { getUser: jest.fn() } as any, flags as any, {} as any, { reuseStatus: jest.fn() } as any);
    await expect(startedRules.assertUpload(gate, new Date(BEFORE))).rejects.toBeInstanceOf(HttpException);
    hasura.executeQuery.mockResolvedValue({
      rental_bookings_by_pk: {
        id, start_at: START, actual_start_at: null, status: 'cancelled', business_id: 'biz-1',
        rental_location_listing_id: '22222222-2222-4222-8222-222222222222',
        inspection_policy_version: 1,
        rental_location_listing: { business_location: { address: { country: 'Canada' } } },
      },
    });
    await expect(startedRules.assertSubmit(id, 'pickup', new Date(BEFORE))).rejects.toBeInstanceOf(HttpException);
  });

  it('does not require a retake when opt-in is on', async () => {
    const svc = rules(true);
    await expect(svc.assertSubmit(id, 'pickup', new Date(BEFORE))).resolves.toBeUndefined();
  });
});
