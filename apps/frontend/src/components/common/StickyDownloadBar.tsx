import { Close, GetApp } from '@mui/icons-material';
import { Box, Button, IconButton, Slide, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useAppDownloadBanner } from '../../hooks/useAppDownloadBanner';
import { APP_STORE_URL, PLAY_STORE_URL, useAppStoreLinks } from '../../hooks/useAppStoreLinks';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from '../../hooks/useTrackSiteEvent';

const StickyDownloadBar: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated } = useSessionAuth();
  const { dismissed, dismiss } = useAppDownloadBanner();
  const { detectedOS } = useAppStoreLinks();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = !dismissed && !isAuthenticated && isMobile && scrolled;

  const handleDownload = () => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'download_click', source_section: 'sticky_bar', store: detectedOS === 'android' ? 'playStore' : 'appStore' },
    });
    const url = detectedOS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.snackbar,
          bgcolor: '#0f172a',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          px: 2,
          py: 1.25,
          // Safe area bottom padding for notched devices
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        }}
        role="banner"
        aria-label={t('common.appDownloadBannerLabel', 'App download banner')}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <GetApp sx={{ color: '#fff', fontSize: 20 }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: '#fff', fontWeight: 700, display: 'block', lineHeight: 1.2 }}
            >
              {t('common.stickyBarTitle', 'Get a better experience')}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem', lineHeight: 1.2 }}
            >
              {t('common.stickyBarSubtitle', 'Real-time tracking, push notifications & more')}
            </Typography>
          </Box>

          <Button
            size="small"
            variant="contained"
            onClick={handleDownload}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.75rem',
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t('common.openInApp', 'Open in App')}
          </Button>

          <IconButton
            size="small"
            onClick={dismiss}
            sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Slide>
  );
};

export default StickyDownloadBar;
