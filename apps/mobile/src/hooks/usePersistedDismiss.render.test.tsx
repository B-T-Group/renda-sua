import { act, renderHook, waitFor } from '@testing-library/react-native';
import StorageService from '../services/storage/StorageService';
import { usePersistedDismiss } from './usePersistedDismiss';

jest.mock('../services/storage/StorageService', () => ({
  __esModule: true,
  default: {
    getString: jest.fn(),
    setString: jest.fn(),
  },
}));

const getString = jest.mocked(StorageService.getString);
const setString = jest.mocked(StorageService.setString);

describe('usePersistedDismiss', () => {
  beforeEach(() => {
    getString.mockReset();
    setString.mockReset();
  });

  it('hides after dismiss and persists the flag', async () => {
    getString.mockResolvedValue(null);
    setString.mockResolvedValue(undefined);
    const view = await renderHook(() => usePersistedDismiss('tip:key'));
    await waitFor(() => expect(view.result.current?.visible).toBe(true));
    await act(async () => {
      view.result.current?.dismiss();
    });
    expect(view.result.current?.visible).toBe(false);
    expect(setString).toHaveBeenCalledWith('tip:key', '1');
  });

  it('stays hidden when already dismissed in storage', async () => {
    getString.mockResolvedValue('1');
    const view = await renderHook(() => usePersistedDismiss('tip:key'));
    await waitFor(() => {
      expect(getString).toHaveBeenCalled();
      expect(view.result.current?.visible).toBe(false);
    });
  });
});
