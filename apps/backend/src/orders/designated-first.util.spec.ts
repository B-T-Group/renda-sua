import {
  designatedArea,
  designatedDueActions,
  designatedReleaseCutoffAt,
  eveningBeforeAt,
  haversineKm,
  pickDistanceOrigin,
  type DesignatedTickState,
} from './designated-first.util';

// Cameroon (Africa/Douala, UTC+1). Slot 2026-11-10 09:00-11:00 local = 08:00Z.
const WINDOW = new Date('2026-11-10T08:00:00Z');
const GATE = new Date('2026-11-10T07:30:00Z');
const base = (over: Partial<DesignatedTickState> = {}): DesignatedTickState => ({
  now: new Date('2026-11-08T10:00:00Z'),
  gateAt: GATE,
  windowStart: WINDOW,
  slotDate: '2026-11-10',
  timeZone: 'Africa/Douala',
  openEarlyOffer: false,
  openReminderSentAt: null,
  designatedAssigned: false,
  acceptedAt: null,
  confirmedAt: null,
  eveningSentAt: null,
  soonSentAt: null,
  openOfferReminderMinutes: 12,
  reminderMinutesBefore: 60,
  eveningEnabled: true,
  eveningLocalMinutes: 1140,
  ...over,
});

describe('designated-first util', () => {
  it('computes the free release cutoff (window - 2 h)', () => {
    expect(designatedReleaseCutoffAt(WINDOW, 120).toISOString()).toBe('2026-11-10T06:00:00.000Z');
  });

  it('puts the evening reminder at 19:00 local the day before', () => {
    expect(eveningBeforeAt('2026-11-10', 1140, 'Africa/Douala')?.toISOString()).toBe('2026-11-09T18:00:00.000Z');
    expect(eveningBeforeAt('not-a-date', 1140, 'Africa/Douala')).toBeNull();
  });

  it('measures distance and prefers fresh GPS, else home', () => {
    expect(haversineKm({ lat: 3.848, lng: 11.502 }, { lat: 3.848, lng: 11.502 })).toBe(0);
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
    const now = new Date('2026-11-08T10:00:00Z');
    const home = { lat: 1, lng: 1 };
    expect(pickDistanceOrigin({ lat: 2, lng: 2, updatedAt: '2026-11-08T09:50:00Z' }, home, now)?.source).toBe('gps');
    expect(pickDistanceOrigin({ lat: 2, lng: 2, updatedAt: '2026-11-08T09:00:00Z' }, home, now)?.source).toBe('home');
    expect(pickDistanceOrigin(null, null, now)).toBeNull();
  });

  it('labels the area by city and region only (no street address)', () => {
    expect(designatedArea({ city: 'Yaoundé', state: 'Centre' })).toContain('Yaoundé');
    expect(designatedArea({ city: 'Yaoundé', state: 'Centre' })).toContain('Centre');
  });

  describe('designatedDueActions (reminders scheduling)', () => {
    it('schedules the open-offer re-ping 12 min before the gate', () => {
      const r = designatedDueActions(base({ openEarlyOffer: true }));
      expect(r.due).toEqual([]);
      expect(r.nextAt?.toISOString()).toBe('2026-11-10T07:18:00.000Z');
      const at = designatedDueActions(base({ openEarlyOffer: true, now: new Date('2026-11-10T07:18:00Z') }));
      expect(at.due).toEqual(['open_offer_reminder']);
    });

    it('never re-pings after the gate or twice', () => {
      expect(designatedDueActions(base({ openEarlyOffer: true, now: new Date('2026-11-10T07:31:00Z') })).due).toEqual([]);
      expect(
        designatedDueActions(base({ openEarlyOffer: true, openReminderSentAt: 'x', now: new Date('2026-11-10T07:20:00Z') })).due
      ).toEqual([]);
    });

    it('schedules evening-before (19:00 local) then T-60 for an early accept', () => {
      const s = base({ designatedAssigned: true, acceptedAt: '2026-11-08T09:00:00Z' });
      expect(designatedDueActions(s).nextAt?.toISOString()).toBe('2026-11-09T18:00:00.000Z');
      const evening = designatedDueActions({ ...s, now: new Date('2026-11-09T18:00:00Z') });
      expect(evening.due).toEqual(['evening_reminder']);
      expect(evening.nextAt?.toISOString()).toBe('2026-11-10T07:00:00.000Z');
      const soon = designatedDueActions({ ...s, eveningSentAt: 'x', now: new Date('2026-11-10T07:00:00Z') });
      expect(soon.due).toEqual(['soon_reminder']);
    });

    it('skips the evening reminder when accepted after it or already confirmed', () => {
      const late = base({ designatedAssigned: true, acceptedAt: '2026-11-09T20:00:00Z', now: new Date('2026-11-09T20:00:00Z') });
      expect(designatedDueActions(late).nextAt?.toISOString()).toBe('2026-11-10T07:00:00.000Z');
      const confirmed = base({ designatedAssigned: true, acceptedAt: '2026-11-08T09:00:00Z', confirmedAt: 'x' });
      expect(designatedDueActions(confirmed).nextAt?.toISOString()).toBe('2026-11-10T07:00:00.000Z');
    });

    it('has nothing left once every notice is sent', () => {
      const r = designatedDueActions(
        base({ designatedAssigned: true, acceptedAt: '2026-11-08T09:00:00Z', eveningSentAt: 'x', soonSentAt: 'y' })
      );
      expect(r).toEqual({ due: [], nextAt: null });
    });
  });
});
