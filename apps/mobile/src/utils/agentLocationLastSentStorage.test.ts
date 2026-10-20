import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LOCATION_LAST_SENT_KEY } from '../constants/agentLocationBackground';
import {
  beginSend,
  endSend,
  recordFailure,
  clearFailure,
  canRetryAfterFailure,
  readLastSentLocation,
  writeLastSentLocation,
  clearLastSentLocation,
  getStopGeneration,
  __testOnly_resetState,
} from './agentLocationLastSentStorage';

describe('agentLocationLastSentStorage - in-flight guard and failure backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __testOnly_resetState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('in-flight guard', () => {
    it('should allow first send', () => {
      expect(beginSend()).toBe(true);
      endSend();
    });

    it('should block concurrent sends', () => {
      expect(beginSend()).toBe(true);
      expect(beginSend()).toBe(false);
      expect(beginSend()).toBe(false);
      endSend();
    });

    it('should allow send after endSend', () => {
      expect(beginSend()).toBe(true);
      endSend();
      expect(beginSend()).toBe(true);
      endSend();
    });

    it('should handle nested endSend gracefully', () => {
      expect(beginSend()).toBe(true);
      endSend();
      endSend();
      expect(beginSend()).toBe(true);
      endSend();
    });
  });

  describe('failure backoff', () => {
    it('should allow retry before any failure', () => {
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should block retry immediately after failure', () => {
      recordFailure();
      vi.advanceTimersByTime(100);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });

    it('should allow retry after backoff period', () => {
      recordFailure();
      vi.advanceTimersByTime(60_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should allow retry just at backoff threshold', () => {
      recordFailure();
      vi.advanceTimersByTime(59_999);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      vi.advanceTimersByTime(1);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle multiple failures', () => {
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle different backoff periods', () => {
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(30_000)).toBe(true);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });

    it('should allow immediate retry after successful send (success does not block)', () => {
      expect(canRetryAfterFailure(60_000)).toBe(true);
      
      clearFailure();
      vi.advanceTimersByTime(2_000);
      
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should clear failure after success, allowing immediate next send', () => {
      recordFailure();
      vi.advanceTimersByTime(100);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      clearFailure();
      expect(canRetryAfterFailure(60_000)).toBe(true);
      
      vi.advanceTimersByTime(2_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });
  });
});

describe('last-sent location is scoped to the signed-in agent', () => {
  beforeEach(async () => {
    __testOnly_resetState();
    await AsyncStorage.clear();
  });

  it('returns the stored point for the same user, including 0,0', async () => {
    await writeLastSentLocation(0, 0, 1_700_000_000_000, 'user-a', getStopGeneration());

    await expect(readLastSentLocation('user-a')).resolves.toEqual({
      lat: 0,
      lng: 0,
      timestampMs: 1_700_000_000_000,
      userId: 'user-a',
    });
  });

  it('does not reuse another account last-sent point', async () => {
    await writeLastSentLocation(4.05, 9.7, 1_700_000_000_000, 'user-a', getStopGeneration());

    await expect(readLastSentLocation('user-b')).resolves.toBeNull();
    await expect(readLastSentLocation('user-a')).resolves.toMatchObject({ userId: 'user-a' });
  });

  it('treats a legacy or incomplete record as missing so the next fix is sent', async () => {
    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat: 1, lng: 2 })
    );
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();

    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat: 1, lng: 2, timestampMs: 5 })
    );
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();

    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat: '4', lng: 9, timestampMs: 5, userId: 'user-a' })
    );
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();
  });

  it('treats corrupt storage as missing', async () => {
    await AsyncStorage.setItem(AGENT_LOCATION_LAST_SENT_KEY, '{');
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();
  });

  it('returns null when storage read throws', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();
  });
});

describe('a late save after tracking stops does not land', () => {
  beforeEach(async () => {
    __testOnly_resetState();
    await AsyncStorage.clear();
  });

  it('drops a write whose generation is older than the stop', async () => {
    const generation = getStopGeneration();
    await writeLastSentLocation(4, 9, 100, 'user-a', generation);

    await clearLastSentLocation();

    expect(getStopGeneration()).toBe(generation + 1);
    await expect(AsyncStorage.getItem(AGENT_LOCATION_LAST_SENT_KEY)).resolves.toBeNull();
    await writeLastSentLocation(5, 10, 200, 'user-a', generation);
    await expect(readLastSentLocation('user-a')).resolves.toBeNull();
  });

  it('keeps a write that uses the generation from after the stop', async () => {
    const stale = getStopGeneration();
    await clearLastSentLocation();
    await writeLastSentLocation(5, 10, 200, 'user-a', getStopGeneration());
    await writeLastSentLocation(1, 1, 1, 'user-b', stale);

    await expect(readLastSentLocation('user-a')).resolves.toEqual({
      lat: 5,
      lng: 10,
      timestampMs: 200,
      userId: 'user-a',
    });
  });

  it('still invalidates the in-flight write when deleting storage fails', async () => {
    const generation = getStopGeneration();
    await writeLastSentLocation(4, 9, 100, 'user-a', generation);
    vi.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk'));

    await clearLastSentLocation();
    await writeLastSentLocation(8, 8, 800, 'user-a', generation);

    await expect(readLastSentLocation('user-a')).resolves.toMatchObject({ lat: 4, lng: 9 });
  });

  it('swallows a storage write failure', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await expect(
      writeLastSentLocation(1, 2, 3, 'user-a', getStopGeneration())
    ).resolves.toBeUndefined();
  });
});
