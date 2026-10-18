import { beforeEach, describe, expect, it, vi } from 'vitest';

let platformOS: 'android' | 'ios' = 'android';

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformOS;
    },
    set OS(value: 'android' | 'ios') {
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
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

import { buildLocationTaskOptions } from './agentLocationBackgroundSync';
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

    it('active-delivery mode: timeInterval 60s, distanceInterval 0, Accuracy.High, foreground service', () => {
      const options = buildLocationTaskOptions(notificationTitle, notificationBody, {
        activeDelivery: true,
      });

      expect(options.accuracy).toBe(Location.Accuracy.High);
      expect(options.timeInterval).toBeLessThanOrEqual(60 * 1000);
      expect(options.distanceInterval).toBe(0);
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
