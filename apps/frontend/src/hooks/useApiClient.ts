import { useAuth0 } from '@auth0/auth0-react';
import axios, { AxiosInstance } from 'axios';
import { useMemo } from 'react';
import { environment } from '../config/environment';

export const useApiClient = (): AxiosInstance | null => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

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
      return config;
    });

    return instance;
  }, [getAccessTokenSilently, isAuthenticated]);

  return apiClient;
};
