import { useMemo } from 'react';
import axios, { AxiosInstance } from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

export const useApiClient = (): AxiosInstance | null => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const apiClient = useMemo(() => {
    if (!isAuthenticated) return null;

    const instance = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use(async (config) => {
      const token = await getAccessTokenSilently();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, [getAccessTokenSilently, isAuthenticated]);

  return apiClient;
};
