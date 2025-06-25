import axios, { AxiosInstance } from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export const useApiClient = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [apiClient, setApiClient] = useState<AxiosInstance | null>(null);

  useEffect(() => {
    const setupClient = () => {
      if (!isAuthenticated) {
        // Create a basic axios instance without auth token when not authenticated
        const instance = axios.create({
          baseURL: process.env.REACT_APP_API_URL ?? 'http://localhost:3000/api',
        });
        setApiClient(instance);
        return;
      }

      getAccessTokenSilently()
        .then((token) => {
          console.log('token', token);
          const instance = axios.create({
            baseURL:
              process.env.REACT_APP_API_URL ?? 'http://localhost:3000/api',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setApiClient(instance);
        })
        .catch((error) => {
          console.error('Failed to get access token:', error);
          // Create a basic axios instance without auth token on error
          const instance = axios.create({
            baseURL: process.env.REACT_APP_API_URL ?? 'http://localhost:3000/api',
          });
          setApiClient(instance);
        });
    };

    setupClient();
  }, [getAccessTokenSilently, isAuthenticated]);

  return apiClient;
}; 