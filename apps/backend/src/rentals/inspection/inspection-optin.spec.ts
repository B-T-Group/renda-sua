import { HttpException } from '@nestjs/common';
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

  it('blocks reuse when damage was reported or upheld, else uses the return or baseline', () => {
    expect(reuseDamage({ claimed: 40, upheld: false, reported: false })).toBe('reported');
    expect(reuseDamage({ claimed: 0, upheld: true, reported: false })).toBe('upheld');
    expect(reuseChoice({ hasReturn: true, damage: 'reported', hasBaseline: true }).ok).toBe(false);
    expect(reuseChoice({ hasReturn: true, damage: null, hasBaseline: false })).toEqual({ ok: true, source: 'return' });
    expect(reuseChoice({ hasReturn: false, damage: null, hasBaseline: true })).toEqual({ ok: true, source: 'baseline' });
  });

  it('stores EXIF in the listing timezone and falls back to the upload clock', () => {
    const exif = optInCaptureColumns({
      slotKey: 'overview',
      clock: new Date(START),
      timeZone: 'America/Toronto',
      exif: '2026:11:10 09:30:00',
      source: 'gallery',
    });
    expect(exif.captured_at).toBe('2026-11-10T14:30:00.000Z');
    expect(exif.capture_source).toBe('gallery');
    expect(exif.captured_at_source).toBe('exif');
    const web = optInCaptureColumns({
      slotKey: 'overview',
      clock: new Date(START),
      timeZone: 'America/Toronto',
      exif: 'not-a-date',
      platform: 'web',
    });
    expect(web.captured_at).toBe(START);
    expect(web.captured_at_source).toBe('upload');
    expect(web.capture_source).toBe('web');
    expect(parseExifCapture('2026-11-10T14:30:00Z', 'America/Toronto')?.toISOString()).toBe('2026-11-10T14:30:00.000Z');
  });
});

describe('inspection opt-in service', () => {
  function harness(rows: Record<string, unknown>, optInOn = true) {
    const mutations: Array<{ query: string; variables: any }> = [];
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        const name = Object.keys(rows).find((key) => query.includes(key));
        if (!name) throw new Error(query.slice(0, 120));
        return rows[name];
      }),
      executeMutation: jest.fn(async (query: string, variables: any) => {
        mutations.push({ query, variables });
        return { insert_rental_item_baseline_photos_one: { id: 'photo-1' }, update_rental_items_by_pk: { id: ITEM } };
      }),
    };
    const users = {
      getUser: jest.fn(async () => ({ id: 'user-1', active_persona: 'business', business: { id: 'biz-1' } })),
    };
    const flags = { optInEnabled: jest.fn(async () => optInOn), pickupPhotoRulesEnabled: jest.fn(async () => false) };
    const aws = {
      generateStrictUploadUrl: jest.fn(async () => ({ url: 'https://upload.example', expiresAt: new Date() })),
      headObjectMeta: jest.fn(async () => ({ contentLength: 10, contentType: 'image/jpeg', versionId: null })),
      readObjectBytes: jest.fn(async () => Buffer.from('photo')),
      putPrivateObject: jest.fn(async () => 'v1'),
      generatePresignedDownloadUrl: jest.fn(async () => ({ url: 'https://signed.example', expiresAt: new Date() })),
    };
    const payments = { resolveRailForCountry: jest.fn(async () => 'stripe') };
    const svc = new InspectionOptInService(hasura as any, users as any, flags as any, aws as any, payments as any);
    return { svc, mutations, hasura, flags };
  }

  const item = {
    rental_items_by_pk: { id: ITEM, business_id: 'biz-1', inspection_opt_in: false, inspection_opted_in_at: null },
  };

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

  it('rejects reuse after reported damage and accepts a clean return', async () => {
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
    const damaged = {
      rental_inspection_versions: [{
        id: 'ver-1',
        submitted_at: '2026-11-02T15:00:00.000Z',
        items: [{ condition: 'damaged' }],
        inspection: { rental_booking: { claimed_damage_amount: 20, rental_inspection_disputes: [] } },
      }],
    };
    const blocked = harness({
      OptInBooking: booking,
      LatestAcceptedReturn: damaged,
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    await expect(blocked.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ code: PICKUP_REUSE_BLOCKED_DAMAGE }),
    });
    const clean = harness({
      OptInBooking: booking,
      LatestAcceptedReturn: {
        rental_inspection_versions: [{
          id: 'ver-1',
          submitted_at: '2026-11-02T15:00:00.000Z',
          items: [{ condition: 'good' }],
          inspection: { rental_booking: { claimed_damage_amount: 0, rental_inspection_disputes: [{ decision: 'damage_rejected' }] } },
        }],
      },
      ReturnPhotos: { rental_inspection_versions: [{ id: 'ver-1' }] },
      ReturnMedia: {
        rental_inspection_media: [{
          id: 'media-1', role: 'overview', slot_key: 'overview', object_key: 'dev/rental-inspection/b/m.view.jpg',
          derivative_key: null, captured_at: '2026-11-02T15:00:00.000Z', capture_source: 'camera', captured_at_source: 'exif',
        }],
      },
      PickupDraft: { rental_inspections: [{ id: 'insp-1' }] },
      FirstUnit: { rental_booking_units: [{ id: 'unit-1' }] },
      ItemBaseline: { rental_item_baseline_photos: [] },
    });
    jest.useFakeTimers().setSystemTime(new Date(BEFORE));
    await expect(clean.svc.reuse(booking.rental_bookings_by_pk.id, async () => undefined)).resolves.toEqual({
      reused: true, source: 'return', count: 1,
    });
    const inserted = clean.mutations.find((row) => row.query.includes('InsertReusedPhoto'));
    expect(inserted?.variables.object.reused).toBe(true);
    expect(inserted?.variables.object.captured_at).toBe('2026-11-02T15:00:00.000Z');
    jest.useRealTimers();
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
    await expect(svc.assertUpload(gate, new Date(START))).rejects.toBeInstanceOf(HttpException);
    const columns = await svc.mediaColumns(id, 'overview', {
      slotKey: 'overview', exifDateTime: '2026:11:10 09:30:00', captureSource: 'web', platform: 'web',
    }, new Date(BEFORE));
    expect(columns).toEqual(expect.objectContaining({
      captured_at: '2026-11-10T14:30:00.000Z',
      capture_source: 'web',
      captured_at_source: 'exif',
      reused: false,
    }));
  });

  it('does not require a retake when opt-in is on', async () => {
    const svc = rules(true);
    await expect(svc.assertSubmit(id, 'pickup', new Date(BEFORE))).resolves.toBeUndefined();
  });
});
