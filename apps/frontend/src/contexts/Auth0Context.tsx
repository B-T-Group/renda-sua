import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

interface Auth0ContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  loginWithRedirect: () => void;
  logout: () => void;
  getAccessTokenSilently: () => Promise<string>;
}

const Auth0Context = createContext<Auth0ContextType | undefined>(undefined);

export const useAuth0Context = () => {
  const context = useContext(Auth0Context);
  if (context === undefined) {
    throw new Error('useAuth0Context must be used within an Auth0Provider');
  }
  return context;
};

interface Auth0ProviderProps {
  children: React.ReactNode;
}

export const Auth0Provider: React.FC<Auth0ProviderProps> = ({ children }) => {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [token, setToken] = useState<string | null>(null);

  // Get and store the access token when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((accessToken: string) => {
          setToken(accessToken);
          localStorage.setItem('auth0_token', accessToken);
        })
        .catch((error: any) => {
          console.error('Error getting access token:', error);
        });
    } else {
      setToken(null);
      localStorage.removeItem('auth0_token');
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  const logout = () => {
    localStorage.removeItem('auth0_token');
    setToken(null);
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const value: Auth0ContextType = {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  };

  return (
    <Auth0Context.Provider value={value}>
      {children}
    </Auth0Context.Provider>
  );
}; 