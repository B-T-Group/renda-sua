import { GetApp, Map, NotificationsActive, Pin } from '@mui/icons-material';
import { Box, Button, Stack, Typography, alpha, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStoreLinks, APP_STORE_URL, PLAY_STORE_URL } from '../../hooks/useAppStoreLinks';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from '../../hooks/useTrackSiteEvent';

const InGridAppPromoTile: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { detectedOS } = useAppStoreLinks();
  const { trackSiteEvent } = useTrackSiteEvent();

  const handleDownload = () => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'download_click', source_section: 'items_in_grid_promo', store: detectedOS === 'android' ? 'playStore' : 'appStore' },
    });
    const url = detectedOS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      sx={{
        border: `1.5px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        borderRadius: 2.5,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 240,
      }}
      aria-label={t('common.appPromoTileLabel', 'Download the Rendasua app')}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          bgcolor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
        aria-hidden="true"
      >
        <GetApp sx={{ color: '#fff', fontSize: 24 }} />
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.2 }}>
        {t('common.promoTileTitle', 'Better in the app')}
      </Typography>

      <Stack spacing={0.75} sx={{ mb: 2.5 }}>
        {[
          { icon: <Map sx={{ fontSize: 14 }} />, text: t('common.promoTileTracking', 'Live delivery tracking') },
          { icon: <Pin sx={{ fontSize: 14 }} />, text: t('common.promoTilePin', 'Secure PIN delivery') },
          { icon: <NotificationsActive sx={{ fontSize: 14 }} />, text: t('common.promoTileNotifs', 'Instant notifications') },
        ].map((f) => (
          <Stack key={f.text} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ color: 'primary.main', display: 'flex' }}>{f.icon}</Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
              {f.text}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Button
        variant="contained"
        size="small"
        onClick={handleDownload}
        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, alignSelf: 'flex-start', fontSize: '0.78rem' }}
      >
        {t('common.downloadFree', 'Download Free')}
      </Button>
    </Box>
  );
};

export default InGridAppPromoTile;
