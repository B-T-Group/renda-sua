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

import { updateMyAgentLocation } from '../services/agentLocationHasura';
import * as storage from '../utils/agentLocationLastSentStorage';

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
  });
});
