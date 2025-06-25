import axios, { AxiosInstance } from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export const useApiClient = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [apiClient, setApiClient] = useState<AxiosInstance | null>(null);

  useEffect(() => {
    const setupClient = () => {
      // Always create a base axios instance immediately
      const baseInstance = axios.create({
        baseURL: process.env.REACT_APP_API_URL ?? 'http://localhost:3000/api',
      });
      
      // Set the base instance immediately for unauthenticated users
      if (!isAuthenticated) {
        setApiClient(baseInstance);
        return;
      }

      // For authenticated users, try to get token with timeout
      const tokenTimeout = setTimeout(() => {
        console.warn('Token retrieval timed out, using base instance');
        setApiClient(baseInstance);
      }, 3000); // 3 second timeout for token

      getAccessTokenSilently()
        .then((token) => {
          clearTimeout(tokenTimeout);
          const instance = axios.create({
            baseURL: process.env.REACT_APP_API_URL ?? 'http://localhost:3000/api',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setApiClient(instance);
        })
        .catch((error) => {
          clearTimeout(tokenTimeout);
          console.error('Failed to get access token:', error);
          // Use base instance on error
          setApiClient(baseInstance);
        });
    };

    setupClient();
  }, [getAccessTokenSilently, isAuthenticated]);

  return apiClient;
}; 