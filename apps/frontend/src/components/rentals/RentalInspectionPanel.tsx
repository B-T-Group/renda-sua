import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import type { useRentalInspection } from '../../hooks/useRentalInspection';
import { useRentalApi } from '../../hooks/useRentalApi';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { formatListingDue } from '../../utils/rentalRequestFormat';
import { confirmationTimeZone, formatConfirmationDue } from '../../utils/rentals/confirmationFormat';
import {
  CORRECTION_REASON_CODES,
  REQUIRED_PHOTO_ROLES,
  allUnitsReviewed,
  businessCanReplaceReport,
  classifyInspectionError,
  correctionReasonText,
  damageRail,
  derivedOvertime,
  handbackEnabled,
  photoRolesForMinimum,
  reportReadyToSubmit,
  returnHasDamage,
  type InspectionStage,
  type InspectionUnit,
  type InspectionView,
  type PhotoRole,
} from '../../utils/rentalInspection';

type Model = ReturnType<typeof useRentalInspection>;

interface PanelBooking {
  status: string;
  payment_status?: string | null;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  return_handed_back_at?: string | null;
  return_resolution?: string | null;
  actual_start_at?: string | null;
  units_booked?: number | null;
  end_at?: string | null;
  total_amount?: number | string | null;
  currency?: string | null;
  rental_location_listing?: {
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
  client?: { user?: { first_name?: string | null } | null } | null;
  accept_start_preview?: {
    payment_rail: 'card' | 'wallet' | 'mobile_money';
    amount_due_at_pickup: number;
  } | null;
  overtime_amount_override?: number | string | null;
  rental_pricing_snapshot?: unknown;
}

const ROLE_KEY: Record<string, [string, string]> = {
  overview: ['rentalInspection.overview', 'Overview'],
  other_side: ['rentalInspection.otherSide', 'Other side'],
  accessories: ['rentalInspection.accessories', 'Accessories'],
  wear: ['rentalInspection.wearCloseup', 'Close-up'],
  counter: ['rentalInspection.counterPhotos', 'Counter-photo'],
};

export function RentalInspectionPanel({
  bookingId,
  role,
  booking,
  model,
  onChanged,
  confirmationsEnabled,
  onReportSent,
  onRentalStarted,
}: {
  bookingId: string;
  role: 'client' | 'business';
  booking: PanelBooking;
  model: Model;
  onChanged: () => void;
  confirmationsEnabled?: boolean;
  onReportSent?: (summary: {
    stage: 'pickup' | 'return';
    versionNo: number;
    submittedAt: string;
    unitCount: number;
    photos: Array<{ id: string; role: string; url?: string }>;
  }) => void;
  onRentalStarted?: (input: { momo: boolean }) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acceptAndStart, fetchBookingDetail, getBookingPaymentStatus } = useRentalApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const stage: InspectionStage | null =
    role === 'client'
      ? model.reviewStage
      : model.showEnrolledReturn
        ? 'return'
        : booking.status === 'reserved' || booking.status === 'confirmed'
          ? 'pickup'
          : null;
  const view = stage === 'return' ? model.returnView : model.pickup;
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [panel, setPanel] = useState<'review' | 'correction' | 'dispute'>('review');
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [claim, setClaim] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [momoPhase, setMomoPhase] = useState<'waiting' | 'failed' | 'stalled' | null>(null);
  const [startRail, setStartRail] = useState<string | null>(null);
  const waitingSince = useRef<number | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const draftOpened = useRef(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    if (role !== 'business' || !stage || !view || view.units.length > 0 || draftOpened.current || model.loading) return;
    draftOpened.current = true;
    void model.api.openDraft(bookingId, stage).then(() => model.reload()).catch(() => {
      draftOpened.current = false;
    });
  }, [bookingId, model.api, model.loading, model.reload, role, stage, view]);

  const unit = view?.units[index];
  useEffect(() => {
    if (!unit) return;
    setDraft(draftFrom(unit));
    setSeen((prev) => new Set(prev).add(unit.unitId));
  }, [unit]);

  const minPhotos = view?.minPhotos ?? null;
  const labels = useMemo(
    () => ({
      missing_accessory: t('rentalInspection.reasonMissingAccessory', 'Missing accessory'),
      photo_mismatch: t('rentalInspection.reasonPhotoMismatch', "Photo doesn't match item"),
      wear_hidden: t('rentalInspection.reasonWearHidden', 'Wear not shown'),
      wrong_unit: t('rentalInspection.reasonWrongUnit', 'Wrong unit / serial'),
    }),
    [t]
  );

  useEffect(() => {
    if (momoPhase !== 'waiting') {
      waitingSince.current = null;
      return undefined;
    }
    if (waitingSince.current == null) waitingSince.current = Date.now();
    let stop = false;
    const tick = async () => {
      const row = await fetchBookingDetail(bookingId);
      if (stop || !row) return;
      if (row.status === 'active' || row.actual_start_at) {
        setMomoPhase(null);
        if (confirmationsEnabled) onRentalStarted?.({ momo: startRail === 'mobile_money' });
        else onChanged();
        return;
      }
      const pay = await getBookingPaymentStatus(bookingId).catch(() => null);
      if (pay && !pay.paymentPending && row.status === 'reserved') {
        setMomoPhase('failed');
        return;
      }
      const waited = Date.now() - (waitingSince.current ?? Date.now());
      if (pay && !pay.paymentPending && row.status === 'confirmed' && !row.actual_start_at && waited >= 60_000) {
        setMomoPhase('stalled');
      }
    };
    const timer = window.setInterval(() => void tick(), 4000);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [bookingId, confirmationsEnabled, fetchBookingDetail, getBookingPaymentStatus, momoPhase, onChanged, onRentalStarted, startRail]);

  if (!model.enrolled) return null;

  const message = bannerText(model.error, banner, offline, t);
  const damaged = stage === 'return' && returnHasDamage(view ?? null);
  const reviewed = allUnitsReviewed(view?.units.map((row) => row.unitId) ?? [], seen);
  const canHandback = handbackEnabled(model.returnView, booking.units_booked ?? 0);

  const run = async (work: () => Promise<void>, notice?: string) => {
    setBusy(true);
    try {
      await work();
      setBanner(notice ?? null);
      await model.reload();
      onChanged();
    } catch (error: unknown) {
      setBanner(classifyMessage(error, t));
      await model.reload();
    } finally {
      setBusy(false);
    }
  };

  const upload = async (roleName: PhotoRole, file: File) => {
    if (!unit || !stage) return;
    if (offline) {
      setBanner('offline');
      return;
    }
    await run(async () => {
      if (role === 'business' && view?.status !== 'draft' && view?.status !== 'correction_requested') {
        await model.api.openDraft(bookingId, stage);
      }
      await model.api.upload({ bookingId, unitId: unit.unitId, role: roleName, file });
    });
  };

  const saveUnit = async () => {
    if (!draft || !unit || !stage || role !== 'business') return;
    const item = itemFromDraft(draft, unit.unitId, stage, model.pickup?.units.find((row) => row.unitId === unit.unitId));
    if (!item) {
      setBanner('incomplete');
      return;
    }
    await run(async () => {
      await model.api.saveItems(bookingId, stage, [item]);
    });
    if (index < (view?.units.length ?? 1) - 1) setIndex(index + 1);
  };

  const confirmStart = async () => {
    if (!view?.versionId) return;
    const preview = booking.accept_start_preview;
    trackSiteEvent({
      eventType: 'rental_accept_and_start_tap',
      subjectType: 'rental_booking',
      subjectId: bookingId,
      metadata: {
        payment_rail: preview?.payment_rail ?? 'unknown',
        amount_due_at_pickup: preview?.amount_due_at_pickup ?? 0,
        is_retry: momoPhase === 'failed' || momoPhase === 'stalled',
      },
    });
    setBusy(true);
    try {
      const result = await acceptAndStart(bookingId, view.versionId);
      setConfirmOpen(false);
      if (result.paymentPending) {
        setStartRail(result.payment_rail ?? 'mobile_money');
        setMomoPhase('waiting');
        return;
      }
      setMomoPhase(null);
      if (confirmationsEnabled) onRentalStarted?.({ momo: false });
      else onChanged();
    } catch (error: unknown) {
      setConfirmOpen(false);
      const kind = classifyInspectionError(error);
      if (kind === 'conflict' || kind === 'update_required' || kind === 'unavailable') {
        setMomoPhase(null);
        setBanner(kind === 'unavailable' ? 'retry' : kind);
      } else if (preview?.payment_rail === 'mobile_money') {
        setMomoPhase('failed');
      } else {
        setMomoPhase(null);
        setBanner('retry');
      }
      await model.reload();
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!stage || minPhotos == null || !view) return;
    if (!reportReadyToSubmit(view.units, minPhotos)) {
      setBanner('incomplete');
      return;
    }
    await run(async () => {
      const amount = Number(claim);
      await model.api.submit(bookingId, stage, stage === 'return' && amount > 0 ? amount : undefined);
    }, confirmationsEnabled ? undefined : 'submitted');
    if (confirmationsEnabled && view) {
      onReportSent?.({
        stage,
        versionNo: view.versionNo || 1,
        submittedAt: new Date().toISOString(),
        unitCount: view.units.length || booking.units_booked || 1,
        photos: view.units[0]?.photos ?? [],
      });
    }
  };

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {message ? <Alert severity={model.error === 'conflict' || banner === 'conflict' ? 'warning' : 'info'}>{message}</Alert> : null}
      {role === 'business' ? (
        <BusinessAcceptHero
          booking={booking}
          pickup={model.pickup}
          onUpdate={() => void run(async () => { await model.api.openDraft(bookingId, 'pickup'); })}
        />
      ) : null}
      {momoPhase ? (
        <Alert severity={momoPhase === 'waiting' ? 'info' : 'error'}>
          <Stack spacing={1}>
            {momoPhase === 'waiting' ? <MobileMoneyConfirmIllustration /> : null}
            <Typography>
              {momoPhase === 'waiting'
                ? t('orders.momoAwaiting.waitingTitle', 'Approve on your phone')
                : momoPhase === 'failed'
                  ? t('orders.momoAwaiting.failedTitle', 'Payment failed')
                  : t('rentalInspection.startDelayedTitle', 'Payment succeeded, but the rental has not started.')}
            </Typography>
            {momoPhase === 'stalled' ? (
              <Typography>
                {t('rentalInspection.startDelayedBody', 'You can retry the start, or contact support.')}
              </Typography>
            ) : null}
            {momoPhase === 'failed' ? (
              <Button variant="contained" onClick={() => void confirmStart()}>
                {t('common.retry', 'Retry')}
              </Button>
            ) : null}
            {momoPhase === 'stalled' ? (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void confirmStart()}>
                  {t('rentalInspection.retryStart', 'Retry start')}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/support')}>
                  {t('rentalInspection.contactSupport', 'Contact support')}
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {stage === 'return' && role === 'client' && !model.pickup?.units.some((row) => row.photos.length) ? (
        <Alert severity="warning">
          {t('rentalInspection.pickupBaselineMissing', 'Pickup baseline unavailable for this rental')}
        </Alert>
      ) : null}
      {role === 'business' ? (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="overline">{t('rentalInspection.timelineTitle', 'Timeline')}</Typography>
          <Timeline role={role} booking={booking} pickup={model.pickup} returnView={model.returnView} />
        </Box>
      ) : null}
      {role === 'business' && stage === 'pickup' && view ? (
        <Stack spacing={1}>
          {view.units.map((row) => {
            const ready = !!row.condition && row.photos.length >= (view.minPhotos ?? 3);
            const started = !!row.condition || row.photos.length > 0 || !!row.wear;
            return (
              <Stack key={row.unitId} direction="row" spacing={1} sx={{ alignItems: 'center', minHeight: 48 }}>
                <Typography sx={{ flex: 1 }}>{row.displayLabel}</Typography>
                <Chip label={ready ? t('rentalInspection.unitReady', 'Ready') : started ? t('rentalInspection.unitProgress', 'In progress') : t('rentalInspection.unitTodo', 'To do')} />
              </Stack>
            );
          })}
        </Stack>
      ) : null}
      {role === 'business' && stage === 'return' && booking.return_handed_back_at ? (
        <Alert severity="info">
          {t('rentalInspection.handbackReadOnly', 'Handback time · {{time}} (server, read-only)', { time: booking.return_handed_back_at })}
          {(() => {
            const overtime = derivedOvertime(booking);
            if (!overtime) return null;
            return ` · ${overtime.adjusted
              ? t('rentalInspection.overtimeAdjusted', 'Overtime · {{amount}} (adjusted by support)', { amount: overtime.amount })
              : t('rentalInspection.overtimeReadOnly', 'Overtime · {{amount}} (from the handback time)', { amount: overtime.amount })}`;
          })()}
        </Alert>
      ) : null}
      {role === 'client' && (model.pickup?.status === 'not_ready' || model.returnView?.status === 'not_ready') ? (
        <Alert severity="info">{t('rentalInspection.businessRecording', 'The business is recording the condition report.')}</Alert>
      ) : null}
      {stage && view && unit && draft ? (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {view.units.length > 1 ? (
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              {view.units.map((row, rowIndex) => (
                <Button
                  key={row.unitId}
                  variant={rowIndex === index ? 'contained' : 'outlined'}
                  color="primary"
                  sx={{
                    minHeight: 48,
                    color: rowIndex === index ? 'primary.contrastText' : 'text.primary',
                    borderColor: rowIndex === index ? 'primary.main' : 'text.primary',
                    bgcolor: rowIndex === index ? 'primary.main' : 'background.paper',
                  }}
                  onClick={() => setIndex(rowIndex)}
                >
                  {row.displayLabel}
                  {seen.has(row.unitId) ? ' ✓' : ''}
                </Button>
              ))}
            </Stack>
          ) : null}
          {role === 'business' && view.correctionReason ? <Alert severity="warning">{view.correctionReason}</Alert> : null}
          <Typography variant="h6" sx={{ mb: 1 }}>{unit.displayLabel}</Typography>
          {role === 'business' && minPhotos != null ? (
            <Chip sx={{ mb: 1 }} label={t('rentalInspection.minPhotos', 'Min {{count}}', { count: minPhotos })} />
          ) : null}
          <PhotoRow
            unit={unit}
            minPhotos={minPhotos}
            readOnly={role === 'client' || view.status === 'submitted'}
            submittedAt={view.submittedAt}
            timeZone={confirmationTimeZone(
              booking.rental_location_listing?.business_location?.address?.country,
              booking.currency
            )}
            onFile={(photoRole, file) => void upload(photoRole, file)}
          />
          {role === 'business' && !(stage === 'pickup' && view.status === 'submitted') ? (
            <BusinessFields stage={stage} draft={draft} setDraft={setDraft} />
          ) : (
            <ClientFacts unit={unit} />
          )}
          {role === 'client' && damaged ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {damageRail(booking) === 'card'
                ? t('rentalInspection.cardAgree', 'If you agree, we capture {{amount}} from your card hold. Rent and overtime settle as usual.', { amount: view.claimedDamageAmount ?? '' })
                : t('rentalInspection.recordedAgree', 'If you agree, we record the claim only. No money moves automatically. Rendasua support resolves any payment. Rent and overtime settle as usual.')}
              {' '}
              {t('rentalInspection.respondSoon', 'Respond soon. Reminder in 24 hours. A person reviews it after 48 hours if you do not reply. A damage claim is never accepted automatically.')}
            </Alert>
          ) : null}
          {role === 'client' && panel !== 'review' ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {CORRECTION_REASON_CODES.map((code) => (
                <FormControlLabel
                  key={code}
                  control={
                    <Checkbox
                      checked={reasons.includes(code)}
                      onChange={() =>
                        setReasons((prev) => (prev.includes(code) ? prev.filter((row) => row !== code) : [...prev, code]))
                      }
                    />
                  }
                  label={labels[code]}
                />
              ))}
              <TextField label={t('rentalInspection.details', 'Details')} value={details} onChange={(event) => setDetails(event.target.value)} multiline />
              {panel === 'dispute' ? (
                <Button component="label" variant="outlined" sx={{ minHeight: 48 }}>
                  {t('rentalInspection.counterPhotos', 'Counter-photo')}
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload('counter', file);
                  }} />
                </Button>
              ) : null}
            </Stack>
          ) : null}
          {role === 'business' && stage === 'return' ? (
            <TextField sx={{ mt: 1 }} label={t('rentalInspection.claimedAmount', 'Amount you are claiming')} value={claim} onChange={(event) => setClaim(event.target.value)} helperText={booking.currency ?? ''} />
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            {role === 'business' && stage === 'pickup' && view.status === 'submitted' ? null : role === 'business' ? (
              <>
                <Button variant="contained" color="success" sx={{ minHeight: 48 }} disabled={busy || view.status === 'submitted'} onClick={() => void saveUnit()}>
                  {t('rentalInspection.saveUnitNext', 'Save unit · next')}
                </Button>
                <Button variant="contained" sx={{ minHeight: 48 }} disabled={busy || minPhotos == null || offline || view.status === 'submitted' || (stage === 'return' && returnHasDamage(view) && !(Number(claim) > 0))} onClick={() => void submit()}>
                  {stage === 'return'
                    ? t('rentalInspection.submitReturn', 'Submit return report')
                    : t('rentalInspection.submitReport', 'Submit report')}
                </Button>
                {stage === 'return' ? (
                  <Button variant="outlined" sx={{ minHeight: 48 }} disabled={busy || !canHandback} onClick={() => void run(() => model.api.handback(bookingId).then(() => undefined), 'handed')}>
                    {t('rentalInspection.confirmHandback', 'Confirm physical handback')}
                  </Button>
                ) : null}
              </>
            ) : panel === 'review' ? null : (
              <Button
                variant="contained"
                sx={{ minHeight: 48 }}
                disabled={busy || offline || !view.versionId}
                onClick={() => {
                  const reason = correctionReasonText(reasons, details, labels);
                  if (!reason.trim()) return;
                  void run(
                    () =>
                      model.api
                        .acknowledge(bookingId, stage, {
                          versionId: view.versionId!,
                          decision: panel === 'dispute' ? 'dispute' : 'correction',
                          reason,
                        })
                        .then(() => undefined),
                    panel === 'dispute' ? 'disputed' : 'correction'
                  );
                }}
              >
                {panel === 'dispute'
                  ? t('rentalInspection.reportDisagreement', 'Report a disagreement')
                  : t('rentalInspection.sendToBusiness', 'Send to business')}
              </Button>
            )}
          </Stack>
        </Box>
      ) : null}
      {role === 'client' && panel === 'review' && stage && view?.status === 'submitted' ? (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {stage === 'pickup' && !damaged && (booking.accept_start_preview?.amount_due_at_pickup ?? 0) > 0 ? (
            <Typography textAlign="center">
              {t('rentalInspection.payNow', "You'll pay {{amount}} now", {
                amount: fcfaAmount(booking.accept_start_preview?.amount_due_at_pickup ?? 0, booking.currency ?? 'XAF'),
              })}
            </Typography>
          ) : null}
          <Button
            fullWidth
            variant="contained"
            sx={{ minHeight: 48 }}
            disabled={busy || !reviewed || !view.versionId}
            onClick={() => {
              if (stage === 'pickup' && !damaged) {
                setConfirmOpen(true);
                return;
              }
              void run(() => model.api.acknowledge(bookingId, stage, { versionId: view.versionId!, decision: 'accept' }).then(() => undefined), 'accepted');
            }}
          >
            {damaged
              ? damageRail(booking) === 'card'
                ? t('rentalInspection.agreeCapture', 'I agree · capture {{amount}}', { amount: view.claimedDamageAmount ?? '' })
                : t('rentalInspection.agreeRecord', 'I agree · record claim')
              : stage === 'pickup'
                ? t('rentalInspection.acceptAndStart', 'Accept condition & start rental')
                : t('rentalInspection.confirmNoDisagreement', 'Confirm · no disagreement')}
          </Button>
          <Button fullWidth variant="outlined" color="error" sx={{ minHeight: 48 }} onClick={() => setPanel(damaged ? 'dispute' : 'correction')}>
            {damaged
              ? t('rentalInspection.disputeClaim', 'Dispute this claim')
              : stage === 'pickup'
                ? t('rentalInspection.reportProblem', 'Report a problem')
                : t('rentalInspection.requestCorrection', 'Request a correction')}
          </Button>
        </Stack>
      ) : null}
      <AcceptStartDialog
        open={confirmOpen}
        busy={busy}
        booking={booking}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void confirmStart()}
      />
    </Stack>
  );
}

function fcfaAmount(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA') return `${sign}${digits} FCFA`;
  return `${sign}${digits} ${currency}`;
}

function AcceptStartDialog({
  open,
  busy,
  booking,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  booking: PanelBooking;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  const due = booking.end_at ? formatListingDue(booking.end_at, i18n.language) : '';
  const preview = booking.accept_start_preview;
  const amount = fcfaAmount(preview?.amount_due_at_pickup ?? 0, booking.currency ?? 'XAF');
  const showPay = (preview?.amount_due_at_pickup ?? 0) > 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      transitionDuration={0}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.55)' } },
        paper: {
          sx: {
            bgcolor: '#FFFFFF',
            backgroundImage: 'none',
            opacity: 1,
            m: 0,
            width: '100%',
            maxWidth: 480,
            position: 'fixed',
            bottom: 0,
            borderRadius: '20px 20px 0 0',
          },
        },
      }}
    >
      <DialogTitle>{t('rentalInspection.sheetTitle', 'Start this rental?')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('rentalInspection.sheetBody', 'The rental clock starts now. Return is due by {{due}}.', { due })}
        </Typography>
        {showPay ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {preview?.payment_rail === 'mobile_money'
              ? t('rentalInspection.sheetMomo', "You'll pay {{amount}} by Mobile Money", { amount })
              : t('rentalInspection.payNow', "You'll pay {{amount}} now", { amount })}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 3 }}>
        <Button fullWidth variant="contained" onClick={onConfirm} disabled={busy} sx={{ minHeight: 48 }}>
          {t('rentalInspection.acceptAndStart', 'Accept condition & start rental')}
        </Button>
        <Button fullWidth onClick={onClose} disabled={busy} sx={{ minHeight: 48 }}>
          {t('rentalInspection.sheetCancel', 'Cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BusinessAcceptHero({
  booking,
  pickup,
  onUpdate,
}: {
  booking: PanelBooking;
  pickup: InspectionView | null;
  onUpdate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const started = booking.status === 'active' || booking.status === 'awaiting_return';
  const submitted = pickup?.status === 'submitted' ? pickup.units.length : 0;
  const waiting = !started && !booking.actual_start_at && submitted > 0 && (booking.status === 'reserved' || booking.status === 'confirmed');
  if (!started && !waiting) return null;
  const name = booking.client?.user?.first_name || t('rentalInspection.renterFallback', 'The renter');
  const due = booking.end_at ? formatListingDue(booking.end_at, i18n.language) : '';
  const paid = fcfaAmount(Number(booking.total_amount) || 0, booking.currency ?? 'XAF');
  return (
    <Stack spacing={1} sx={{ textAlign: 'center' }}>
      <Typography variant="h5">
        {started
          ? t('rentalInspection.startedTitle', 'Started, hand over the item')
          : t('rentalInspection.waitingTitle', 'Waiting for the renter to accept')}
      </Typography>
      <Typography color="text.secondary">
        {started ? (
          <>
            {t('rentalInspection.startedBodyLead', '{{name}} accepted the condition and the rental is in progress. Return is due by', { name })}{' '}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{due}</Box>
            .
          </>
        ) : (
          t('rentalInspection.waitingBody', "{{name}} is reviewing the condition report. You'll see when the rental starts — then hand over the item.", { name })
        )}
      </Typography>
      {started ? (
        <Typography color="success.main" fontWeight={700}>
          {booking.payment_status === 'authorized'
            ? t('rentalInspection.heldAmount', '{{amount}} held', { amount: paid })
            : t('rentalInspection.paidAmount', '{{amount}} paid', { amount: paid })}
        </Typography>
      ) : (
        <Alert severity="info">
          {t('rentalInspection.noPinNote', 'Pickup photos submitted · {{count}} of {{total}} units.', {
            count: submitted,
            total: booking.units_booked || submitted,
          })}
        </Alert>
      )}
      {!started && businessCanReplaceReport(pickup) ? (
        <Button variant="outlined" color="success" onClick={onUpdate}>
          {t('rentalInspection.updateReport', 'Update report')}
        </Button>
      ) : null}
    </Stack>
  );
}

interface Draft {
  condition: '' | 'good' | 'fair' | 'damaged';
  accessoryName: string;
  accessoryCount: string;
  noAccessories: boolean;
  wear: string;
  noWear: boolean;
  note: string;
  label: string;
  returnChoice: '' | 'same' | 'damage';
}

function draftFrom(unit: InspectionUnit): Draft {
  return {
    condition: unit.condition === 'good' || unit.condition === 'fair' || unit.condition === 'damaged' ? unit.condition : '',
    accessoryName: unit.accessories[0]?.name ?? '',
    accessoryCount: unit.accessories[0] ? String(unit.accessories[0].count) : '1',
    noAccessories: unit.accessories.length === 0 && !!unit.condition,
    wear: unit.wear === 'none' ? '' : unit.wear ?? '',
    noWear: unit.wear === 'none',
    note: '',
    label: unit.physicalLabel ?? '',
    returnChoice: unit.condition === 'damaged' ? 'damage' : '',
  };
}

function itemFromDraft(draft: Draft, unitId: string, stage: InspectionStage, pickup?: InspectionUnit) {
  if (stage === 'return' && draft.returnChoice === 'same' && pickup) {
    return {
      unitId,
      condition: (pickup.condition === 'fair' || pickup.condition === 'damaged' ? pickup.condition : 'good') as 'good' | 'fair' | 'damaged',
      accessories: pickup.accessories,
      wear: pickup.wear || 'none',
      checklistNote: draft.note.trim() || undefined,
      physicalLabel: draft.label.trim() || undefined,
    };
  }
  const condition = stage === 'return' && draft.returnChoice === 'damage' ? 'damaged' : draft.condition;
  const wear = draft.noWear ? 'none' : draft.wear.trim();
  if (condition !== 'good' && condition !== 'fair' && condition !== 'damaged') return null;
  if (!wear) return null;
  const accessories = draft.noAccessories
    ? []
    : draft.accessoryName.trim()
      ? [{ name: draft.accessoryName.trim(), count: Number(draft.accessoryCount) || 1 }]
      : [];
  return {
    unitId,
    condition,
    accessories,
    wear,
    checklistNote: draft.note.trim() || undefined,
    physicalLabel: draft.label.trim() || undefined,
  };
}

interface PhotoSlide {
  role: string;
  url: string;
}

function photoSlides(unit: InspectionUnit, roles: PhotoRole[]): PhotoSlide[] {
  return roles.flatMap((role) => {
    const photo = unit.photos.find((row) => row.role === role);
    return photo?.url ? [{ role, url: photo.url }] : [];
  });
}

function slideIndex(slides: PhotoSlide[], role: string): number {
  const index = slides.findIndex((row) => row.role === role);
  return index < 0 ? 0 : index;
}

function PhotoRow({
  unit,
  minPhotos,
  readOnly,
  submittedAt,
  timeZone,
  onFile,
}: {
  unit: InspectionUnit;
  minPhotos: number | null;
  readOnly: boolean;
  submittedAt: string | null;
  timeZone: string;
  onFile: (role: PhotoRole, file: File) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const roles = minPhotos == null ? REQUIRED_PHOTO_ROLES : photoRolesForMinimum(minPhotos);
  const slides = photoSlides(unit, roles);
  return (
    <>
      <PhotoTiles roles={roles} unit={unit} readOnly={readOnly} slides={slides} onFile={onFile} onOpen={setOpen} />
      <PhotoLightbox
        slides={slides}
        index={open}
        submittedAt={submittedAt}
        timeZone={timeZone}
        onClose={() => setOpen(null)}
        onMove={setOpen}
      />
    </>
  );
}

function PhotoTiles({
  roles,
  unit,
  readOnly,
  slides,
  onFile,
  onOpen,
}: {
  roles: PhotoRole[];
  unit: InspectionUnit;
  readOnly: boolean;
  slides: PhotoSlide[];
  onFile: (role: PhotoRole, file: File) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
      {roles.map((role) => (
        <PhotoTile
          key={role}
          role={role}
          photo={unit.photos.find((row) => row.role === role)}
          readOnly={readOnly}
          onFile={onFile}
          onOpen={() => onOpen(slideIndex(slides, role))}
        />
      ))}
    </Stack>
  );
}

function PhotoTile({
  role,
  photo,
  readOnly,
  onFile,
  onOpen,
}: {
  role: PhotoRole;
  photo: InspectionUnit['photos'][number] | undefined;
  readOnly: boolean;
  onFile: (role: PhotoRole, file: File) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const label = t(ROLE_KEY[role][0], ROLE_KEY[role][1]);
  const thumb = photoThumb(photo?.url, label);
  return (
    <Stack spacing={0.5} alignItems="center" sx={{ width: 96 }}>
      {readOnly && photo?.url ? (
        <Button variant="outlined" sx={{ minHeight: 96, minWidth: 96, p: 0.5 }} onClick={onOpen} aria-label={label}>
          {thumb}
        </Button>
      ) : (
        <UploadTile label={label} role={role} readOnly={readOnly} onFile={onFile} thumb={thumb} />
      )}
      {photo?.url ? <Typography variant="caption" color="text.secondary" align="center">{label}</Typography> : null}
    </Stack>
  );
}

function photoThumb(url: string | undefined, label: string) {
  if (!url) return label;
  return <Box component="img" src={url} alt={label} sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1 }} />;
}

function UploadTile({
  label,
  role,
  readOnly,
  onFile,
  thumb,
}: {
  label: string;
  role: PhotoRole;
  readOnly: boolean;
  onFile: (role: PhotoRole, file: File) => void;
  thumb: React.ReactNode;
}) {
  return (
    <Button component="label" variant="outlined" sx={{ minHeight: 96, minWidth: 96, p: 0.5 }}>
      {thumb || label}
      {readOnly ? null : <PhotoFileInput role={role} onFile={onFile} />}
    </Button>
  );
}

function PhotoFileInput({ role, onFile }: { role: PhotoRole; onFile: (role: PhotoRole, file: File) => void }) {
  return (
    <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) onFile(role, file);
    }} />
  );
}

function PhotoLightbox({
  slides,
  index,
  submittedAt,
  timeZone,
  onClose,
  onMove,
}: {
  slides: PhotoSlide[];
  index: number | null;
  submittedAt: string | null;
  timeZone: string;
  onClose: () => void;
  onMove: (index: number) => void;
}) {
  const slide = index == null ? null : slides[index] ?? null;
  return (
    <Dialog
      open={index != null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      transitionDuration={0}
      onKeyDown={(event) => moveLightbox(event, index, slides.length, onMove)}
      sx={LIGHTBOX_SX}
      slotProps={{
        backdrop: { sx: { backgroundColor: '#0B0B0D', opacity: 1 } },
        paper: { sx: { bgcolor: '#0B0B0D', backgroundImage: 'none', color: '#fff', position: 'relative' } },
      }}
    >
      <LightboxBody slide={slide} submittedAt={submittedAt} timeZone={timeZone} index={index ?? 0} count={slides.length} onClose={onClose} onMove={onMove} />
    </Dialog>
  );
}

const LIGHTBOX_SX = {
  '& .MuiBackdrop-root': { backgroundColor: '#0B0B0D', opacity: 1 },
  '& .MuiDialog-paper': { backgroundColor: '#0B0B0D', backgroundImage: 'none', color: '#fff' },
};

function moveLightbox(event: React.KeyboardEvent, index: number | null, count: number, onMove: (index: number) => void) {
  if (index == null) return;
  if (event.key === 'ArrowRight' && index < count - 1) onMove(index + 1);
  if (event.key === 'ArrowLeft' && index > 0) onMove(index - 1);
}

function LightboxBody({
  slide,
  submittedAt,
  timeZone,
  index,
  count,
  onClose,
  onMove,
}: {
  slide: PhotoSlide | null;
  submittedAt: string | null;
  timeZone: string;
  index: number;
  count: number;
  onClose: () => void;
  onMove: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const label = slide ? t(ROLE_KEY[slide.role][0], ROLE_KEY[slide.role][1]) : '';
  const when = formatConfirmationDue(submittedAt, timeZone, i18n.language);
  return (
    <DialogContent sx={{ p: 2, color: '#fff' }}>
      <IconButton aria-label={t('common.close', 'Close')} onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}>
        <CloseIcon />
      </IconButton>
      {slide ? <Box component="img" src={slide.url} alt={label} sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} /> : null}
      <Typography align="center" sx={{ mt: 1.5, color: '#fff' }}>{when ? `${label} · ${when}` : label}</Typography>
      <LightboxArrows index={index} count={count} onMove={onMove} />
    </DialogContent>
  );
}

function LightboxArrows({ index, count, onMove }: { index: number; count: number; onMove: (index: number) => void }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
      <IconButton aria-label={t('rentalInspection.previousPhoto', 'Previous photo')} disabled={index <= 0} onClick={() => onMove(index - 1)} sx={{ color: '#fff' }}>
        <ChevronLeftIcon />
      </IconButton>
      <IconButton aria-label={t('rentalInspection.nextPhoto', 'Next photo')} disabled={index >= count - 1} onClick={() => onMove(index + 1)} sx={{ color: '#fff' }}>
        <ChevronRightIcon />
      </IconButton>
    </Stack>
  );
}

function BusinessFields({
  stage,
  draft,
  setDraft,
}: {
  stage: InspectionStage;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
}) {
  const { t } = useTranslation();
  const patch = (partial: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  return (
    <Stack spacing={1}>
      {stage === 'return' ? (
        <Stack direction="row" spacing={1}>
          <Button variant={draft.returnChoice === 'same' ? 'contained' : 'outlined'} sx={{ minHeight: 48 }} onClick={() => patch({ returnChoice: 'same' })}>
            {t('rentalInspection.sameCondition', 'Same condition')}
          </Button>
          <Button variant={draft.returnChoice === 'damage' ? 'contained' : 'outlined'} color="warning" sx={{ minHeight: 48 }} onClick={() => patch({ returnChoice: 'damage' })}>
            {t('rentalInspection.damageFound', 'Damage found')}
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button variant={draft.condition === 'good' ? 'contained' : 'outlined'} sx={{ minHeight: 48 }} onClick={() => patch({ condition: 'good' })}>
            {t('rentalInspection.overallGood', 'Overall good')}
          </Button>
          <Button variant={draft.condition === 'fair' ? 'contained' : 'outlined'} sx={{ minHeight: 48 }} onClick={() => patch({ condition: 'fair' })}>
            {t('rentalInspection.overallFair', 'Fair condition')}
          </Button>
          <Button variant={draft.condition === 'damaged' ? 'contained' : 'outlined'} sx={{ minHeight: 48 }} onClick={() => patch({ condition: 'damaged' })}>
            {t('rentalInspection.overallDamaged', 'Damaged')}
          </Button>
        </Stack>
      )}
      <FormControlLabel control={<Checkbox checked={draft.noAccessories} onChange={(event) => patch({ noAccessories: event.target.checked })} />} label={t('rentalInspection.noAccessories', 'No accessories')} />
      {!draft.noAccessories ? (
        <Stack direction="row" spacing={1}>
          <TextField label={t('rentalInspection.accessoryName', 'Accessory')} value={draft.accessoryName} onChange={(event) => patch({ accessoryName: event.target.value })} />
          <TextField label={t('rentalInspection.accessoryCount', 'Count')} value={draft.accessoryCount} onChange={(event) => patch({ accessoryCount: event.target.value })} />
        </Stack>
      ) : null}
      <FormControlLabel control={<Checkbox checked={draft.noWear} onChange={(event) => patch({ noWear: event.target.checked })} />} label={t('rentalInspection.noWear', 'No existing wear')} />
      {!draft.noWear ? (
        <TextField label={stage === 'return' && draft.returnChoice === 'damage' ? t('rentalInspection.describeDamage', 'Describe damage') : t('rentalInspection.wearNote', 'Describe the wear')} value={draft.wear} onChange={(event) => patch({ wear: event.target.value })} />
      ) : null}
      <TextField label={t('rentalInspection.serialLabel', 'Serial or label')} value={draft.label} onChange={(event) => patch({ label: event.target.value })} />
      <TextField label={t('rentalInspection.notesOptional', 'Notes (optional)')} value={draft.note} onChange={(event) => patch({ note: event.target.value })} />
    </Stack>
  );
}

function ClientFacts({ unit }: { unit: InspectionUnit }) {
  const { t } = useTranslation();
  const condition =
    unit.condition === 'good'
      ? t('rentalInspection.overallGood', 'Overall good')
      : unit.condition === 'fair'
        ? t('rentalInspection.overallFair', 'Fair condition')
        : unit.condition === 'damaged'
          ? t('rentalInspection.damageFound', 'Damage found')
          : unit.condition;
  const wear = !unit.wear || unit.wear === 'none' ? t('rentalInspection.noWear', 'No existing wear') : unit.wear;
  return (
    <Stack spacing={0.5}>
      <Typography>{condition}</Typography>
      <Typography>{wear}</Typography>
      {unit.accessories.map((row) => (
        <Typography key={row.name}>{`${row.name} · ${row.count}`}</Typography>
      ))}
    </Stack>
  );
}

function Timeline({
  role,
  booking,
  pickup,
  returnView,
}: {
  role: 'client' | 'business';
  booking: PanelBooking;
  pickup: Model['pickup'];
  returnView: Model['returnView'];
}) {
  const { t } = useTranslation();
  const started = !!booking.actual_start_at || ['active', 'awaiting_return', 'completed'].includes(booking.status);
  const accepted = pickup?.yourDecision === 'accept' || started;
  const openReview = booking.return_resolution === 'disputed' || booking.return_resolution === 'review' || booking.return_resolution === 'pending';
  const rows = [
    t('rentalInspection.timelineBooked', 'Booked'),
    t('rentalInspection.timelinePickupSubmitted', 'Condition report sent'),
    role === 'client'
      ? t('rentalInspection.timelineAccepted', 'You accepted the condition')
      : t('rentalInspection.statusClientAck', 'The renter accepted the condition report'),
    t('rentalInspection.timelineStarted', 'Rental started'),
    t('rentalInspection.timelineHandback', 'Physical handback recorded'),
    t('rentalInspection.timelineReturnDamage', 'Return inspection'),
    openReview
      ? t('rentalInspection.timelineSettlementWaiting', 'Blocked while review is open')
      : role === 'business' && returnHasDamage(returnView)
        ? damageRail(booking) === 'card'
          ? t('rentalInspection.railCard', 'The card hold stays open until the client agrees, which captures the agreed amount, or until support decides.')
          : t('rentalInspection.railRecorded', 'MoMo / wallet: the damage claim is record-only. Rent and overtime can settle. Rendasua support resolves any damage payment. Nothing is debited automatically.')
        : t('rentalInspection.timelineSettlement', 'Settlement'),
  ];
  const done = [
    true,
    pickup?.status === 'submitted' || accepted,
    accepted,
    !!booking.actual_start_at || ['active', 'awaiting_return', 'completed'].includes(booking.status),
    !!booking.return_handed_back_at,
    booking.return_resolution === 'accepted' || booking.return_resolution === 'admin_cleared' || returnHasDamage(returnView),
    booking.status === 'completed',
  ];
  return (
    <Stack spacing={0.5}>
      {rows.map((title, row) => (
        <Typography key={title} color={done[row] ? 'text.primary' : 'text.secondary'}>
          {done[row] ? '● ' : '○ '}
          {title}
        </Typography>
      ))}
    </Stack>
  );
}

function bannerText(
  error: string | null,
  banner: string | null,
  offline: boolean,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string | null {
  if (offline) return t('rentalInspection.photosNotSynced', 'Photos not synced. Connect to submit.');
  const code = banner === 'conflict' || banner === 'update_required' ? banner : error;
  if (code === 'conflict' || banner === 'conflict') return t('rentalInspection.reportChanged', 'That report changed. Review it again.');
  if (code === 'update_required') {
    return t('rentalInspection.updateRequired', 'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.');
  }
  if (banner === 'submitted') return t('rentalInspection.reportUpdated', 'Report updated. Please review it again.');
  if (banner === 'handed') return t('rentalInspection.handbackRecorded', 'Physical handback recorded.');
  if (banner === 'accepted') return t('rentalInspection.accepted', 'You accepted this report.');
  if (banner === 'correction') return t('rentalInspection.correctionSent', 'Correction sent. The business will update the report.');
  if (banner === 'disputed') return t('rentalInspection.returnRecorded', 'Return recorded. Financial review pending.');
  if (banner === 'incomplete') return t('rentalInspection.photoRequirementMissing', 'The photo minimum could not be loaded. Connect and try again.');
  if (banner === 'retry') return t('rentalInspection.tryAgain', 'Something went wrong. Try again.');
  if (error) return t('rentalInspection.loadFailed', 'Could not load the inspection.');
  return null;
}

function classifyMessage(
  error: unknown,
  t: (key: string, fallback: string) => string
): string {
  const err = error as { response?: { status?: number; data?: { code?: string; message?: string } }; status?: number; code?: string };
  const status = err.status ?? err.response?.status;
  const code = err.code ?? err.response?.data?.code;
  if (status === 409) return 'conflict';
  if (status === 426 || code === 'RENTAL_INSPECTION_UPDATE_REQUIRED') return 'update_required';
  if (typeof err.response?.data?.message === 'string') return err.response.data.message;
  return t('rentalInspection.loadFailed', 'Could not load the inspection.');
}
