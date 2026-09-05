import PauseOutlinedIcon from '@mui/icons-material/PauseOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  useBusinessAvailability,
  type PauseDuration,
} from '../../hooks/useBusinessAvailability';
import { shareStorefront } from '../../utils/shareStorefront';
import { StorefrontReachIllustration } from '../illustrations/QuietHomeIllustrations';

export interface BusinessStoreReachCardProps {
  businessId: string;
  businessName: string;
  productViews: number | null;
  metricsLoading?: boolean;
  compact?: boolean;
}

const PAUSE_DURATIONS: PauseDuration[] = [
  '15m',
  '1h',
  'until_tomorrow',
  'indefinite',
];

export function BusinessStoreReachCard({
  businessId,
  businessName,
  productViews,
  metricsLoading = false,
  compact = false,
}: BusinessStoreReachCardProps) {
  const { t } = useTranslation();
  const availability = useBusinessAvailability(true);
  const [pauseAnchor, setPauseAnchor] = useState<null | HTMLElement>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared'>(
    'idle'
  );

  const viewsZero = !metricsLoading && (productViews ?? 0) === 0;

  const onShare = async () => {
    try {
      const result = await shareStorefront({
        businessId,
        name: businessName,
        shareMessage: t(
          'stores.shareMessage',
          'Check out {{name}} on Rendasua: {{url}}',
          {
            name: businessName,
            url: `${window.location.origin}/store/${businessId}`,
          }
        ),
      });
      setShareStatus(result);
      window.setTimeout(() => setShareStatus('idle'), 2500);
    } catch {
      // user cancelled share
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: availability.accepting ? 'divider' : 'warning.main',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {!compact ? (
        <StorefrontReachIllustration
          size={96}
          label={t('business.quietHome.reach.title', 'Store reach')}
        />
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('business.quietHome.reach.title', 'Store reach')}
          </Typography>
          {availability.loading ? (
            <Skeleton width={120} height={28} sx={{ mt: 0.5 }} />
          ) : (
            <Chip
              size="small"
              sx={{ mt: 0.75 }}
              color={availability.accepting ? 'success' : 'warning'}
              variant="outlined"
              label={
                availability.accepting
                  ? t('businessAvailability.open', 'Accepting orders')
                  : t('businessAvailability.paused', 'Not accepting orders')
              }
            />
          )}
          {!availability.accepting && availability.pausedUntil ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('business.insights.summary.pausedUntil', 'Until {{time}}', {
                time: formatPausedUntil(availability.pausedUntil),
              })}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('business.dashboard.productViews.label', 'Views')}
        </Typography>
        {metricsLoading && productViews == null ? (
          <Skeleton width={48} height={28} />
        ) : (
          <Typography variant="h6">
            {productViews == null ? '—' : formatCompact(productViews)}
          </Typography>
        )}
        {viewsZero ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.quietHome.reach.zeroViewsHint',
              'Share your shop so customers can find you.'
            )}
          </Typography>
        ) : null}
      </Box>

      <Button
        variant="contained"
        startIcon={<ShareOutlinedIcon />}
        onClick={() => void onShare()}
      >
        {shareStatus === 'copied'
          ? t('common.copied', 'Copied')
          : t('business.quietHome.reach.shareCta', 'Share store')}
      </Button>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          component={RouterLink}
          to={`/store/${businessId}?preview=1`}
          size="small"
          startIcon={<StorefrontOutlinedIcon />}
        >
          {t('stores.previewCtaButton', 'Preview store')}
        </Button>
        {availability.accepting ? (
          <>
            <Button
              size="small"
              startIcon={<PauseOutlinedIcon />}
              onClick={(e) => setPauseAnchor(e.currentTarget)}
              disabled={availability.mutating}
            >
              {t('business.insights.summary.pauseCta', 'Pause orders')}
            </Button>
            <Menu
              anchorEl={pauseAnchor}
              open={Boolean(pauseAnchor)}
              onClose={() => setPauseAnchor(null)}
            >
              {PAUSE_DURATIONS.map((d) => (
                <MenuItem
                  key={d}
                  onClick={() => {
                    setPauseAnchor(null);
                    void availability.pause(d);
                  }}
                >
                  {d === '15m'
                    ? t('businessAvailability.pause.15m', '15 minutes')
                    : d === '1h'
                      ? t('businessAvailability.pause.1h', '1 hour')
                      : d === 'until_tomorrow'
                        ? t(
                            'businessAvailability.pause.until_tomorrow',
                            'Until tomorrow'
                          )
                        : t(
                            'businessAvailability.pause.indefinite',
                            'Until I resume'
                          )}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrowOutlinedIcon />}
            disabled={availability.mutating}
            onClick={() => void availability.resume()}
          >
            {t('businessAvailability.resume', 'Resume orders')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatPausedUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default BusinessStoreReachCard;
