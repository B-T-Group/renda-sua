import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  useRentalApi,
  type ClientRentalRequestRow,
} from '../../hooks/useRentalApi';
import ConfirmationModal from '../common/ConfirmationModal';
import LoadingPage from '../common/LoadingPage';
import { RentalBookConfirmSummary } from '../rentals/RentalBookConfirmSummary';
import { ReserveSummaryPanel } from '../rentals/ReserveSummaryPanel';
import { ReserveStickyFooter } from '../rentals/ReserveStickyFooter';
import { buildReserveSummary } from '../../utils/rentals/reserveSummary';
import { isReservedWithNothingDue } from '../../utils/rentals/reserveSuccess';
import {
  ClientRentalRequestRowCard,
  isProposedContractOpen,
} from '../rentals/ClientRentalRequestRowCard';
import SEOHead from '../seo/SEOHead';
import { hubSegmentFromSearchParam } from '../../utils/myRentalsTodoCount';
import {
  preferredClientHub,
  resolveRentalPhase,
  type RentalHubGroup,
} from '../../utils/rentalPhase';
import { cardWindowErrorMessage } from '../../utils/rentals/cardWindow';
import { reserveMode } from '../../utils/rentals/reservationFee';
import { parseRentalPricingSnapshot, parseRentalSelectionWindows, proposedContractDeadlineIso } from '../../utils/rentalRequestDisplay';
import {
  isPriceChangeUnseenError,
  PRICE_CHANGE_UNSEEN_KEY,
  PRICE_CHANGE_UNSEEN_TEXT,
} from '../../utils/rentals/priceChangeUnseen';

function apiErrorMessage(err: unknown, fallback: string): string {
  const friendly = cardWindowErrorMessage(err, navigator.language);
  if (friendly) return friendly;
  const m = (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

function rentalBookingErrorIsExpired(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 410 || /expired/i.test(apiErrorMessage(err, ''));
}

const statusFilterFormSx = {
  width: '100%',
} as const;

function hubLabel(label: string, count: number): string {
  return count > 0 ? `${label} ${count}` : label;
}

const hubSegmentSx = {
  whiteSpace: 'nowrap',
  textTransform: 'none',
  px: 0.75,
  lineHeight: 1.2,
} as const;

const ClientRentalRequestsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated } = useSessionAuth();
  const { createBooking, cancelClientRentalRequest, fetchClientRentalRequests } =
    useRentalApi();
  const { isStripeRail } = useIsStripeRail();
  const [rows, setRows] = useState<ClientRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [bookConfirmRequestId, setBookConfirmRequestId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const segmentParam = searchParams.get('segment');
  const [hubSegment, setHubSegment] = useState<RentalHubGroup>(() =>
    hubSegmentFromSearchParam(segmentParam)
  );
  const segmentPinned = React.useRef(Boolean(segmentParam));
  const autoApplied = React.useRef(false);

  useEffect(() => {
    if (!segmentParam) return;
    segmentPinned.current = true;
    setHubSegment(hubSegmentFromSearchParam(segmentParam));
  }, [segmentParam]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const info = resolveRentalPhase(
        {
          requestStatus: r.status,
          bookingStatus: r.rental_booking?.status ?? null,
        },
        'client'
      );
      return info.hubGroup === hubSegment;
    });
  }, [rows, hubSegment]);

  const segmentCounts = React.useMemo(() => {
    const counts: Record<RentalHubGroup, number> = {
      action_needed: 0,
      upcoming: 0,
      active: 0,
      past: 0,
    };
    for (const row of rows) {
      const info = resolveRentalPhase(
        { requestStatus: row.status, bookingStatus: row.rental_booking?.status ?? null },
        'client'
      );
      counts[info.hubGroup] += 1;
    }
    return counts;
  }, [rows]);

  React.useEffect(() => {
    if (segmentPinned.current || autoApplied.current || loading) return;
    autoApplied.current = true;
    const filled = (['action_needed', 'active', 'upcoming', 'past'] as const).filter(
      (group) => segmentCounts[group] > 0
    );
    setHubSegment(preferredClientHub(filled));
  }, [loading, segmentCounts]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchClientRentalRequests();
      setRows(list);
    } catch (e: unknown) {
      setRows([]);
      setError(
        apiErrorMessage(
          e,
          t('rentals.loadRequestsError', 'Could not load requests')
        )
      );
    } finally {
      setLoading(false);
    }
  }, [fetchClientRentalRequests, t]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const openBookConfirm = (requestId: string) => {
    const row = rows.find((r) => r.id === requestId);
    if (!row || row.status !== 'available' || !isProposedContractOpen(row)) {
      enqueueSnackbar(
        t(
          'rentals.clientRequests.contractExpiredBookError',
          'This offer has expired. Send a new request from the listing.'
        ),
        { variant: 'error' }
      );
      void load();
      return;
    }
    setBookConfirmRequestId(requestId);
  };

  const finalizeBookingFromModal = async (requestId: string) => {
    setBookingId(requestId);
    try {
      const res = await createBooking(requestId);
      setBookConfirmRequestId(null);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      if (isReservedWithNothingDue(res)) {
        navigate(`/rentals/bookings/${res.bookingId}/reserved`);
        return;
      }
      if (res.reservation_fee && res.paymentPending && res.payment_rail === 'mobile_money') {
        enqueueSnackbar(
          t('rentals.payAtPickup.feeMomoSnack', 'Approve the reservation fee on your phone. Your reservation is confirmed once it’s paid.'),
          { variant: 'info' }
        );
        navigate(`/rentals/bookings/${res.bookingId}`);
        return;
      }
      enqueueSnackbar(
        res.reserved
          ? t(
              'rentals.clientRequests.bookReserved',
              'Reserved — pay at pickup to start your rental'
            )
          : t('rentals.clientRequests.bookSuccess', 'Booking created'),
        { variant: 'success' }
      );
      navigate(`/rentals/bookings/${res.bookingId}`);
    } catch (e: unknown) {
      enqueueSnackbar(
        isPriceChangeUnseenError(e)
          ? t(PRICE_CHANGE_UNSEEN_KEY, PRICE_CHANGE_UNSEEN_TEXT)
          : rentalBookingErrorIsExpired(e)
          ? t(
              'rentals.clientRequests.contractExpiredBookError',
              'This offer has expired. Send a new request from the listing.'
            )
          : apiErrorMessage(
              e,
              t('rentals.clientRequests.bookError', 'Could not complete booking')
            ),
        { variant: 'error' }
      );
      setBookConfirmRequestId(null);
      void load();
    } finally {
      setBookingId(null);
    }
  };

  const confirmBook = async () => {
    if (!bookConfirmRequestId) return;
    const row = rows.find((r) => r.id === bookConfirmRequestId);
    if (!row || row.status !== 'available' || !isProposedContractOpen(row)) {
      enqueueSnackbar(
        t(
          'rentals.clientRequests.contractExpiredBookError',
          'This offer has expired. Send a new request from the listing.'
        ),
        { variant: 'error' }
      );
      setBookConfirmRequestId(null);
      void load();
      return;
    }
    await finalizeBookingFromModal(bookConfirmRequestId);
  };

  const confirmCancel = async () => {
    if (!cancelModalId) return;
    setCancelSubmitting(true);
    try {
      await cancelClientRentalRequest(cancelModalId);
      enqueueSnackbar(t('rentals.clientRequests.cancelSuccess', 'Request cancelled'), {
        variant: 'success',
      });
      setCancelModalId(null);
      await load();
    } catch (e: unknown) {
      enqueueSnackbar(
        apiErrorMessage(
          e,
          t('rentals.clientRequests.cancelError', 'Could not cancel request')
        ),
        { variant: 'error' }
      );
    } finally {
      setCancelSubmitting(false);
    }
  };

  const cancelTargetRow = cancelModalId
    ? rows.find((r) => r.id === cancelModalId)
    : undefined;
  const cancelModalIsOffer = cancelTargetRow?.status === 'available';

  const bookConfirmRow = bookConfirmRequestId
    ? rows.find((r) => r.id === bookConfirmRequestId)
    : undefined;
  const bookMode = reserveMode(bookConfirmRow?.rental_booking, isStripeRail);
  const bookFeeQuote = parseRentalPricingSnapshot(bookConfirmRow?.rental_pricing_snapshot);
  const bookSummary = bookConfirmRow && bookMode !== 'card_upfront'
    ? buildReserveSummary({
        mode: bookMode,
        windows: parseRentalSelectionWindows(bookConfirmRow.rental_selection_windows),
        quote: bookFeeQuote,
        booking: bookConfirmRow.rental_booking,
        listingZone: bookConfirmRow.listing_timezone,
        placeName: bookConfirmRow.rental_location_listing?.business_location?.name,
        deadlineIso: proposedContractDeadlineIso(bookConfirmRow),
        isStripeRail,
        language: i18n.language,
        t,
      })
    : null;
  const bookBusiness = bookConfirmRow?.rental_location_listing?.rental_item?.business?.name || bookConfirmRow?.rental_location_listing?.business_location?.name;

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '50vh', bgcolor: alpha(theme.palette.divider, 0.04), py: 4 }}>
        <Container maxWidth="sm">
          <Typography variant="body1">
            {t('rentals.loginToViewRequests', 'Log in to view your requests')}
          </Typography>
        </Container>
      </Box>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  return (
    <>
      <SEOHead title={t('rentals.hub.title', 'My rentals')} />
      <Box
        sx={{
          minHeight: '100%',
          pb: { xs: '96px', md: 4 },
          bgcolor: alpha(theme.palette.divider, 0.04),
        }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/rentals')}
            sx={{ mb: 2, color: 'text.secondary' }}
          >
            {t('rentals.detail.backToRentals', 'Back to rentals')}
          </Button>

          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 0.5 }}>
            {t('rentals.hub.title', 'My rentals')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
            {t(
              'rentals.clientRequests.subtitle',
              'Track responses from businesses. Cancel requests that are still pending, or complete booking when a listing is marked available.'
            )}
          </Typography>

          {error ? (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          ) : null}

          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              ...statusFilterFormSx,
            }}
          >
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={hubSegment}
              onChange={(_e, value: RentalHubGroup | null) => {
                if (!value) return;
                segmentPinned.current = true;
                setHubSegment(value);
              }}
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="action_needed" sx={hubSegmentSx}>
                {hubLabel(t('rentals.hub.toDo', 'To do'), segmentCounts.action_needed)}
              </ToggleButton>
              <ToggleButton value="upcoming" sx={hubSegmentSx}>
                {hubLabel(t('rentals.hub.upcoming', 'Upcoming'), segmentCounts.upcoming)}
              </ToggleButton>
              <ToggleButton value="active" sx={hubSegmentSx}>
                {hubLabel(t('rentals.hub.active', 'Active'), segmentCounts.active)}
              </ToggleButton>
              <ToggleButton value="past" sx={hubSegmentSx}>
                {hubLabel(t('rentals.hub.past', 'Past'), segmentCounts.past)}
              </ToggleButton>
            </ToggleButtonGroup>
            {rows.length > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t('rentals.clientRequests.resultsCount', {
                  defaultValue: '{{shown}} of {{total}} requests',
                  shown: filteredRows.length,
                  total: rows.length,
                })}
              </Typography>
            ) : null}
          </Paper>

          <Stack spacing={2}>
            {filteredRows.map((req) => (
              <ClientRentalRequestRowCard
                key={req.id}
                row={req}
                bookingLoading={bookingId === req.id}
                onBookRequest={openBookConfirm}
                onCancel={(id) => setCancelModalId(id)}
                onViewListing={(listingId) => navigate(`/rentals/${listingId}`)}
                onBrowseRentals={() => navigate('/rentals')}
                onViewBooking={(bId) => navigate(`/rentals/bookings/${bId}`)}
              />
            ))}
          </Stack>

          {rows.length === 0 && !error ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t('rentals.hub.emptyAll', 'You have no rental requests or bookings yet.')}
              </Typography>
              <Button variant="contained" onClick={() => navigate('/rentals')}>
                {t('rentals.clientRequests.browseRentals', 'Browse rentals')}
              </Button>
            </Box>
          ) : null}

          {rows.length > 0 && filteredRows.length === 0 && !error ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {hubSegment === 'action_needed'
                  ? t(
                      'rentals.hub.emptyActionNeeded',
                      'Nothing needs your attention right now.'
                    )
                  : hubSegment === 'upcoming'
                    ? t('rentals.hub.emptyUpcoming', 'No upcoming rentals')
                    : hubSegment === 'active'
                      ? t('rentals.hub.emptyActive', 'No rentals in progress.')
                      : t('rentals.hub.emptyPast', 'No past rentals yet.')}
              </Typography>
            </Box>
          ) : null}
        </Container>
      </Box>

      <ConfirmationModal
        open={Boolean(bookConfirmRequestId)}
        maxWidth="md"
        fullScreenOnMobile
        title={t(
          'rentals.clientRequests.bookConfirmTitle',
          'Review and confirm your reservation'
        )}
        message={
          bookSummary
            ? ''
            : isStripeRail
            ? t(
                'rentals.clientRequests.bookConfirmMessageStripe',
                'By continuing, you will be redirected to a secure Stripe Checkout page. The rental total plus the security deposit is held on your card — nothing is charged until the item is returned, and the final charge is at least the rental total. Free cancellation before the rental starts.'
              )
            : t(
                'rentals.clientRequests.bookConfirmMessage',
                'By continuing, your reservation is held for free — no payment now. You pay the rental total at pickup (wallet or mobile money). Free cancellation before the rental starts.'
              )
        }
        additionalContent={
          bookConfirmRow && bookSummary ? (
            <ReserveSummaryPanel
              summary={bookSummary}
              itemName={bookConfirmRow.rental_location_listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental')}
              business={bookBusiness ? t('rentals.reserve.offerFrom', 'Offer accepted by {{business}}', { business: bookBusiness }) : null}
            />
          ) : bookConfirmRow ? (
            <RentalBookConfirmSummary
              row={bookConfirmRow}
              isStripeRail={isStripeRail}
            />
          ) : null
        }
        confirmText={
          bookSummary
            ? bookSummary.button
            : isStripeRail
            ? t(
                'rentals.clientRequests.bookConfirmButtonStripe',
                'Continue to payment'
              )
            : t('rentals.clientRequests.bookConfirmButtonReserve', 'Reserve now')
        }
        actionsSummary={bookSummary ? <ReserveStickyFooter summary={bookSummary} /> : undefined}
        cancelText={t('common.cancel', 'Cancel')}
        confirmColor="primary"
        loading={Boolean(bookingId && bookingId === bookConfirmRequestId)}
        onConfirm={() => void confirmBook()}
        onCancel={() => {
          if (bookingId && bookingId === bookConfirmRequestId) return;
          setBookConfirmRequestId(null);
        }}
      />

      <ConfirmationModal
        open={Boolean(cancelModalId)}
        title={
          cancelModalIsOffer
            ? t('rentals.clientRequests.cancelOfferTitle', 'Cancel this reservation?')
            : t('rentals.clientRequests.cancelConfirmTitle', 'Cancel this request?')
        }
        message={
          cancelModalIsOffer
            ? t(
                'rentals.clientRequests.cancelOfferMessage',
                'You will withdraw from this offer. The proposed contract will be cancelled and you can send a new request later if you wish.'
              )
            : t(
                'rentals.clientRequests.cancelConfirmMessage',
                'The business will no longer see this request. You can send a new request later if you change your mind.'
              )
        }
        confirmText={
          cancelModalIsOffer
            ? t('rentals.clientRequests.cancelOffer', 'Cancel reservation')
            : t('rentals.clientRequests.cancelRequest', 'Cancel request')
        }
        confirmColor="error"
        loading={cancelSubmitting}
        onConfirm={() => void confirmCancel()}
        onCancel={() => !cancelSubmitting && setCancelModalId(null)}
      />
    </>
  );
};

export default ClientRentalRequestsPage;
