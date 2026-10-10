import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestForegroundPermissionsAsync = vi.fn();
const getCurrentPositionAsync = vi.fn();

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    requestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => getCurrentPositionAsync(...args),
  Accuracy: { Balanced: 3 },
}));

import { readDeviceCatalogOrigin } from './useCatalogOrigin';

describe('readDeviceCatalogOrigin', () => {
  beforeEach(() => {
    requestForegroundPermissionsAsync.mockReset();
    getCurrentPositionAsync.mockReset();
  });

  it('returns the device coordinates when location permission is granted', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 4.05, longitude: 9.7 },
    });

    await expect(readDeviceCatalogOrigin()).resolves.toEqual({
      lat: 4.05,
      lng: 9.7,
    });
  });

  it('returns null when the shopper denies location permission', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(readDeviceCatalogOrigin()).resolves.toBeNull();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
