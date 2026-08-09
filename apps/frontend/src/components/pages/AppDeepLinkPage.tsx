import {
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const APP_STORE_URL =
  'https://apps.apple.com/app/rendasua/id6755989000';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.rendasua.agent';

/**
 * Universal-link landing: /app/* → try custom scheme, else stores / in-web path.
 */
const AppDeepLinkPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const appRelative = useMemo(
    () => location.pathname.replace(/^\/app\/?/, '') + location.search,
    [location.pathname, location.search]
  );
  const schemeUrl = `rendasua://${appRelative}`;
  const webFallbackPath = useMemo(
    () => mapAppPathToWeb(`/${appRelative}`),
    [appRelative]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = schemeUrl;
    }, 50);
    const fallback = window.setTimeout(() => {
      // Stay on page so user can pick store / open web
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
    };
  }, [schemeUrl]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3} alignItems="center" textAlign="center">
        <CircularProgress size={28} />
        <Typography variant="h5" fontWeight={700}>
          {t('deepLink.openingApp', 'Opening Rendasua…')}
        </Typography>
        <Typography color="text.secondary">
          {t(
            'deepLink.helper',
            'If the app does not open, download it or continue in the browser.'
          )}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" href={schemeUrl}>
            {t('deepLink.openApp', 'Open app')}
          </Button>
          <Button variant="outlined" onClick={() => navigate(webFallbackPath)}>
            {t('deepLink.continueWeb', 'Continue in browser')}
          </Button>
        </Stack>
        <Box>
          <Button size="small" href={APP_STORE_URL} sx={{ mr: 1 }}>
            App Store
          </Button>
          <Button size="small" href={PLAY_STORE_URL}>
            Google Play
          </Button>
        </Box>
      </Stack>
    </Container>
  );
};

function mapAppPathToWeb(path: string): string {
  if (path.startsWith('/wallet')) return '/accounts';
  if (path.startsWith('/verification')) return '/documents';
  if (path.startsWith('/chat/')) {
    const id = path.replace('/chat/', '').split(/[?#]/)[0];
    return `/orders/${id}?messages=1`;
  }
  if (path.startsWith('/deliveries/')) {
    const id = path.replace('/deliveries/', '').split(/[?#]/)[0];
    return `/orders/${id}`;
  }
  if (path.startsWith('/rentals/requests')) return '/business/rentals/requests';
  if (path.startsWith('/items/')) {
    const id = path.replace('/items/', '').split(/[?#]/)[0];
    return `/business/items/${id}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export default AppDeepLinkPage;
