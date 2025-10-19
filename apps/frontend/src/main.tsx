import { Auth0Provider } from '@auth0/auth0-react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/apple-fonts.css';

import App from './app/app';
import { environment } from './config/environment';
import { CartProvider } from './contexts/CartContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import './i18n'; // Initialize i18n
import ApolloProvider from './providers/ApolloProvider';
import { theme } from './theme/theme';

// Create auth0 config from environment
const auth0Config = {
  domain: environment.auth0.domain,
  clientId: environment.auth0.clientId,
  authorizationParams: {
    redirect_uri: `${window.location.origin}/app`,
    audience: environment.auth0.audience,
    scope: 'openid profile email',
  },
  cacheLocation: 'localstorage' as const,
  useRefreshTokens: true,
  skipRedirectCallback: window.location.pathname === '/loading-demo',
  // Performance optimizations
  advancedOptions: {
    defaultScope: 'openid profile email',
  },
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <Auth0Provider {...auth0Config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <LoadingProvider>
            <UserProfileProvider>
              <CartProvider>
                <ApolloProvider>
                  <App />
                </ApolloProvider>
              </CartProvider>
            </UserProfileProvider>
          </LoadingProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Auth0Provider>
  </StrictMode>
);
