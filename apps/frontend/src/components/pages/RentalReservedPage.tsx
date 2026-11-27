import {
  AccountBalanceWalletOutlined,
  CameraAltOutlined,
  CheckCircle as CheckCircleIcon,
  PlaceOutlined,
  Restore,
} from '@mui/icons-material';
import { Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useRentalApi, type RentalBookingDetail } from '../../hooks/useRentalApi';
import {
  buildReservedView,
  type ReservedStep,
  type ReservedStepIcon,
} from '../../utils/rentals/reserveSuccess';
import SEOHead from '../seo/SEOHead';

const STEP_ICONS: Record<ReservedStepIcon, React.ReactElement> = {
  pin: <PlaceOutlined />,
  camera: <CameraAltOutlined />,
  wallet: <AccountBalanceWalletOutlined />,
  refund: <Restore />,
};

const StepCard: React.FC<{ step: ReservedStep; index: number }> = ({ step, index }) => {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start" data-testid={`reserved-step-${step.key}`}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
        }}
      >
        {STEP_ICONS[step.icon]}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} component="h2">
          {`${index + 1}. ${step.title}`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.65 }}>
          {step.body}
        </Typography>
      </Box>
    </Stack>
  );
};

function useReservedBooking(bookingId: string | undefined) {
  const { fetchBookingDetail } = useRentalApi();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  useEffect(() => {
    if (!bookingId) return undefined;
    let stop = false;
    setLoading(true);
    void fetchBookingDetail(bookingId).then((row) => {
      if (stop) return;
      setBooking(row);
      setLoading(false);
    });
    return () => {
      stop = true;
    };
  }, [bookingId, fetchBookingDetail]);
  return { booking, loading };
}

const RentalReservedPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { booking, loading } = useReservedBooking(bookingId);
  const view = useMemo(
    () => (booking ? buildReservedView(booking, i18n.language, t) : null),
    [booking, i18n.language, t]
  );
  const pageTitle = t('rentals.reserved.pageTitle', 'Reserved');

  return (
    <>
      <SEOHead title={`${pageTitle} | Rendasua`} description={pageTitle} noindex />
      <Box
        sx={{
          minHeight: '100%',
          pb: { xs: 'calc(88px + env(safe-area-inset-bottom, 0px))', md: 6 },
          pt: { xs: 2, sm: 3 },
          bgcolor: alpha(theme.palette.divider, 0.04),
        }}
      >
        <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 } }}>
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, border: 1, borderColor: 'divider' }}>
            <Stack spacing={3}>
              <Stack spacing={1} alignItems="center" textAlign="center">
                <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
                <Typography variant="h5" fontWeight={800} component="h1">
                  {t('rentals.reserved.headline', 'You’re reserved')}
                </Typography>
                {view?.itemName ? (
                  <Typography variant="subtitle1" fontWeight={700}>{view.itemName}</Typography>
                ) : null}
                <Typography variant="body1" color="text.secondary">
                  {t('rentals.reserved.intro', 'Nothing more to do now. Here is what happens next.')}
                </Typography>
              </Stack>
              {loading ? (
                <Box sx={{ textAlign: 'center' }}><CircularProgress size={28} /></Box>
              ) : null}
              {view ? (
                <Stack
                  spacing={2.5}
                  data-testid="reserved-steps"
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.12),
                  }}
                >
                  <Typography variant="caption" fontWeight={800} color="primary" letterSpacing={0.5}>
                    {t('rentals.reserved.nextHeading', 'WHAT’S NEXT')}
                  </Typography>
                  {view.steps.map((step, i) => (
                    <StepCard key={step.key} step={step} index={i} />
                  ))}
                </Stack>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => navigate(`/rentals/bookings/${bookingId}`, { replace: true })}
                  sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2 }}
                >
                  {t('rentals.reserved.viewRental', 'View rental')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  onClick={() => navigate('/rentals/requests')}
                  sx={{ minHeight: 48, fontWeight: 600, borderRadius: 2 }}
                >
                  {t('rentals.reserved.goDashboard', 'Go to dashboard')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </>
  );
};

export default RentalReservedPage;
