import { Auth0ContextInterface } from '@auth0/auth0-react';

export interface TokenRefreshService {
  refreshToken: () => Promise<string | null>;
  getValidToken: () => Promise<string | null>;
  isTokenExpired: (token?: string) => boolean;
  scheduleTokenRefresh: (token: string) => void;
  clearRefreshTimer: () => void;
}

class TokenService implements TokenRefreshService {
  private auth0: Auth0ContextInterface | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes before expiry

  setAuth0Instance(auth0: Auth0ContextInterface) {
    this.auth0 = auth0;
  }

  async refreshToken(): Promise<string | null> {
    if (!this.auth0?.getAccessTokenSilently) {
      throw new Error('Auth0 instance not available');
    }

    try {
      console.log('Refreshing token...');
      const token = await this.auth0.getAccessTokenSilently({ cacheMode: 'off' });
      
      if (token) {
        console.log('Token refreshed successfully');
        this.scheduleTokenRefresh(token);
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // If refresh fails, redirect to login
      if (this.auth0?.loginWithRedirect) {
        await this.auth0.loginWithRedirect();
      }
      
      throw error;
    }
  }

  async getValidToken(): Promise<string | null> {
    if (!this.auth0?.getAccessTokenSilently || !this.auth0?.isAuthenticated) {
      return null;
    }

    try {
      // First try to get cached token
      const token = await this.auth0.getAccessTokenSilently();
      
      // Check if token is expired or will expire soon
      if (this.isTokenExpired(token)) {
        console.log('Token expired or expiring soon, refreshing...');
        return await this.refreshToken();
      }
      
      // Schedule refresh if not already scheduled
      this.scheduleTokenRefresh(token);
      return token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      // Try to refresh token
      return await this.refreshToken();
    }
  }

  isTokenExpired(token?: string): boolean {
    if (!token) return true;

    try {
      // Decode JWT token to check expiry
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const expiryTime = payload.exp;
      
      // Consider token expired if it expires within the buffer time
      return (expiryTime - currentTime) < (this.REFRESH_BUFFER_TIME / 1000);
    } catch (error) {
      console.error('Error parsing token:', error);
      return true;
    }
  }

  scheduleTokenRefresh(token: string): void {
    this.clearRefreshTimer();

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now();
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const refreshTime = expiryTime - currentTime - this.REFRESH_BUFFER_TIME;

      if (refreshTime > 0) {
        console.log(`Scheduling token refresh in ${Math.floor(refreshTime / 1000 / 60)} minutes`);
        
        this.refreshTimer = setTimeout(async () => {
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('Scheduled token refresh failed:', error);
          }
        }, refreshTime);
      }
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
  }

  clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();

// Utility functions for manual token management
export const createTokenRefreshInterceptor = (
  getAccessTokenSilently: Auth0ContextInterface['getAccessTokenSilently'],
  loginWithRedirect: Auth0ContextInterface['loginWithRedirect']
) => {
  return async (error: any) => {
    if (error.response?.status === 401) {
      console.log('401 error detected, attempting token refresh...');
      
      try {
        // Clear cache and get fresh token
        await getAccessTokenSilently({ cacheMode: 'off' });
        
        // Retry the original request
        if (error.config) {
          const newToken = await getAccessTokenSilently();
          error.config.headers.Authorization = `Bearer ${newToken}`;
          
          // Return a new request with the refreshed token
          return error.config;
        }
      } catch (refreshError) {
        console.error('Token refresh failed, redirecting to login:', refreshError);
        await loginWithRedirect();
      }
    }
    
    throw error;
  };
};

export default tokenService;







