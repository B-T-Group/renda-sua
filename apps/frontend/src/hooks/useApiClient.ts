import { useAuth0 } from '@auth0/auth0-react';
import axios, { AxiosInstance } from 'axios';
import { useMemo } from 'react';
import { environment } from '../config/environment';
import { useLoading } from '../contexts/LoadingContext';

export const useApiClient = (): AxiosInstance | null => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Safely get loading context - it might not be available during initial render
  let loadingContext;
  try {
    loadingContext = useLoading();
  } catch (error) {
    // Loading context not available yet, continue without it
    loadingContext = null;
  }

  const { showLoading, hideLoading } = loadingContext || {};

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
      const token = await getAccessTokenSilently();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
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
      (error) => {
        // Hide loading on error
        if (hideLoading) {
          hideLoading();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [getAccessTokenSilently, isAuthenticated, showLoading, hideLoading]);

  return apiClient;
};
