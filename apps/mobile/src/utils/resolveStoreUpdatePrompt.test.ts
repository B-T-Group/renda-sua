import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/appVersionPolicyApi', () => ({
  fetchMobileVersionPolicy: vi.fn(),
}));

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getString: vi.fn(),
    setString: vi.fn(),
  },
}));

import { fetchMobileVersionPolicy } from '../services/appVersionPolicyApi';
import StorageService from '../services/storage/StorageService';
import { resolveStoreUpdatePrompt } from './resolveStoreUpdatePrompt';

describe('resolveStoreUpdatePrompt', () => {
  beforeEach(() => {
    vi.mocked(fetchMobileVersionPolicy).mockReset();
    vi.mocked(StorageService.getString).mockReset();
  });

  it('forces update when below minVersion', async () => {
    vi.mocked(fetchMobileVersionPolicy).mockResolvedValue({
      minVersion: '1.0.12',
      recommendedVersion: '1.0.12',
    });
    await expect(resolveStoreUpdatePrompt('1.0.10')).resolves.toEqual({
      mode: 'force',
      targetVersion: '1.0.12',
    });
  });

  it('soft-prompts when below recommended and not dismissed', async () => {
    vi.mocked(fetchMobileVersionPolicy).mockResolvedValue({
      minVersion: null,
      recommendedVersion: '1.0.12',
    });
    vi.mocked(StorageService.getString).mockResolvedValue(null);
    await expect(resolveStoreUpdatePrompt('1.0.11')).resolves.toEqual({
      mode: 'soft',
      targetVersion: '1.0.12',
    });
  });

  it('skips soft prompt when already dismissed for that version', async () => {
    vi.mocked(fetchMobileVersionPolicy).mockResolvedValue({
      minVersion: null,
      recommendedVersion: '1.0.12',
    });
    vi.mocked(StorageService.getString).mockResolvedValue('1.0.12');
    await expect(resolveStoreUpdatePrompt('1.0.11')).resolves.toBeNull();
  });

  it('returns null when current is up to date', async () => {
    vi.mocked(fetchMobileVersionPolicy).mockResolvedValue({
      minVersion: '1.0.10',
      recommendedVersion: '1.0.12',
    });
    await expect(resolveStoreUpdatePrompt('1.0.12')).resolves.toBeNull();
  });
});
