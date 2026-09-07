import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  constants: { appOwnership: null as string | null },
}));

vi.mock('expo-constants', () => ({ default: mocks.constants }));
vi.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
}));

async function importLoader() {
  return import('./expoNotificationsLoader');
}

describe('loadExpoNotifications', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.constants.appOwnership = null;
  });

  it('resolves the module for every caller in the same tick', async () => {
    const { loadExpoNotifications } = await importLoader();

    // App.tsx mounts 11 notification hooks whose effects all call this within a
    // single effect flush, before the dynamic import can settle.
    const results = await Promise.all(
      Array.from({ length: 11 }, () => loadExpoNotifications())
    );

    expect(results.filter((mod) => mod === null)).toHaveLength(0);
    expect(new Set(results).size).toBe(1);
  });

  it('reuses the same module for sequential callers', async () => {
    const { loadExpoNotifications } = await importLoader();

    const first = await loadExpoNotifications();
    const second = await loadExpoNotifications();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('returns null in Expo Go', async () => {
    mocks.constants.appOwnership = 'expo';
    const { loadExpoNotifications } = await importLoader();

    const results = await Promise.all([
      loadExpoNotifications(),
      loadExpoNotifications(),
    ]);

    expect(results).toEqual([null, null]);
  });
});
