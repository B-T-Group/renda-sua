import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

let capturedHandler: ((args: { data: any; error: any }) => Promise<void>) | null = null;

vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn((name: string, handler: any) => {
    capturedHandler = handler;
  }),
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
}));

const mockAsyncStorage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockAsyncStorage.get(key) || null),
    setItem: vi.fn(async (key: string, value: string) => mockAsyncStorage.set(key, value)),
    removeItem: vi.fn(async (key: string) => mockAsyncStorage.delete(key)),
  },
}));

vi.mock('../services/agentLocationHasura', () => ({
  updateMyAgentLocation: vi.fn(),
}));

vi.mock('../utils/haversineDistanceM', () => ({
  haversineDistanceM: vi.fn((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }),
}));

// Don't mock shouldSendLocation - use real implementation

let lastSentData = {
  lat: 10.0,
  lng: 20.0,
  timestampMs: 0,
  userId: 'user-123',
};

vi.mock('../utils/agentLocationLastSentStorage', async () => {
  const actual = await vi.importActual<typeof import('../utils/agentLocationLastSentStorage')>(
    '../utils/agentLocationLastSentStorage'
  );
  const mockRead = vi.fn(async () => {
    if (lastSentData.timestampMs === 0) {
      lastSentData.timestampMs = Date.now() - 600_000;
    }
    return { ...lastSentData };
  });
  const mockWrite = vi.fn(async (lat: number, lng: number, timestampMs: number, userId: string) => {
    lastSentData = { lat, lng, timestampMs, userId };
  });
  
  return {
    ...actual,
    readLastSentLocation: mockRead,
    writeLastSentLocation: mockWrite,
  };
});

import {
  AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  AGENT_LOCATION_BG_ACTIVE_KEY,
  AUTH_STORAGE_IS_AUTHENTICATED_KEY,
  AUTH_STORAGE_USER_KEY,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_SLACK_MS,
} from '../constants/agentLocationBackground';
import { updateMyAgentLocation } from '../services/agentLocationHasura';
import * as storage from '../utils/agentLocationLastSentStorage';

const EARTH_RADIUS_M = 6371e3;

function northOfLastSent(meters: number): number {
  return lastSentData.lat + (meters / EARTH_RADIUS_M) * (180 / Math.PI);
}

function locationFix(latitude: number, longitude = lastSentData.lng) {
  return {
    data: { locations: [{ coords: { latitude, longitude }, timestamp: Date.now() }] },
    error: null,
  };
}

describe('agentLocationTask - real handler with failure backoff', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    const storageModule = await vi.importActual<typeof storage>('../utils/agentLocationLastSentStorage');
    storageModule.__testOnly_resetState();

    lastSentData = {
      lat: 10.0,
      lng: 20.0,
      timestampMs: 0,
      userId: 'user-123',
    };

    mockAsyncStorage.clear();
    mockAsyncStorage.set('@RendasuaAgent:agentLocationBackgroundActive', '1');
    mockAsyncStorage.set('@RendasuaAgent:isAuthenticated', 'true');
    mockAsyncStorage.set('@RendasuaAgent:user', JSON.stringify({ id: 'user-123' }));
    mockAsyncStorage.set('@RendasuaAgent:agentLocationBackgroundActiveDelivery', '1');

    (updateMyAgentLocation as any).mockReset();
    (updateMyAgentLocation as any).mockResolvedValue({ success: true });

    if (!capturedHandler) {
      await import('../tasks/agentLocationTask');
      if (!capturedHandler) {
        throw new Error('TaskManager.defineTask was not called');
      }
    }
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('(a) failure result, then fix within 60s: called 1 time', async () => {
    (updateMyAgentLocation as any).mockResolvedValueOnce({ success: false });

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.1, longitude: 20.1 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    (updateMyAgentLocation as any).mockResolvedValueOnce({ success: true });

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.6, longitude: 20.6 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);
    expect(storage.writeLastSentLocation).not.toHaveBeenCalled();
  });

  it('(b) throw, then fix within 60s: called 1 time', async () => {
    (updateMyAgentLocation as any).mockRejectedValueOnce(new Error('Network error'));

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.1, longitude: 20.1 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    (updateMyAgentLocation as any).mockResolvedValueOnce({ success: true });

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.6, longitude: 20.6 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);
    expect(storage.writeLastSentLocation).not.toHaveBeenCalled();
  });

  it('(c) failure, advance past 60s, success sends and clears backoff', async () => {
    (updateMyAgentLocation as any).mockResolvedValueOnce({ success: false });

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.1, longitude: 20.1 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);

    (updateMyAgentLocation as any).mockResolvedValueOnce({ success: true });

    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 10.6, longitude: 20.6 }, timestamp: Date.now() }] },
      error: null,
    });

    expect(updateMyAgentLocation).toHaveBeenCalledTimes(2);
    expect(storage.writeLastSentLocation).toHaveBeenCalledTimes(1);
    expect(storage.writeLastSentLocation).toHaveBeenCalledWith(
      10.6,
      20.6,
      expect.any(Number),
      'user-123',
      0
    );
  });

  it('does not send when the task errors or delivers no fixes', async () => {
    await capturedHandler!({
      data: { locations: [{ coords: { latitude: 11, longitude: 21 }, timestamp: 1 }] },
      error: new Error('gps'),
    });
    await capturedHandler!({ data: {}, error: null });
    await capturedHandler!({ data: { locations: [] }, error: null });

    expect(updateMyAgentLocation).not.toHaveBeenCalled();
  });

  it('does not send without background consent, auth, or a user id', async () => {
    mockAsyncStorage.delete(AGENT_LOCATION_BG_ACTIVE_KEY);
    await capturedHandler!(locationFix(11));
    mockAsyncStorage.set(AGENT_LOCATION_BG_ACTIVE_KEY, '1');
    mockAsyncStorage.set(AUTH_STORAGE_IS_AUTHENTICATED_KEY, 'TRUE');
    await capturedHandler!(locationFix(11));
    mockAsyncStorage.set(AUTH_STORAGE_IS_AUTHENTICATED_KEY, 'true');
    mockAsyncStorage.set(AUTH_STORAGE_USER_KEY, JSON.stringify({}));
    await capturedHandler!(locationFix(11));
    mockAsyncStorage.set(AUTH_STORAGE_USER_KEY, '{');
    await capturedHandler!(locationFix(11));

    expect(updateMyAgentLocation).not.toHaveBeenCalled();
  });

  it('uses 50m while a delivery is active and 100m when idle', async () => {
    lastSentData.timestampMs = Date.now() - 60_000;

    await capturedHandler!(locationFix(northOfLastSent(49)));
    expect(updateMyAgentLocation).not.toHaveBeenCalled();

    await capturedHandler!(locationFix(northOfLastSent(51)));
    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);

    (updateMyAgentLocation as any).mockClear();
    mockAsyncStorage.delete(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY);
    lastSentData.timestampMs = Date.now() - 60_000;

    await capturedHandler!(locationFix(northOfLastSent(99)));
    expect(updateMyAgentLocation).not.toHaveBeenCalled();

    await capturedHandler!(locationFix(northOfLastSent(101)));
    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);
  });

  it('sends a stationary heartbeat at 9 minutes and not one millisecond earlier', async () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(HEARTBEAT_SLACK_MS).toBe(60 * 1000);
    const dueMs = HEARTBEAT_INTERVAL_MS - HEARTBEAT_SLACK_MS;
    lastSentData.timestampMs = Date.now() - (dueMs - 1);

    await capturedHandler!(locationFix(lastSentData.lat, lastSentData.lng));
    expect(updateMyAgentLocation).not.toHaveBeenCalled();

    lastSentData.timestampMs = Date.now() - dueMs;
    await capturedHandler!(locationFix(lastSentData.lat, lastSentData.lng));
    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);
  });

  it('skips a second fix while a send is still in flight', async () => {
    vi.useRealTimers();
    let release: (value: { success: boolean }) => void = () => undefined;
    (updateMyAgentLocation as any).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );

    const first = capturedHandler!(locationFix(11, 21));
    await vi.waitFor(() => expect(updateMyAgentLocation).toHaveBeenCalledTimes(1));

    await capturedHandler!(locationFix(12, 22));
    expect(updateMyAgentLocation).toHaveBeenCalledTimes(1);

    release({ success: true });
    await first;
  });
});
