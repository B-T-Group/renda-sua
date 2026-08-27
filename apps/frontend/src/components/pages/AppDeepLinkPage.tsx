import {
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDeepLinkLanding } from '../../hooks/useAppDeepLinkLanding';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../hooks/useAppStoreLinks';

/**
 * Universal-link landing: /app/* → custom scheme / Android intent, else stores.
 * WhatsApp opens this in an in-app WebView that does not fire Universal Links.
 */
const AppDeepLinkPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { inAppBrowser, openHref, webFallbackPath } = useAppDeepLinkLanding();
  const helper = inAppBrowser
    ? t(
        'deepLink.inAppHelper',
        'Tap Open app. If nothing happens on iPhone, tap ⋯ then Open in Safari.'
      )
    : t(
        'deepLink.helper',
        'If the app does not open, download it or continue in the browser.'
      );

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3} alignItems="center" textAlign="center">
        {!inAppBrowser ? <CircularProgress size={28} /> : null}
        <Typography variant="h5" fontWeight={700}>
          {t('deepLink.openingApp', 'Opening Rendasua…')}
        </Typography>
        <Typography color="text.secondary">{helper}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" href={openHref}>
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

export default AppDeepLinkPage;
