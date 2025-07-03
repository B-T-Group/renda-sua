import { Auth0Provider } from '@auth0/auth0-react';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './app/app';
import { environment } from './config/environment';
import { LoadingProvider } from './contexts/LoadingContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import './i18n'; // Initialize i18n
import { theme } from './theme/theme';

// Create auth0 config from environment
const auth0Config = {
  domain: environment.auth0.domain,
  clientId: environment.auth0.clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
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
              <App />
            </UserProfileProvider>
          </LoadingProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Auth0Provider>
  </StrictMode>
);
