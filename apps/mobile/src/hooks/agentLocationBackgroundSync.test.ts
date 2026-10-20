import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = vi.hoisted(() => ({
  memory: new Map<string, string>(),
}));

let platformOS: 'android' | 'ios' | 'web' = 'android';

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformOS;
    },
    set OS(value: 'android' | 'ios' | 'web') {
      platformOS = value;
    },
  },
}));

vi.mock('expo-location', () => ({
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  hasStartedLocationUpdatesAsync: vi.fn(),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageState.memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storageState.memory.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageState.memory.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const key of keys) storageState.memory.delete(key);
    }),
  },
}));

import {
  AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  AGENT_LOCATION_BG_ACTIVE_KEY,
  AGENT_LOCATION_TASK_NAME,
} from '../constants/agentLocationBackground';
import {
  buildLocationTaskOptions,
  markBackgroundTrackingInactive,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from './agentLocationBackgroundSync';
import * as Location from 'expo-location';

describe('buildLocationTaskOptions', () => {
  const notificationTitle = 'Test Title';
  const notificationBody = 'Test Body';

  describe('Android', () => {
    beforeEach(() => {
      platformOS = 'android';
    });

    it('idle mode: timeInterval 10min, distanceInterval 0, Accuracy.Balanced, foreground service', () => {
      const options = buildLocationTaskOptions(notificationTitle, notificationBody);

      expect(options.accuracy).toBe(Location.Accuracy.Balanced);
      expect(options.timeInterval).toBe(10 * 60 * 1000);
      expect(options.distanceInterval).toBe(0);
      expect(options.showsBackgroundLocationIndicator).toBe(true);
      expect(options.foregroundService).toEqual({
        notificationTitle,
        notificationBody,
      });
      expect(options.deferredUpdatesDistance).toBeUndefined();
      expect(options.deferredUpdatesInterval).toBeUndefined();
    });

    it('active-delivery mode: timeInterval 2s, distanceInterval 0, deferred 60s/0, Accuracy.High, foreground service', () => {
      const options = buildLocationTaskOptions(notificationTitle, notificationBody, {
        activeDelivery: true,
      });

      expect(options.accuracy).toBe(Location.Accuracy.High);
      expect(options.timeInterval).toBe(2 * 1000);
      expect(options.distanceInterval).toBe(0);
      expect(options.deferredUpdatesInterval).toBe(60 * 1000);
      expect(options.deferredUpdatesDistance).toBe(0);
      expect(options.showsBackgroundLocationIndicator).toBe(true);
      expect(options.foregroundService).toEqual({
        notificationTitle,
        notificationBody,
      });
    });
  });

  describe('iOS', () => {
    beforeEach(() => {
      platformOS = 'ios';
    });

    it('idle mode: distanceInterval 100m, deferredUpdatesInterval 10min, Accuracy.Low', () => {
      const options = buildLocationTaskOptions(notificationTitle, notificationBody);

      expect(options.accuracy).toBe(Location.Accuracy.Low);
      expect(options.distanceInterval).toBe(100);
      expect(options.deferredUpdatesDistance).toBe(0);
      expect(options.deferredUpdatesInterval).toBe(10 * 60 * 1000);
      expect(options.showsBackgroundLocationIndicator).toBe(true);
      expect(options.foregroundService).toBeUndefined();
      expect(options.timeInterval).toBeUndefined();
    });

    it('active-delivery mode: distanceInterval 50m, deferredUpdatesInterval 60s, Accuracy.High', () => {
      const options = buildLocationTaskOptions(notificationTitle, notificationBody, {
        activeDelivery: true,
      });

      expect(options.accuracy).toBe(Location.Accuracy.High);
      expect(options.distanceInterval).toBe(50);
      expect(options.deferredUpdatesDistance).toBe(50);
      expect(options.deferredUpdatesInterval).toBe(60 * 1000);
      expect(options.showsBackgroundLocationIndicator).toBe(true);
    });
  });
});

describe('background location start, stop, and mode switch', () => {
  const title = 'Test Title';
  const body = 'Test Body';

  beforeEach(async () => {
    platformOS = 'android';
    storageState.memory.clear();
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockReset();
    vi.mocked(Location.startLocationUpdatesAsync).mockReset();
    vi.mocked(Location.stopLocationUpdatesAsync).mockReset();
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(false);
    vi.mocked(Location.startLocationUpdatesAsync).mockResolvedValue(undefined);
    vi.mocked(Location.stopLocationUpdatesAsync).mockResolvedValue(undefined);
    await markBackgroundTrackingInactive();
    storageState.memory.clear();
  });

  it('starts idle tracking once and does not restart the same mode', async () => {
    await startBackgroundLocationUpdates(title, body);

    expect(storageState.memory.get(AGENT_LOCATION_BG_ACTIVE_KEY)).toBe('1');
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe(false);
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();

    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    await startBackgroundLocationUpdates(title, body);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('restarts with active-delivery options and records the delivery flag', async () => {
    await startBackgroundLocationUpdates(title, body);
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

    await startBackgroundLocationUpdates(title, body, { activeDelivery: true });

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(AGENT_LOCATION_TASK_NAME);
    const options = vi.mocked(Location.startLocationUpdatesAsync).mock.calls[1][1]!;
    expect(options.timeInterval).toBe(2_000);
    expect(options.distanceInterval).toBe(0);
    expect(options.deferredUpdatesInterval).toBe(60_000);
    expect(storageState.memory.get(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe('1');
  });

  it('marks tracking inactive when the first start fails', async () => {
    vi.mocked(Location.startLocationUpdatesAsync).mockRejectedValueOnce(new Error('no gps'));

    await expect(startBackgroundLocationUpdates(title, body)).rejects.toThrow('no gps');

    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_KEY)).toBe(false);
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe(false);
  });

  it('restores the previous cadence when a mode switch fails to restart', async () => {
    await startBackgroundLocationUpdates(title, body);
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    vi.mocked(Location.startLocationUpdatesAsync)
      .mockRejectedValueOnce(new Error('restart failed'))
      .mockResolvedValueOnce(undefined);

    await expect(
      startBackgroundLocationUpdates(title, body, { activeDelivery: true })
    ).rejects.toThrow('restart failed');

    const restored = vi.mocked(Location.startLocationUpdatesAsync).mock.calls[2][1]!;
    expect(restored.timeInterval).toBe(10 * 60 * 1000);
    expect(restored.accuracy).toBe(Location.Accuracy.Balanced);
    expect(storageState.memory.get(AGENT_LOCATION_BG_ACTIVE_KEY)).toBe('1');
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe(false);
  });

  it('clears tracking when the mode switch and the restore both fail', async () => {
    await startBackgroundLocationUpdates(title, body);
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    vi.mocked(Location.startLocationUpdatesAsync)
      .mockRejectedValueOnce(new Error('switch failed'))
      .mockRejectedValueOnce(new Error('restore failed'));

    await expect(
      startBackgroundLocationUpdates(title, body, { activeDelivery: true })
    ).rejects.toThrow('switch failed');

    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_KEY)).toBe(false);
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe(false);
  });

  it('does not call native location APIs on web', async () => {
    platformOS = 'web';

    await startBackgroundLocationUpdates(title, body);
    await stopBackgroundLocationUpdates();

    expect(Location.hasStartedLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('stops a running task and clears both flags', async () => {
    storageState.memory.set(AGENT_LOCATION_BG_ACTIVE_KEY, '1');
    storageState.memory.set(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY, '1');
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

    await stopBackgroundLocationUpdates();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(AGENT_LOCATION_TASK_NAME);
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_KEY)).toBe(false);
    expect(storageState.memory.has(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)).toBe(false);
  });

  it('swallows a native stop failure', async () => {
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockRejectedValue(new Error('native'));

    await expect(stopBackgroundLocationUpdates()).resolves.toBeUndefined();
  });
});
