/**
 * Offline capture queue for product creation.
 * Stores local photo URIs + hint until the device is online, then callers sync.
 */

import StorageService from '../services/storage/StorageService';

const QUEUE_KEY = 'productCreateOfflineQueue';

export interface OfflineCaptureJob {
  id: string;
  assetUris: string[];
  hint?: string;
  createdAt: number;
}

export async function readOfflineCaptureQueue(): Promise<OfflineCaptureJob[]> {
  const jobs = await StorageService.getObject<OfflineCaptureJob[]>(QUEUE_KEY);
  return Array.isArray(jobs) ? jobs : [];
}

export async function enqueueOfflineCapture(job: {
  assetUris: string[];
  hint?: string;
}): Promise<OfflineCaptureJob> {
  const entry: OfflineCaptureJob = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assetUris: job.assetUris,
    hint: job.hint,
    createdAt: Date.now(),
  };
  const current = await readOfflineCaptureQueue();
  await StorageService.setObject(QUEUE_KEY, [...current, entry]);
  return entry;
}

export async function dequeueOfflineCapture(id: string): Promise<void> {
  const current = await readOfflineCaptureQueue();
  await StorageService.setObject(
    QUEUE_KEY,
    current.filter((j) => j.id !== id)
  );
}

export async function clearOfflineCaptureQueue(): Promise<void> {
  await StorageService.remove(QUEUE_KEY);
}
