import { beforeEach, describe, expect, it, vi } from 'vitest';
import StorageService from '../services/storage/StorageService';
import {
  dismissLaunchPromo,
  isLaunchPromoDismissed,
  launchPromoDismissKey,
} from './launchPromoBanner';

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getString: vi.fn(),
    setString: vi.fn(),
  },
}));

describe('launchPromoBanner', () => {
  beforeEach(() => {
    vi.mocked(StorageService.getString).mockReset();
    vi.mocked(StorageService.setString).mockReset();
  });

  it('builds a stable dismiss key from business and claim time', () => {
    expect(launchPromoDismissKey('biz-1', '2026-01-01T00:00:00.000Z')).toBe(
      'rendasua:business:biz-1:launch-promo-dismissed:2026-01-01T00:00:00.000Z'
    );
  });

  it('reads dismissed state from storage', async () => {
    vi.mocked(StorageService.getString).mockResolvedValue('1');
    await expect(
      isLaunchPromoDismissed('biz-1', 'claim-at')
    ).resolves.toBe(true);
    vi.mocked(StorageService.getString).mockResolvedValue(null);
    await expect(
      isLaunchPromoDismissed('biz-1', 'claim-at')
    ).resolves.toBe(false);
  });

  it('persists dismiss', async () => {
    await dismissLaunchPromo('biz-1', 'claim-at');
    expect(StorageService.setString).toHaveBeenCalledWith(
      launchPromoDismissKey('biz-1', 'claim-at'),
      '1'
    );
  });
});
