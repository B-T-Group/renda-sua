import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getObject: async (key: string) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    setObject: async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    },
    remove: async (key: string) => {
      store.delete(key);
    },
  },
}));

import {
  clearOfflineCaptureQueue,
  dequeueOfflineCapture,
  enqueueOfflineCapture,
  readOfflineCaptureQueue,
} from './productCreateOfflineQueue';

describe('productCreateOfflineQueue', () => {
  beforeEach(() => {
    store.clear();
  });

  it('enqueues and dequeues capture jobs', async () => {
    const job = await enqueueOfflineCapture({
      assetUris: ['file://a.jpg'],
      hint: 'tomatoes',
    });
    expect(job.hint).toBe('tomatoes');
    const all = await readOfflineCaptureQueue();
    expect(all).toHaveLength(1);
    await dequeueOfflineCapture(job.id);
    expect(await readOfflineCaptureQueue()).toHaveLength(0);
  });

  it('clears the queue', async () => {
    await enqueueOfflineCapture({ assetUris: ['file://b.jpg'] });
    await clearOfflineCaptureQueue();
    expect(await readOfflineCaptureQueue()).toHaveLength(0);
  });
});
