import { useAuth0 } from '@auth0/auth0-react';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { useCallback, useMemo } from 'react';
import { environment } from '../config/environment';
import { useLoading } from '../contexts/LoadingContext';

export const useApiClient = (): AxiosInstance | null => {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
    useAuth0();

  // Safely get loading context - it might not be available during initial render
  let loadingContext;
  try {
    loadingContext = useLoading();
  } catch (error) {
    // Loading context not available yet, continue without it
    loadingContext = null;
  }

  const { showLoading, hideLoading } = loadingContext || {};

  const handleTokenRefresh = useCallback(async () => {
    try {
      await getAccessTokenSilently({ cacheMode: 'off' });
    } catch (error) {
      console.error('Token refresh failed, redirecting to login:', error);
      await loginWithRedirect();
    }
  }, [getAccessTokenSilently, loginWithRedirect]);

  const apiClient = useMemo(() => {
    if (!isAuthenticated) return null;

    const instance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use(async (config) => {
      try {
        const token = await getAccessTokenSilently();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          config.headers['X-Hasura-Role'] = 'anonymous';
        }
      } catch (error) {
        console.error('Failed to get access token:', error);
        // Don't throw here, let the request proceed and handle 401 in response interceptor
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

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401) {
          console.log('Token expired, attempting refresh...');
          try {
            await handleTokenRefresh();
            // Retry the original request with new token
            const originalRequest = error.config;
            if (originalRequest) {
              const token = await getAccessTokenSilently();
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return instance.request(originalRequest);
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Redirect to login if refresh fails
            await loginWithRedirect();
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
  ]);

  return apiClient;
};
