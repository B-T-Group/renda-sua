import { Close, GetApp } from '@mui/icons-material';
import { Box, Button, IconButton, Paper, Stack, Typography, alpha, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDownloadBanner } from '../../hooks/useAppDownloadBanner';
import { APP_STORE_URL, PLAY_STORE_URL, useAppStoreLinks } from '../../hooks/useAppStoreLinks';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from '../../hooks/useTrackSiteEvent';
import AppStoreBadges from './AppStoreBadges';

interface AppDownloadBannerProps {
  sourceSection?: string;
}

const AppDownloadBanner: React.FC<AppDownloadBannerProps> = ({ sourceSection = 'items_page' }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { dismissed, dismiss } = useAppDownloadBanner();
  const { detectedOS } = useAppStoreLinks();
  const { trackSiteEvent } = useTrackSiteEvent();

  if (dismissed) return null;

  const handleDownload = () => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'download_click', source_section: sourceSection, store: detectedOS === 'android' ? 'playStore' : 'appStore' },
    });
    const url = detectedOS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        border: '1.5px solid',
        borderColor: alpha(theme.palette.primary.main, 0.2),
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        overflow: 'hidden',
      }}
      role="banner"
      aria-label={t('common.appDownloadBannerLabel', 'App download banner')}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
        <Box
          sx={{
            width: { xs: 36, sm: 44 },
            height: { xs: 36, sm: 44 },
            borderRadius: 2,
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <GetApp sx={{ color: '#fff', fontSize: { xs: 20, sm: 24 } }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
            {t('common.bannerTitle', 'Get real-time tracking & faster checkout')}
          </Typography>
          {!isMobile && (
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
              {t('common.bannerSubtitle', 'Download the Rendasua app for the best shopping experience')}
            </Typography>
          )}
        </Box>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
          {isMobile ? (
            <Button
              size="small"
              variant="contained"
              onClick={handleDownload}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, whiteSpace: 'nowrap', fontSize: '0.78rem' }}
            >
              {t('common.openInApp', 'Open in App')}
            </Button>
          ) : (
            <AppStoreBadges variant="compact" sourceSection={sourceSection} />
          )}

          <IconButton
            size="small"
            onClick={dismiss}
            sx={{ color: 'text.secondary' }}
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default AppDownloadBanner;
