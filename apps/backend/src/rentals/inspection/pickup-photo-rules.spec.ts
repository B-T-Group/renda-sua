import {
  assignGuideSlots,
  calendarDay,
  captureColumns,
  completeGuideSlots,
  isBeforeRentalStart,
  isPickupPhotoDay,
  listingTimeZone,
  missingGuideSlots,
  parseExifCapture,
  photoOffPickupDay,
  serverCaptureTimestamp,
  cleanSkipReason,
  skipDecision,
  uploadPlatform,
} from './pickup-photo-rules';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const START = new Date('2026-11-17T15:00:00.000Z');

describe('pickup photo day in the listing timezone', () => {
  it('uses America/Toronto for Canada and Africa/Douala otherwise', () => {
    expect(listingTimeZone('Canada')).toBe(TORONTO);
    expect(listingTimeZone('Cameroon')).toBe(DOUALA);
    expect(listingTimeZone('Unknown land')).toBe(DOUALA);
  });

  it('treats Toronto midnight as the pickup-day boundary', () => {
    expect(calendarDay(START, TORONTO)).toBe('2026-11-17');
    expect(isPickupPhotoDay(START, new Date('2026-11-17T04:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(START, new Date('2026-11-17T05:00:00.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(START, new Date('2026-11-18T04:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(START, new Date('2026-11-18T05:00:00.000Z'), TORONTO)).toBe(false);
  });

  it('treats Douala midnight as the pickup-day boundary', () => {
    expect(calendarDay(START, DOUALA)).toBe('2026-11-17');
    expect(isPickupPhotoDay(START, new Date('2026-11-16T22:59:59.000Z'), DOUALA)).toBe(false);
    expect(isPickupPhotoDay(START, new Date('2026-11-16T23:00:00.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(START, new Date('2026-11-17T22:59:59.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(START, new Date('2026-11-17T23:00:00.000Z'), DOUALA)).toBe(false);
  });

  it('rejects a missing start', () => {
    expect(isPickupPhotoDay(new Date('nope'), new Date(), TORONTO)).toBe(false);
  });

  it('keeps Toronto pickup day across the spring-forward and fall-back midnights', () => {
    const spring = new Date('2026-03-15T04:00:00.000Z');
    expect(calendarDay(spring, TORONTO)).toBe('2026-03-15');
    expect(isPickupPhotoDay(spring, new Date('2026-03-15T03:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(spring, new Date('2026-03-15T04:00:00.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(spring, new Date('2026-03-16T03:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(spring, new Date('2026-03-16T04:00:00.000Z'), TORONTO)).toBe(false);
    const fall = new Date('2026-11-01T04:00:00.000Z');
    expect(calendarDay(fall, TORONTO)).toBe('2026-11-01');
    expect(isPickupPhotoDay(fall, new Date('2026-11-01T03:59:59.000Z'), TORONTO)).toBe(false);
    expect(isPickupPhotoDay(fall, new Date('2026-11-02T04:59:59.000Z'), TORONTO)).toBe(true);
    expect(isPickupPhotoDay(fall, new Date('2026-11-02T05:00:00.000Z'), TORONTO)).toBe(false);
  });

  it('treats a Douala start just before local midnight as that calendar day', () => {
    const late = new Date('2026-11-17T22:30:00.000Z');
    expect(calendarDay(late, DOUALA)).toBe('2026-11-17');
    expect(isPickupPhotoDay(late, new Date('2026-11-16T22:59:59.000Z'), DOUALA)).toBe(false);
    expect(isPickupPhotoDay(late, new Date('2026-11-16T23:00:00.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(late, new Date('2026-11-17T22:59:59.000Z'), DOUALA)).toBe(true);
    expect(isPickupPhotoDay(late, new Date('2026-11-17T23:00:00.000Z'), DOUALA)).toBe(false);
  });
});

describe('server capture timestamp', () => {
  const clock = new Date('2026-11-17T15:14:00.000Z');

  it('keeps the server clock when the rules flag is off', () => {
    expect(serverCaptureTimestamp(clock)).toBe(clock.toISOString());
    expect(serverCaptureTimestamp).toHaveLength(1);
    const columns = captureColumns({
      slotKey: 'overview',
      clock,
      timeZone: TORONTO,
      exif: '2026:11:10 09:00:00',
      source: 'gallery',
      rulesOn: false,
    });
    expect(columns).toEqual({
      captured_at: clock.toISOString(),
      slot_key: 'overview',
      capture_source: null,
      captured_at_source: null,
    });
    expect(captureColumns({ ...blankCapture(clock), slotKey: 'not-a-slot' }).slot_key).toBeNull();
  });

  it('stores EXIF in the listing timezone and falls back to the upload time', () => {
    const exif = captureColumns({
      slotKey: 'overview',
      clock,
      timeZone: TORONTO,
      exif: '2026:11:10 09:30:00',
      source: 'gallery',
      rulesOn: true,
    });
    expect(exif).toEqual({
      captured_at: '2026-11-10T14:30:00.000Z',
      slot_key: 'overview',
      capture_source: 'gallery',
      captured_at_source: 'exif',
    });
    const offset = parseExifCapture('2026-11-10T14:30:00Z', TORONTO);
    expect(offset?.toISOString()).toBe('2026-11-10T14:30:00.000Z');
    const upload = captureColumns({
      slotKey: 'other_side',
      clock,
      timeZone: DOUALA,
      exif: 'not a date',
      source: 'camera',
      rulesOn: true,
    });
    expect(upload.captured_at).toBe(clock.toISOString());
    expect(upload.capture_source).toBe('camera');
    expect(upload.captured_at_source).toBe('upload');
  });
});

function blankCapture(clock: Date) {
  return { slotKey: 'overview', clock, timeZone: TORONTO, exif: null, source: null, rulesOn: false };
}

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

  it('marks a photo whose date is not the pickup day', () => {
    expect(photoOffPickupDay('2026-11-16T15:00:00.000Z', START, TORONTO)).toBe(true);
    expect(photoOffPickupDay('2026-11-17T15:14:00.000Z', START, TORONTO)).toBe(false);
    expect(photoOffPickupDay(null, START, TORONTO)).toBe(false);
    expect(isBeforeRentalStart(START, new Date('2026-11-10T15:00:00.000Z'))).toBe(true);
    expect(isBeforeRentalStart(START, START)).toBe(false);
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
