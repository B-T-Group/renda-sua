import { useAuth0 } from '@auth0/auth0-react';
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { tokenService } from '../services/tokenService';

interface TokenRefreshContextType {
  refreshToken: () => Promise<string | null>;
  getValidToken: () => Promise<string | null>;
  isTokenExpired: (token?: string) => boolean;
}

const TokenRefreshContext = createContext<TokenRefreshContextType | null>(null);

interface TokenRefreshProviderProps {
  children: ReactNode;
}

export const TokenRefreshProvider: React.FC<TokenRefreshProviderProps> = ({ children }) => {
  const auth0 = useAuth0();

  useEffect(() => {
    // Initialize token service with Auth0 instance
    tokenService.setAuth0Instance(auth0);

    // Setup initial token refresh if user is authenticated
    if (auth0.isAuthenticated && auth0.getAccessTokenSilently) {
      auth0.getAccessTokenSilently()
        .then(token => {
          if (token) {
            tokenService.scheduleTokenRefresh(token);
          }
        })
        .catch(error => {
          console.error('Error setting up initial token refresh:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      tokenService.clearRefreshTimer();
    };
  }, [auth0.isAuthenticated, auth0.getAccessTokenSilently]);

  const contextValue: TokenRefreshContextType = {
    refreshToken: tokenService.refreshToken.bind(tokenService),
    getValidToken: tokenService.getValidToken.bind(tokenService),
    isTokenExpired: tokenService.isTokenExpired.bind(tokenService),
  };

  return (
    <TokenRefreshContext.Provider value={contextValue}>
      {children}
    </TokenRefreshContext.Provider>
  );
};

export const useTokenRefresh = (): TokenRefreshContextType => {
  const context = useContext(TokenRefreshContext);
  
  if (!context) {
    throw new Error('useTokenRefresh must be used within a TokenRefreshProvider');
  }
  
  return context;
};

export default TokenRefreshContext;








