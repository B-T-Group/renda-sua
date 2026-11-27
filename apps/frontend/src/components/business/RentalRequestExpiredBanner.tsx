import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { brandTokens } from '../../theme/brandTokens';

/** Approved 26 Nov 2026 notice accent — softer than the old solid amber Alert fill. */
const AMBER_EDGE = '#E8A23A';

export function RentalRequestExpiredBanner({
  window,
  who,
  onView,
  onDismiss,
  testId = 'rental-request-expired-state',
  sx,
}: {
  window: 'sla' | 'start';
  who?: string;
  onView?: () => void;
  onDismiss?: () => void;
  testId?: string;
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation();
  const reason =
    window === 'start'
      ? t(
          'business.dashboard.rentalRequests.expiredStartReason',
          "You didn't reply before the start time. The renter can send a new request."
        )
      : t(
          'business.dashboard.rentalRequests.expiredSlaReason',
          "You didn't reply within 24 hours. The renter can send a new request."
        );
  const viewLabel = t('business.dashboard.rentalRequests.viewRequest', 'View request');
  return (
    <Box
      data-testid={testId}
      sx={[
        {
          position: 'relative',
          px: 2,
          py: 1.5,
          pl: 2.5,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        },
        ...(sx == null ? [] : Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: 0,
          top: 10,
          bottom: 10,
          width: '4px',
          bgcolor: AMBER_EDGE,
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
        }}
      />
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: brandTokens.warning.soft,
            color: AMBER_EDGE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {t('business.dashboard.rentalRequests.expiredTitle', 'Request expired')}
          </Typography>
          {who ? (
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
              {who}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {reason}
          </Typography>
          {onView ? (
            <Button
              data-testid="rental-request-expiry-view"
              variant="contained"
              size="small"
              disableElevation
              startIcon={<ArrowForwardIcon />}
              onClick={onView}
              aria-label={viewLabel}
              sx={{
                mt: 1.25,
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '20px',
                px: 1.75,
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {viewLabel}
            </Button>
          ) : null}
        </Box>
        {onDismiss ? (
          <IconButton
            data-testid="rental-request-expiry-dismiss"
            size="small"
            onClick={onDismiss}
            aria-label={t('business.dashboard.rentalRequests.dismissNotice', 'Dismiss')}
            sx={{
              bgcolor: brandTokens.surface.input,
              width: 28,
              height: 28,
              '&:hover': { bgcolor: brandTokens.surface.subtle },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ) : null}
      </Stack>
    </Box>
  );
}
