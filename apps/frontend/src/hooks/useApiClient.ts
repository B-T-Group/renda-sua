import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export const useApiClient = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [apiClient, setApiClient] = useState(() => axios.create());

  useEffect(() => {
    const setupClient = async () => {
      if (!isAuthenticated) return;

      const token = await getAccessTokenSilently();
      const instance = axios.create({
        baseURL: process.env.REACT_APP_API_URL, 
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setApiClient(instance);
    };

    setupClient();
  }, [getAccessTokenSilently, isAuthenticated]);

  return apiClient;
}; 