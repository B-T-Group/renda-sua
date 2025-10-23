import { useAuth0 } from '@auth0/auth0-react';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { useCallback, useMemo } from 'react';
import { environment } from '../config/environment';
import { useLoading } from '../contexts/LoadingContext';
import { useTokenRefresh } from '../contexts/TokenRefreshContext';

export const useApiClient = (): AxiosInstance => {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
    useAuth0();

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
      } else {
        // Fallback to direct Auth0 call if context not available
        await getAccessTokenSilently({ cacheMode: 'off' });
        return await getAccessTokenSilently();
      }
    } catch (error) {
      console.error('Token refresh failed, redirecting to login:', error);
      await loginWithRedirect();
      throw error;
    }
  }, [refreshToken, getAccessTokenSilently, loginWithRedirect]);

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
            : await getAccessTokenSilently();

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
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

      // Show loading for API calls (except for specific endpoints that don't need loading)
      const skipLoadingEndpoints = ['/users/me']; // Add endpoints that shouldn't show loading
      if (
        showLoading &&
        !skipLoadingEndpoints.some((endpoint) => config.url?.includes(endpoint))
      ) {
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
    getAccessTokenSilently,
    isAuthenticated,
    showLoading,
    hideLoading,
    handleTokenRefresh,
    loginWithRedirect,
    getValidToken,
  ]);

  return apiClient;
};
