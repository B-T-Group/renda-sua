import type { AxiosInstance } from 'axios';

/** Returns false when the backend has not shipped password login yet (404). */
export async function probePasswordLoginEndpoint(
  apiClient: AxiosInstance
): Promise<boolean> {
  try {
    const res = await apiClient.post(
      '/auth/password-login',
      {},
      {
        headers: { 'X-Client-Platform': 'web' },
        validateStatus: (status) =>
          status === 404 || status === 400 || status === 401 || status === 422,
      }
    );
    return res.status !== 404;
  } catch (err: any) {
    if (err?.response?.status === 404) return false;
    return true;
  }
}
