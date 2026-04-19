import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useCallback, useMemo } from 'react';
import { environment } from '../config/environment';
import { activePersonaHeaderForUser } from '../utils/activePersonaStorage';
import { decodeHasuraUserIdFromAccessToken } from '../utils/jwtHasura';
import { useLoading } from '../contexts/LoadingContext';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import { useTokenRefresh } from '../contexts/TokenRefreshContext';

/** AI cleanup can exceed the default axios 30s client timeout; force a longer limit. */
function applyImageCleanupTimeout(config: InternalAxiosRequestConfig) {
  const url = config.url ?? '';
  const method = (config.method ?? 'get').toLowerCase();
  if (method === 'post' && url.includes('/cleanup')) {
    config.timeout = environment.imageCleanupRequestTimeoutMs;
  }
}

/** Avoid stacking the global LoadingScreen on flows that already show inline loading. */
function shouldSkipGlobalLoadingForUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.includes('/cleanup')) return true;
  const substrings = [
    '/track-site-event',
    '/users/me',
    '/auth/email-availability',
    '/pdf/shipping-labels',
    '/locations/',
    '/notifications/',
    '/ai/image-item-suggestions',
    '/ai/item-refinement-suggestions',
    '/business-items/create-from-image',
    '/aws/presigned-url/image',
    '/business-images/bulk',
    '/orders/complete-delivery',
  ];
  if (substrings.some((s) => url.includes(s))) return true;
  if (url.includes('disassociate-item')) return false;
  if (url.includes('/associate-item')) return true;
  return false;
}

export const useApiClient = (): AxiosInstance => {
  const { isAuthenticated, getAccessToken, logout } = useSessionAuth();

  // Get loading context - hooks must be called unconditionally
  const loadingContext = useLoading();
  const { showLoading, hideLoading } = loadingContext || {};

  // Get token refresh context - hooks must be called unconditionally
  const tokenRefreshContext = useTokenRefresh();
  const { getValidToken, refreshToken } = tokenRefreshContext || {};

  const handleTokenRefresh = useCallback(async () => {
    try {
      if (refreshToken) {
        return await refreshToken();
      }
      return await getAccessToken();
    } catch (error) {
      console.error('Token refresh failed, logging out:', error);
      await logout();
      throw error;
    }
  }, [refreshToken, getAccessToken, logout]);

  const apiClient = useMemo(() => {
    const instance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use(async (config) => {
      if (isAuthenticated) {
        try {
          // Use token refresh context if available, otherwise fallback to direct Auth0 call
          const token = getValidToken
            ? await getValidToken()
            : await getAccessToken();

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            const uid = decodeHasuraUserIdFromAccessToken(token);
            const persona = uid ? activePersonaHeaderForUser(uid) : undefined;
            if (persona) {
              config.headers['X-Active-Persona'] = persona;
            }
          } else {
            config.headers['X-Hasura-Role'] = 'anonymous';
          }
        } catch (error) {
          console.error('Failed to get access token:', error);
          // Fallback to anonymous role if token retrieval fails
          config.headers['X-Hasura-Role'] = 'anonymous';
        }
      } else {
        // Not authenticated, use anonymous role
        config.headers['X-Hasura-Role'] = 'anonymous';
      }

      applyImageCleanupTimeout(config);

      if (showLoading && !shouldSkipGlobalLoadingForUrl(config.url)) {
        showLoading();
      }

      return config;
    });

    instance.interceptors.response.use(
      (response) => {
        // Hide loading on successful response
        if (hideLoading) {
          hideLoading();
        }
        return response;
      },
      async (error: AxiosError) => {
        // Hide loading on error
        if (hideLoading) {
          hideLoading();
        }

        // Handle 401 Unauthorized errors (only for authenticated users)
        if (error.response?.status === 401 && isAuthenticated) {
          console.log('Token expired, attempting refresh...');
          try {
            const newToken = await handleTokenRefresh();

            // Retry the original request with new token
            const originalRequest = error.config;
            if (originalRequest && newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              const uid = decodeHasuraUserIdFromAccessToken(newToken);
              const persona = uid ? activePersonaHeaderForUser(uid) : undefined;
              if (persona) {
                originalRequest.headers['X-Active-Persona'] = persona;
              }
              return instance.request(originalRequest);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Don't redirect here as handleTokenRefresh already handles it
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }, [
    isAuthenticated,
    showLoading,
    hideLoading,
    handleTokenRefresh,
    getValidToken,
    getAccessToken,
  ]);

  return apiClient;
};
