import { act, renderHook } from '@testing-library/react';
import { useCurrentLocationAddress } from './useCurrentLocationAddress';

const mockPost = jest.fn();
const mockGetCurrentLocation = jest.fn();
let mockApiClient: { post: jest.Mock } | null = { post: mockPost };

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('./useCurrentLocation', () => ({
  useCurrentLocation: () => ({ getCurrentLocation: mockGetCurrentLocation }),
}));

describe('useCurrentLocationAddress', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGetCurrentLocation.mockReset();
    mockApiClient = { post: mockPost };
    mockGetCurrentLocation.mockResolvedValue({ latitude: 3.848, longitude: 11.502 });
    mockPost.mockResolvedValue({
      data: { data: { address: { id: 'addr-gps' } } },
    });
  });

  it('posts the device coordinates and returns the address id', async () => {
    const { result } = renderHook(() => useCurrentLocationAddress());

    let id: string | null = null;
    await act(async () => {
      id = await result.current.resolve();
    });

    expect(id).toBe('addr-gps');
    expect(result.current.status).toBe('success');
    expect(result.current.addressId).toBe('addr-gps');
    expect(mockGetCurrentLocation).toHaveBeenCalledWith(true);
    expect(mockPost).toHaveBeenCalledWith('/addresses/current-location', {
      latitude: 3.848,
      longitude: 11.502,
    });
  });

  it('fails closed when the API client or the address id is missing', async () => {
    mockApiClient = null;
    const missingClient = renderHook(() => useCurrentLocationAddress());
    await act(async () => {
      await expect(missingClient.result.current.resolve()).resolves.toBeNull();
    });
    expect(missingClient.result.current.status).toBe('failed');
    expect(mockGetCurrentLocation).not.toHaveBeenCalled();

    mockApiClient = { post: mockPost };
    mockPost.mockResolvedValue({ data: { data: {} } });
    const missingId = renderHook(() => useCurrentLocationAddress());
    await act(async () => {
      await expect(missingId.result.current.resolve()).resolves.toBeNull();
    });
    expect(missingId.result.current.status).toBe('failed');
    expect(missingId.result.current.addressId).toBeNull();
  });

  it('treats a permission denial differently from a position failure', async () => {
    mockGetCurrentLocation.mockRejectedValueOnce({ code: 1 });
    const denied = renderHook(() => useCurrentLocationAddress());
    await act(async () => {
      await expect(denied.result.current.resolve()).resolves.toBeNull();
    });
    expect(denied.result.current.status).toBe('denied');
    expect(mockPost).not.toHaveBeenCalled();

    mockGetCurrentLocation.mockRejectedValueOnce({ code: 2, message: 'unavailable' });
    const unavailable = renderHook(() => useCurrentLocationAddress());
    await act(async () => {
      await expect(unavailable.result.current.resolve()).resolves.toBeNull();
    });
    expect(unavailable.result.current.status).toBe('failed');

    mockPost.mockRejectedValueOnce(new Error('User denied Geolocation'));
    const message = renderHook(() => useCurrentLocationAddress());
    await act(async () => {
      await expect(message.result.current.resolve()).resolves.toBeNull();
    });
    expect(message.result.current.status).toBe('denied');
  });
});
