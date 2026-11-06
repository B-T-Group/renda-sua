import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import StorageService from '../services/storage/StorageService';
import { usePersistedDismiss } from './usePersistedDismiss';

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getString: vi.fn(),
    setString: vi.fn(),
  },
}));

describe('usePersistedDismiss', () => {
  beforeEach(() => {
    vi.mocked(StorageService.getString).mockReset();
    vi.mocked(StorageService.setString).mockReset();
  });

  it('hides after dismiss and persists the flag', async () => {
    vi.mocked(StorageService.getString).mockResolvedValue(null);
    vi.mocked(StorageService.setString).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePersistedDismiss('tip:key'));
    await waitFor(() => expect(result.current.visible).toBe(true));
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.visible).toBe(false);
    expect(StorageService.setString).toHaveBeenCalledWith('tip:key', '1');
  });

  it('stays hidden when already dismissed in storage', async () => {
    vi.mocked(StorageService.getString).mockResolvedValue('1');
    const { result } = renderHook(() => usePersistedDismiss('tip:key'));
    await waitFor(() => expect(result.current.visible).toBe(false));
  });
});
