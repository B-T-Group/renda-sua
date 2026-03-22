import {
  ArrowBack as ArrowBackIcon,
  HelpOutline as HelpOutlineIcon,
  LocationOn as LocationOnIcon,
  Storefront as StorefrontIcon,
  SupportAgent as SupportAgentIcon,
  AssignmentReturn as AssignmentReturnIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useAuth0 } from '@auth0/auth0-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { RentalListingRow } from '../../hooks/useRentalListings';
import { useRentalApi } from '../../hooks/useRentalApi';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

function formatMoney(amount: string | number, currency: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) {
    return `${amount} ${currency}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'XAF',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function formatAddress(addr: {
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}): string {
  const street = [addr.address_line_1, addr.address_line_2]
    .filter(Boolean)
    .join(', ');
  const locality = [addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
  if (street && locality) return `${street} · ${locality}`;
  return street || locality || '';
}

interface GalleryProps {
  listingKey: string;
  images: Array<{ id: string; image_url: string; alt_text?: string }>;
  title: string;
  noImageLabel: string;
}

const RentalListingGallery: React.FC<GalleryProps> = ({
  listingKey,
  images,
  title,
  noImageLabel,
}) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [listingKey]);

  const current = images[idx];
  const mainSrc = current?.image_url;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: { xs: 2, sm: 3 },
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: { xs: '4/3', sm: '16/10' },
          maxHeight: { xs: 320, sm: 'none' },
          bgcolor: 'action.hover',
        }}
      >
        {mainSrc ? (
          <Box
            component="img"
            src={mainSrc}
            alt={current?.alt_text || title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', minHeight: 220, px: 2 }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {noImageLabel}
            </Typography>
          </Stack>
        )}
      </Box>
      {images.length > 1 && (
        <Box
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          <Stack direction="row" gap={1} sx={{ flexWrap: { xs: 'nowrap', sm: 'wrap' } }}>
          {images.map((im, i) => (
            <Box
              key={im.id}
              component="button"
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`${title} ${i + 1}`}
              sx={{
                p: 0,
                border: 2,
                borderColor: i === idx ? 'primary.main' : 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
                width: { xs: 48, sm: 76 },
                height: { xs: 48, sm: 76 },
                minWidth: { xs: 48, sm: 76 },
                minHeight: { xs: 48, sm: 76 },
                cursor: 'pointer',
                bgcolor: 'background.paper',
                flexShrink: 0,
                touchAction: 'manipulation',
              }}
            >
              <Box
                component="img"
                src={im.image_url}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </Box>
          ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

interface DetailInfoCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

/** Shared shell for pickup venue + instruction panels: top-aligned, equal-width columns. */
const DetailInfoCard: React.FC<DetailInfoCardProps> = ({ icon, title, children }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      width: '100%',
      minHeight: 0,
      p: { xs: 1.75, sm: 2 },
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
    }}
  >
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          color: 'primary.main',
          flexShrink: 0,
          display: 'flex',
          lineHeight: 0,
          '& .MuiSvgIcon-root': { fontSize: 24 },
        }}
      >
        {icon}
      </Box>
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1, alignItems: 'flex-start' }}>
        <Typography variant="subtitle2" fontWeight={600} component="h3" sx={{ lineHeight: 1.35 }}>
          {title}
        </Typography>
        <Box sx={{ minWidth: 0, width: '100%' }}>{children}</Box>
      </Stack>
    </Stack>
  </Paper>
);

interface InstructionBlockProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const HowItWorksNotes: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const steps = [
    t(
      'rentals.detail.howItWorksStep1',
      'Send a request with your preferred start and end date and time. Nothing is charged at this step.'
    ),
    t(
      'rentals.detail.howItWorksStep2',
      'The business checks availability and responds. You can track the status under your rental requests.'
    ),
    t(
      'rentals.detail.howItWorksStep3',
      'If they confirm availability, you can complete a booking from that request using the terms they shared.'
    ),
    t(
      'rentals.detail.howItWorksStep4',
      'The rental is operated by the business at their location. Follow the pickup and return instructions on this page when you arrive.'
    ),
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        borderRadius: { xs: 2, sm: 3 },
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        borderColor: alpha(theme.palette.primary.main, 0.15),
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5, minWidth: 0 }}>
        <HelpOutlineIcon color="primary" sx={{ fontSize: { xs: 22, sm: 26 }, flexShrink: 0 }} />
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
          {t('rentals.detail.howItWorksTitle', 'How it works')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
        {t(
          'rentals.detail.howItWorksIntro',
          'Rentals on Rendasua are coordinated with the business in a few steps:'
        )}
      </Typography>
      <Stack spacing={2}>
        {steps.map((text, i) => (
          <Stack key={i} direction="row" spacing={{ xs: 1.5, sm: 2 }} alignItems="flex-start">
            <Box
              sx={{
                minWidth: 30,
                height: 30,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </Box>
            <Typography
              variant="body2"
              sx={{
                pt: 0.35,
                lineHeight: 1.65,
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {text}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
};

const InstructionBlock: React.FC<InstructionBlockProps> = ({ icon, title, body }) => {
  const { t } = useTranslation();
  const trimmed = body?.trim() ?? '';
  const isPlaceholder =
    !trimmed || trimmed === '—' || trimmed.toUpperCase() === 'N/A';
  const display = isPlaceholder
    ? t(
        'rentals.detail.noInstructionsYet',
        'No instructions provided yet.'
      )
    : trimmed;
  return (
    <DetailInfoCard icon={icon} title={title}>
      <Typography
        variant="body2"
        color={isPlaceholder ? 'text.disabled' : 'text.secondary'}
        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.55 }}
      >
        {display}
      </Typography>
    </DetailInfoCard>
  );
};

const RENTAL_REQUEST_HASH = 'rental-request-section';

const RentalListingDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { createRequest, fetchPublicRentalListing } = useRentalApi();
  const [row, setRow] = useState<RentalListingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError(null);
    try {
      const listing = await fetchPublicRentalListing(listingId);
      setRow(listing);
      if (!listing) {
        setError(t('rentals.notFound', 'Listing not found'));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [fetchPublicRentalListing, listingId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (location.hash !== `#${RENTAL_REQUEST_HASH}` || !row) return;
    const el = document.getElementById(RENTAL_REQUEST_HASH);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, row]);

  const submitRequest = async () => {
    setMsg(null);
    setSubmitSuccess(false);
    if (!listingId || !start || !end) {
      setMsg(t('rentals.fillDates', 'Choose start and end'));
      return;
    }
    try {
      const isoStart = new Date(start).toISOString();
      const isoEnd = new Date(end).toISOString();
      await createRequest({
        rentalLocationListingId: listingId,
        requestedStartAt: isoStart,
        requestedEndAt: isoEnd,
      });
      setMsg(t('rentals.requestSent', 'Request sent. The business will respond.'));
      setSubmitSuccess(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg(
        err?.response?.data?.message ||
          (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'))
      );
      setSubmitSuccess(false);
    }
  };

  if (loading || !listingId) {
    return (
      <LoadingPage
        message={t('common.loading', 'Loading...')}
        showProgress
      />
    );
  }

  if (!row) {
    return (
      <Box
        sx={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 6,
          bgcolor: alpha(theme.palette.divider, 0.06),
        }}
      >
        <Card
          elevation={0}
          sx={{
            maxWidth: 420,
            width: '100%',
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              {t('rentals.detail.notFoundTitle', 'We couldn’t find this listing')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3, overflowWrap: 'anywhere' }}>
              {error ??
                t(
                  'rentals.detail.notFoundBody',
                  'It may have been removed or is no longer available.'
                )}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{ maxWidth: 360, mx: 'auto', display: 'block', py: 1.25, minHeight: 48 }}
              onClick={() => navigate('/rentals')}
            >
              {t('rentals.detail.browseRentals', 'Browse rentals')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const images = row.rental_item.rental_item_images ?? [];
  const tags = row.rental_item.tags ?? [];
  const addressLine = formatAddress(row.business_location.address ?? {});
  const priceLabel = formatMoney(row.base_price_per_day, row.rental_item.currency);

  return (
    <>
      <SEOHead title={row.rental_item.name} />
      <Box
        sx={{
          minHeight: '100%',
          pb: {
            xs: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            md: 6,
          },
          bgcolor: alpha(theme.palette.divider, 0.04),
          overflowX: 'hidden',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: { xs: 1.5, sm: 2, md: 3 },
            px: { xs: 2, sm: 3 },
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/rentals')}
            sx={{
              mb: { xs: 1.5, sm: 2 },
              color: 'text.secondary',
              minHeight: 44,
              ml: { xs: -0.5, sm: 0 },
              touchAction: 'manipulation',
            }}
          >
            {t('rentals.detail.backToRentals', 'Back to rentals')}
          </Button>

          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
            <Grid item xs={12} md={7}>
              <RentalListingGallery
                listingKey={row.id}
                images={images}
                title={row.rental_item.name}
                noImageLabel={t('rentals.noImage', 'No image')}
              />
            </Grid>

            <Grid item xs={12} md={5}>
              <Stack spacing={{ xs: 2, sm: 2.5 }}>
                <Chip
                  label={row.rental_item.rental_category.name}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600, alignSelf: 'flex-start', maxWidth: '100%' }}
                />

                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: { xs: '-0.01em', sm: '-0.02em' },
                    lineHeight: 1.25,
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
                    overflowWrap: 'anywhere',
                  }}
                >
                  {row.rental_item.name}
                </Typography>

                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="flex-start" gap={0.75} sx={{ minWidth: 0 }}>
                    <StorefrontIcon
                      sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0, mt: 0.15 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      {t('rentals.detail.offeredBy', 'Offered by')}{' '}
                      <Box component="span" fontWeight={600} color="text.primary">
                        {row.rental_item.business.name}
                      </Box>
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="flex-start" gap={0.75} sx={{ minWidth: 0 }}>
                    <LocationOnIcon
                      sx={{ fontSize: 20, color: 'text.secondary', mt: 0.15, flexShrink: 0 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                        {row.business_location.name}
                      </Typography>
                      {addressLine ? (
                        <Typography variant="caption" color="text.secondary">
                          {addressLine}
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </Stack>

                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2.5,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <Typography variant="overline" color="primary" fontWeight={700}>
                    {t('rentals.detail.pricing', 'Pricing')}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="baseline"
                    gap={1}
                    flexWrap="wrap"
                    sx={{ mt: 0.5, columnGap: 1, rowGap: 0.5 }}
                  >
                    <Typography
                      variant="h3"
                      component="p"
                      fontWeight={800}
                      color="primary.dark"
                      sx={{
                        fontSize: { xs: '1.65rem', sm: '2.25rem', md: '3rem' },
                        lineHeight: 1.15,
                        wordBreak: 'break-word',
                      }}
                    >
                      {priceLabel}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', sm: undefined } }}>
                      {t('rentals.detail.dailyRate', 'Daily rate')}
                    </Typography>
                  </Stack>
                  <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('rentals.detail.minStay', 'Minimum stay')}
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {row.min_rental_days}{' '}
                        {row.min_rental_days === 1
                          ? t('rentals.detail.dayUnit', 'day')
                          : t('rentals.detail.daysUnit', 'days')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('rentals.detail.maxStay', 'Maximum stay')}
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {row.max_rental_days != null
                          ? `${row.max_rental_days} ${t('rentals.detail.daysUnit', 'days')}`
                          : t('rentals.detail.noMaxStay', 'No maximum')}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                <Alert
                  severity="info"
                  icon={false}
                  sx={{
                    borderRadius: 2,
                    '& .MuiAlert-message': { overflowWrap: 'anywhere' },
                  }}
                >
                  {t(
                    'rentals.businessOperatedNotice',
                    'All rentals are operated by the business (you do not take equipment home unattended).'
                  )}
                </Alert>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: { xs: 0, md: 1 } }} />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {t('rentals.detail.overview', 'About this rental')}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {row.rental_item.description || '—'}
              </Typography>
              {tags.length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {t('rentals.detail.tagsLabel', 'Tags')}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                {t('rentals.detail.locationTitle', 'Pickup location')}
              </Typography>
              <Grid container spacing={2} alignItems="stretch">
                <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                  <DetailInfoCard
                    icon={<LocationOnIcon />}
                    title={t('rentals.detail.venueLabel', 'Venue & address')}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                        {row.business_location.name}
                      </Typography>
                      {addressLine ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere', lineHeight: 1.55 }}
                        >
                          {addressLine}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere', lineHeight: 1.55 }}
                        >
                          {t('rentals.detail.atVenue', 'at')}{' '}
                          <Box component="span" fontWeight={500} color="text.primary">
                            {row.rental_item.business.name}
                          </Box>
                        </Typography>
                      )}
                    </Stack>
                  </DetailInfoCard>
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                  <InstructionBlock
                    icon={<SupportAgentIcon />}
                    title={t('rentals.pickupInstructions', 'Pickup / service instructions')}
                    body={row.pickup_instructions || ''}
                  />
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                  <InstructionBlock
                    icon={<AssignmentReturnIcon />}
                    title={t('rentals.dropoffInstructions', 'Return instructions')}
                    body={row.dropoff_instructions || ''}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <HowItWorksNotes />
            </Grid>

            <Grid item xs={12}>
              <Card
                id={RENTAL_REQUEST_HASH}
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: 1,
                  borderColor: 'divider',
                  overflow: 'visible',
                  scrollMarginTop: { xs: 16, sm: 24 },
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  {isAuthenticated ? (
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>
                          {t('rentals.requestRental', 'Request this rental')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t(
                            'rentals.detail.requestSubtitle',
                            'Choose your dates. The business will confirm availability.'
                          )}
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label={t('rentals.start', 'Start')}
                            type="datetime-local"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                            inputProps={{
                              style: { fontSize: 16 },
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label={t('rentals.end', 'End')}
                            type="datetime-local"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                            inputProps={{
                              style: { fontSize: 16 },
                            }}
                          />
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                        <Button
                          variant="contained"
                          size="large"
                          fullWidth
                          onClick={() => void submitRequest()}
                          sx={{
                            px: 4,
                            py: 1.25,
                            minHeight: 48,
                            fontWeight: 700,
                            borderRadius: 2,
                            maxWidth: { sm: 320 },
                            touchAction: 'manipulation',
                          }}
                        >
                          {t('rentals.submitRequest', 'Submit request')}
                        </Button>
                        <Button
                          variant="text"
                          fullWidth
                          sx={{ minHeight: 44, maxWidth: { sm: 'none' } }}
                          onClick={() => navigate('/rentals/requests')}
                        >
                          {t('rentals.myRequests', 'My rental requests')}
                        </Button>
                      </Stack>
                      {msg && (
                        <Alert
                          severity={submitSuccess ? 'success' : 'error'}
                          sx={{
                            borderRadius: 2,
                            '& .MuiAlert-message': { overflowWrap: 'anywhere' },
                          }}
                        >
                          {msg}
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <Stack spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                      <Typography variant="h6" fontWeight={700}>
                        {t('rentals.requestRental', 'Request this rental')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('rentals.loginToRequest', 'Log in to request')}
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        onClick={() => navigate('/app')}
                        sx={{
                          px: 4,
                          py: 1.25,
                          minHeight: 48,
                          fontWeight: 700,
                          borderRadius: 2,
                          maxWidth: { sm: 320 },
                          touchAction: 'manipulation',
                        }}
                      >
                        {t('rentals.loginToRequest', 'Log in to request')}
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
};

export default RentalListingDetailPage;
