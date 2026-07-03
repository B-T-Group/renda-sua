import { Apple } from '@mui/icons-material';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from '../../hooks/useTrackSiteEvent';
import { APP_STORE_URL, PLAY_STORE_URL, useAppStoreLinks } from '../../hooks/useAppStoreLinks';

const QRCode = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })));

export type AppStoreBadgesVariant = 'default' | 'compact' | 'withQr' | 'dark';

interface AppStoreBadgesProps {
  variant?: AppStoreBadgesVariant;
  sourceSection?: string;
  direction?: 'row' | 'column';
}

const AndroidIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6.18 15.64a2.18 2.18 0 0 1-2.18-2.18V9.36a2.18 2.18 0 0 1 4.36 0v4.1a2.18 2.18 0 0 1-2.18 2.18m11.64 0a2.18 2.18 0 0 1-2.18-2.18V9.36a2.18 2.18 0 0 1 4.36 0v4.1a2.18 2.18 0 0 1-2.18 2.18M3.18 7.07c0-.43.35-.78.78-.78h16.08c.43 0 .78.35.78.78v9.44c0 .43-.35.78-.78.78H3.96a.78.78 0 0 1-.78-.78zm.44-3.2 1.35 2.33H19.03l1.35-2.33a.44.44 0 0 1 .76.44L19.8 6.29H4.2L2.86 4.31a.44.44 0 0 1 .76-.44M9 18.5a1.5 1.5 0 0 0 3 0v-2H9zm3 0a1.5 1.5 0 0 0 3 0v-2h-3z" />
  </svg>
);

const AppStoreBadges: React.FC<AppStoreBadgesProps> = ({
  variant = 'default',
  sourceSection = 'unknown',
  direction,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { trackSiteEvent } = useTrackSiteEvent();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { detectedOS } = useAppStoreLinks();

  const isCompact = variant === 'compact';
  const isDark = variant === 'dark';
  const showQr = variant === 'withQr' && isDesktop;

  const handleStoreClick = (store: 'appStore' | 'playStore', url: string) => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'download_click', store, source_section: sourceSection },
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const buttonSx = {
    borderRadius: 2,
    px: isCompact ? 1.5 : 2,
    py: isCompact ? 0.75 : 1,
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: isCompact ? '0.75rem' : '0.875rem',
    gap: 0.75,
    minWidth: isCompact ? 120 : 140,
    justifyContent: 'flex-start',
    ...(isDark
      ? {
          bgcolor: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
        }
      : {
          bgcolor: '#000',
          color: '#fff',
          border: '1px solid #000',
          '&:hover': { bgcolor: '#111' },
        }),
  };

  const iosFirst = detectedOS !== 'android';

  const iosButton = (
    <Button
      variant="contained"
      onClick={() => handleStoreClick('appStore', APP_STORE_URL)}
      startIcon={<Apple />}
      sx={buttonSx}
      aria-label={t('common.downloadOnAppStore', 'Download on the App Store')}
    >
      <Box>
        {!isCompact && (
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, fontSize: '0.65rem', lineHeight: 1 }}>
            {t('common.downloadOn', 'Download on the')}
          </Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: isCompact ? '0.7rem' : '0.85rem', lineHeight: 1.2 }}>
          App Store
        </Typography>
      </Box>
    </Button>
  );

  const androidButton = (
    <Button
      variant="contained"
      onClick={() => handleStoreClick('playStore', PLAY_STORE_URL)}
      startIcon={<AndroidIcon size={isCompact ? 16 : 20} />}
      sx={buttonSx}
      aria-label={t('common.getOnGooglePlay', 'Get it on Google Play')}
    >
      <Box>
        {!isCompact && (
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, fontSize: '0.65rem', lineHeight: 1 }}>
            {t('common.getItOn', 'Get it on')}
          </Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: isCompact ? '0.7rem' : '0.85rem', lineHeight: 1.2 }}>
          Google Play
        </Typography>
      </Box>
    </Button>
  );

  const resolvedDirection = direction ?? (isCompact ? 'row' : 'row');

  return (
    <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap">
      <Stack direction={resolvedDirection} spacing={1.5} flexWrap="wrap">
        {iosFirst ? iosButton : androidButton}
        {iosFirst ? androidButton : iosButton}
      </Stack>

      {showQr && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            ml: 2,
          }}
        >
          <Box
            sx={{
              p: 1,
              bgcolor: '#fff',
              borderRadius: 1.5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <Suspense fallback={<Box sx={{ width: 80, height: 80, bgcolor: 'grey.100', borderRadius: 1 }} />}>
              <QRCode
                value={APP_STORE_URL}
                size={80}
                level="M"
                aria-label="QR code to download Rendasua app"
              />
            </Suspense>
          </Box>
          <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'text.secondary', textAlign: 'center', fontSize: '0.65rem' }}>
            {t('common.scanToDownload', 'Scan to download')}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default AppStoreBadges;
