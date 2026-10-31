import { describe, expect, it } from 'vitest';
import {
  canShowDedicatedRelease,
  classifyDedicatedReleaseError,
  DEDICATED_DECLINE_REASONS,
  formatReleaseCountdown,
  releaseSecondsLeft,
} from './dedicatedRelease';

const NOW = Date.parse('2026-10-27T20:00:00.000Z');
const inSeconds = (s: number) => new Date(NOW + s * 1000).toISOString();
const own = (over: Record<string, unknown> = {}) => ({
  current_status: 'assigned_to_agent',
  assignment_source: 'dedicated_auto',
  dedicated_release_until: inSeconds(90),
  ...over,
});

describe('canShowDedicatedRelease', () => {
  it('shows for an auto-assigned order inside the window', () => {
    expect(canShowDedicatedRelease(own(), NOW)).toBe(true);
  });
  it('hides at or after dedicated_release_until (no client grace)', () => {
    expect(canShowDedicatedRelease(own({ dedicated_release_until: inSeconds(0) }), NOW)).toBe(false);
    expect(canShowDedicatedRelease(own({ dedicated_release_until: inSeconds(-1) }), NOW)).toBe(false);
  });
  it('hides for accepted offers, manual assignments and a missing source', () => {
    expect(canShowDedicatedRelease(own({ assignment_source: 'dedicated_offer' }), NOW)).toBe(false);
    expect(canShowDedicatedRelease(own({ assignment_source: 'manual' }), NOW)).toBe(false);
    expect(canShowDedicatedRelease(own({ assignment_source: null }), NOW)).toBe(false);
  });
  it('hides after pickup or for any other status', () => {
    for (const s of ['picked_up', 'in_transit', 'out_for_delivery', 'ready_for_pickup', 'delivered']) {
      expect(canShowDedicatedRelease(own({ current_status: s }), NOW)).toBe(false);
    }
  });
  it('hides without a window or an order', () => {
    expect(canShowDedicatedRelease(own({ dedicated_release_until: null }), NOW)).toBe(false);
    expect(canShowDedicatedRelease(own({ dedicated_release_until: 'garbage' }), NOW)).toBe(false);
    expect(canShowDedicatedRelease(null, NOW)).toBe(false);
    expect(canShowDedicatedRelease(undefined, NOW)).toBe(false);
  });
});

describe('countdown', () => {
  it('rounds partial seconds up and never goes negative', () => {
    expect(releaseSecondsLeft(new Date(NOW + 1500).toISOString(), NOW)).toBe(2);
    expect(releaseSecondsLeft(inSeconds(120), NOW)).toBe(120);
    expect(releaseSecondsLeft(inSeconds(-30), NOW)).toBe(0);
    expect(releaseSecondsLeft(null, NOW)).toBe(0);
  });
  it('formats mm:ss', () => {
    expect(formatReleaseCountdown(120)).toBe('02:00');
    expect(formatReleaseCountdown(65)).toBe('01:05');
    expect(formatReleaseCountdown(9)).toBe('00:09');
    expect(formatReleaseCountdown(0)).toBe('00:00');
    expect(formatReleaseCountdown(-5)).toBe('00:00');
  });
});

describe('classifyDedicatedReleaseError', () => {
  const err = (code: string | undefined, status: number, message = 'msg') =>
    Object.assign(new Error(message), { code, status });
  it('maps each documented code', () => {
    expect(classifyDedicatedReleaseError(err('DEDICATED_DISABLED', 409)).kind).toBe('hide');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_NOT_AUTO_ASSIGNED', 409)).kind).toBe('hide');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_WINDOW_CLOSED', 409)).kind).toBe('hide');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_NOT_ASSIGNED', 409)).kind).toBe('refresh');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_LOST', 409)).kind).toBe('refresh');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_FAILED', 500)).kind).toBe('retry');
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_UNAVAILABLE', 404)).kind).toBe('other');
    expect(classifyDedicatedReleaseError(err('INVALID_DECLINE_REASON', 400)).kind).toBe('other');
  });
  it('keeps the server message as is', () => {
    expect(classifyDedicatedReleaseError(err('DEDICATED_RELEASE_WINDOW_CLOSED', 409, 'Délai écoulé')).message).toBe('Délai écoulé');
  });
  it('treats an unknown 500 as retryable and a network error as other', () => {
    expect(classifyDedicatedReleaseError(err(undefined, 500)).kind).toBe('retry');
    expect(classifyDedicatedReleaseError(new Error('Network request failed')).kind).toBe('other');
    expect(classifyDedicatedReleaseError(undefined).kind).toBe('other');
  });
});

describe('reasons', () => {
  it('match the backend list', () => {
    expect([...DEDICATED_DECLINE_REASONS]).toEqual(['too_far', 'busy', 'not_enough_balance', 'other']);
  });
});
