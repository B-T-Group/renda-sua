import {
  assignGuideSlots,
  calendarDay,
  captureOutsidePickupDay,
  completeGuideSlots,
  isPickupPhotoDay,
  listingTimeZone,
  missingGuideSlots,
  pendingMediaColumns,
  serverCaptureTimestamp,
  cleanSkipReason,
  skipDecision,
  uploadPlatform,
} from './pickup-photo-rules';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const MANILA = 'Asia/Manila';
const START = new Date('2026-11-17T15:00:00.000Z');

describe('pickup photo day on the listing clock', () => {
  it('uses America/Toronto for Canada and Africa/Douala otherwise', () => {
    expect(listingTimeZone('Canada')).toBe(TORONTO);
    expect(listingTimeZone('Cameroon')).toBe(DOUALA);
    expect(listingTimeZone('Unknown land')).toBe(DOUALA);
  });

  // start_at is listing wall clock stored as UTC components; "now" is a real instant
  // read on the listing clock, so the pickup day is the stored date at the listing.
  it('opens a Douala booking at Douala midnight on the stored date', () => {
    const start = new Date('2026-11-17T08:00:00.000Z');
    expect(isPickupPhotoDay(start, new Date('2026-11-16T22:59:59.000Z'), DOUALA)).toBe(false);
    expect(isPickupPhotoDay(start, new Date('2026-11-16T23:00:00.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-17T22:59:59.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-17T23:00:00.000Z'), DOUALA)).toBe(false);
  });

  it('allows a Manila afternoon booking on the stored date, not the next local day', () => {
    const start = new Date('2026-11-26T16:00:00.000Z');
    expect(isPickupPhotoDay(start, new Date('2026-11-25T15:59:59.000Z'), MANILA)).toBe(false);
    expect(isPickupPhotoDay(start, new Date('2026-11-25T16:00:00.000Z'), MANILA)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-26T08:00:00.000Z'), MANILA)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-26T15:59:59.000Z'), MANILA)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-26T16:00:00.000Z'), MANILA)).toBe(false);
  });

  it('does not open a Toronto pickup at 7 PM the evening before', () => {
    const start = new Date('2026-11-26T12:00:00.000Z');
    expect(isPickupPhotoDay(start, new Date('2026-11-26T00:00:00.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(start, new Date('2026-11-26T04:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(start, new Date('2026-11-26T05:00:00.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-27T04:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(start, new Date('2026-11-27T05:00:00.000Z'), TORONTO)).toBe(false);
  });

  it('follows Toronto midnight on the DST change days', () => {
    const spring = new Date('2026-03-08T15:00:00.000Z');
    expect(isPickupPhotoDay(spring, new Date('2026-03-08T04:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(spring, new Date('2026-03-08T05:00:00.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(spring, new Date('2026-03-09T03:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(spring, new Date('2026-03-09T04:00:00.000Z'), TORONTO)).toBe(false);
    const fall = new Date('2026-11-01T15:00:00.000Z');
    expect(isPickupPhotoDay(fall, new Date('2026-11-01T03:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(fall, new Date('2026-11-01T04:00:00.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(fall, new Date('2026-11-02T04:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(fall, new Date('2026-11-02T05:00:00.000Z'), TORONTO)).toBe(false);
  });

  it('rejects a missing start', () => {
    expect(isPickupPhotoDay(new Date('nope'), new Date(), TORONTO)).toBe(false);
  });
});

describe('server capture timestamp', () => {
  it('stamps the server clock and has no client timestamp argument', () => {
    const clock = new Date('2026-11-17T15:14:00.000Z');
    const clientClaim = '2026-11-08T12:00:00.000Z';
    expect(serverCaptureTimestamp(clock)).toBe(clock.toISOString());
    expect(serverCaptureTimestamp).toHaveLength(1);
    expect(pendingMediaColumns('overview', clock)).toEqual({
      captured_at: clock.toISOString(),
      slot_key: 'overview',
    });
    expect(pendingMediaColumns('overview', clock).captured_at).not.toBe(clientClaim);
    expect(pendingMediaColumns('not-a-slot', clock).slot_key).toBeNull();
  });
});

describe('guide retake and skip', () => {
  const photos = [
    { id: 'a', role: 'overview', createdAt: '2026-11-10T10:00:00.000Z' },
    { id: 'b', role: 'other_side', createdAt: '2026-11-10T10:01:00.000Z' },
    { id: 'c', role: 'accessories', createdAt: '2026-11-10T10:02:00.000Z' },
    { id: 'd', role: 'wear', createdAt: '2026-11-10T10:03:00.000Z' },
    { id: 'e', role: 'overview', createdAt: '2026-11-10T10:04:00.000Z' },
  ];

  it('keeps the default angles required and numbers extra angles', () => {
    const slots = completeGuideSlots(assignGuideSlots(photos));
    expect(slots.map((slot) => [slot.slotKey, slot.required])).toEqual([
      ['overview', true],
      ['other_side', true],
      ['accessories', true],
      ['extra:1', false],
      ['extra:2', false],
    ]);
  });

  it('blocks submit until each guide slot is retaken or an extra is skipped', () => {
    const slots = completeGuideSlots(assignGuideSlots(photos));
    const taken = [
      { unitId: 'u1', slotKey: 'overview', status: 'ready' },
      { unitId: 'u1', slotKey: 'other_side', status: 'ready' },
      { unitId: 'u1', slotKey: 'accessories', status: 'ready' },
    ];
    expect(missingGuideSlots(slots, taken, [], ['u1']).map((row) => row.slotKey)).toEqual(['extra:1', 'extra:2']);
    const skipped = [{ unitId: 'u1', slotKey: 'extra:1', reason: 'Angle was not on this unit' }];
    const still = missingGuideSlots(slots, taken, skipped, ['u1', 'u2']);
    expect(still.filter((row) => row.unitId === 'u1').map((row) => row.slotKey)).toEqual(['extra:2']);
    expect(still.filter((row) => row.unitId === 'u2').map((row) => row.slotKey)).toEqual([
      'overview',
      'other_side',
      'accessories',
      'extra:1',
      'extra:2',
    ]);
  });

  it('refuses a required-slot skip and an empty reason', () => {
    expect(skipDecision('overview', 'not today', ['extra:1'])).toBe('required');
    expect(skipDecision('extra:9', 'not on the guide', ['extra:1'])).toBe('required');
    expect(skipDecision('extra:1', '   ', ['extra:1'])).toBe('reason');
    expect(skipDecision('extra:1', 'x'.repeat(281), ['extra:1'])).toBe('reason');
    expect(skipDecision('extra:1', 'Covered by the overview', ['extra:1'])).toBe('ok');
    expect(cleanSkipReason('Same\u0000 as\nthe overview\u007F')).toBe('Same as the overview');
    expect(skipDecision('extra:1', 'Angle\u0000 was missing', ['extra:1'])).toBe('ok');
    expect(skipDecision('extra:1', '\n\t', ['extra:1'])).toBe('reason');
  });

  it('rejects a photo whose server stamp is outside the pickup day on the listing clock', () => {
    const outside = captureOutsidePickupDay(
      [{ capturedAt: '2026-11-16T15:00:00.000Z' }],
      START,
      TORONTO
    );
    const inside = captureOutsidePickupDay([{ capturedAt: '2026-11-17T15:14:00.000Z' }], START, TORONTO);
    // 16 Nov 22:59 in Toronto: the evening before, not the pickup day.
    const earlyToronto = captureOutsidePickupDay(
      [{ capturedAt: '2026-11-17T03:59:59.000Z' }],
      START,
      TORONTO
    );
    const lateToronto = captureOutsidePickupDay([{ capturedAt: '2026-11-18T04:59:59.000Z' }], START, TORONTO);
    const manilaStart = new Date('2026-11-26T16:00:00.000Z');
    const manilaAfternoon = captureOutsidePickupDay(
      [{ capturedAt: '2026-11-26T08:00:00.000Z' }],
      manilaStart,
      MANILA
    );
    const manilaNextDay = captureOutsidePickupDay(
      [{ capturedAt: '2026-11-27T00:00:00.000Z' }],
      manilaStart,
      MANILA
    );
    const missing = captureOutsidePickupDay([{ capturedAt: null }], START, TORONTO);
    expect(outside).toBe(true);
    expect(inside).toBe(false);
    expect(earlyToronto).toBe(true);
    expect(lateToronto).toBe(false);
    expect(manilaAfternoon).toBe(false);
    expect(manilaNextDay).toBe(true);
    expect(missing).toBe(true);
  });
});

describe('upload platform', () => {
  it('treats the mobile header as the app and everything else as web', () => {
    expect(uploadPlatform('ios')).toBe('app');
    expect(uploadPlatform('android')).toBe('app');
    expect(uploadPlatform(undefined)).toBe('web');
    expect(uploadPlatform('web')).toBe('web');
  });
});
