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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import type { useRentalInspection } from '../../hooks/useRentalInspection';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useRentalApi } from '../../hooks/useRentalApi';
import { PickupWebNotice } from './PickupWebNotice';
import { blockedScreenRows, submitLeftCount } from '../../utils/rentals/blockedGuideRows';
import { formatListingDay, formatListingStamp } from '../../utils/rentals/pickupPhotoTime';
import type { PickupPhotoRules } from '../../utils/rentalInspection';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { formatListingDue } from '../../utils/rentalRequestFormat';
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
}: {
  bookingId: string;
  role: 'client' | 'business';
  booking: PanelBooking;
  model: Model;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { acceptAndStart, fetchBookingDetail, getBookingPaymentStatus } = useRentalApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const { flags } = useClientFlags();
  const [photoRules, setPhotoRules] = useState<PickupPhotoRules | null>(null);
  const [photoBlocked, setPhotoBlocked] = useState(false);
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
  const rulesOn = role === 'business' && stage === 'pickup' && photoRules?.enabled === true;
  useEffect(() => {
    if (role !== 'business' || stage !== 'pickup' || !flags.rentals_pickup_photo_rules_enabled) {
      setPhotoRules(null);
      return;
    }
    let live = true;
    void model.api.photoRules(bookingId).then((row) => {
      if (live) setPhotoRules(row);
    }).catch(() => {
      if (live) setPhotoRules(null);
    });
    return () => {
      live = false;
    };
  }, [bookingId, flags.rentals_pickup_photo_rules_enabled, model.api, role, stage]);
  useEffect(() => {
    if (!unit) return;
    setDraft(draftFrom(unit, rulesOn));
    setSeen((prev) => new Set(prev).add(unit.unitId));
  }, [rulesOn, unit]);

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
        onChanged();
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
  }, [bookingId, fetchBookingDetail, getBookingPaymentStatus, momoPhase, onChanged]);

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
        setMomoPhase('waiting');
        return;
      }
      setMomoPhase(null);
      onChanged();
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
    if (rulesOn && photoRules?.guideMode === 'guide' && photoRules.guide) {
      const missing = guideGaps(view.units, photoRules.guide.slots, view.slotSkips ?? []);
      if (missing.length) {
        setPhotoBlocked(true);
        return;
      }
    }
    if (rulesOn && photoRules && !photoRules.pickupDay) return;
    if (!reportReadyToSubmit(view.units, minPhotos)) {
      setBanner('incomplete');
      return;
    }
    await run(async () => {
      const amount = Number(claim);
      await model.api.submit(bookingId, stage, stage === 'return' && amount > 0 ? amount : undefined);
    }, 'submitted');
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
            {role === 'business' && view.versionNo != null ? <Chip label={t('rentalInspection.version', 'v{{version}}', { version: view.versionNo })} /> : null}
          </Stack>
          {role === 'business' && view.correctionReason ? <Alert severity="warning">{view.correctionReason}</Alert> : null}
          <Typography variant="h6" sx={{ mb: 1 }}>{unit.displayLabel}</Typography>
          {minPhotos != null ? (
            <Chip sx={{ mb: 1 }} label={t('rentalInspection.minPhotos', 'Min {{count}}', { count: minPhotos })} />
          ) : null}
          {rulesOn && photoRules ? (
            <PickupWebNotice
              rules={photoRules}
              busy={busy}
              blocked={photoBlocked}
              rows={noticeRows(view.units, photoRules.guide?.slots ?? [], view.slotSkips ?? [], t)}
              progress={photoProgress(view.units, photoRules.guide?.slots ?? [])}
              onChoose={(mode) => void run(async () => {
                await model.api.applyGuide(bookingId, mode);
                const next = await model.api.photoRules(bookingId);
                setPhotoRules(next);
              })}
              onRetake={() => setPhotoBlocked(false)}
              onSkip={(row, reason) => void run(async () => {
                await model.api.skipSlot(bookingId, { unitId: row.unitId, slotKey: row.slotKey, reason });
                await model.reload();
              })}
            />
          ) : null}
          <PhotoRow
            unit={unit}
            minPhotos={minPhotos}
            guideSlots={rulesOn && photoRules?.guideMode === 'guide' ? photoRules.guide?.slots : undefined}
            stampZone={photoRules?.timezone}
            guideDate={photoRules?.guide ? formatListingDay(photoRules.guide.submittedAt, photoRules.timezone, i18n.language) : undefined}
            readOnly={role === 'client' || view.status === 'submitted' || rulesOn}
            onFile={(photoRole, file) => void upload(photoRole, file)}
          />
          {role === 'client'
            ? (view.slotSkips ?? [])
                .filter((row) => row.unitId === unit.unitId)
                .map((row) => (
                  <Typography key={row.slotKey} variant="body2">
                    {t('rentalInspection.skippedAngle', 'Skipped {{angle}}: {{reason}}', {
                      angle: row.slotKey,
                      reason: row.reason,
                    })}
                  </Typography>
                ))
            : null}
          {role === 'business' && !(stage === 'pickup' && view.status === 'submitted') ? (
            <>
              {rulesOn && draft.guideUnconfirmed.length && photoRules?.guide ? (
                <Chip
                  label={t('rentalInspection.fromDate', 'from {{date}}', {
                    date: formatListingDay(photoRules.guide.submittedAt, photoRules.timezone, i18n.language),
                  })}
                  onClick={() => setDraft((prev) => (prev ? { ...prev, guideUnconfirmed: [] } : prev))}
                />
              ) : null}
              <BusinessFields stage={stage} draft={draft} setDraft={setDraft} />
            </>
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
                  {submitLabel(stage, rulesOn, photoRules, view, t)}
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
        <>
          <Box sx={{ height: 196 }} />
          <Box
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20,
              bgcolor: 'background.paper',
              backgroundImage: 'none',
              borderTop: 1,
              borderColor: 'divider',
              boxShadow: 3,
              px: 2,
              pt: 1.5,
              pb: 2,
            }}
          >
            <Stack spacing={1} sx={{ maxWidth: 720, mx: 'auto' }}>
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
          </Box>
        </>
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
          {t('rentalInspection.noPinNote', 'Pickup photos submitted · {{done}} of {{total}} units. No PIN is needed for this rental.', {
            done: submitted,
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
  guideUnconfirmed: string[];
  trackGuide: boolean;
  returnChoice: '' | 'same' | 'damage';
}

function draftFrom(unit: InspectionUnit, keepNote: boolean): Draft {
  return {
    condition: unit.condition === 'good' || unit.condition === 'fair' || unit.condition === 'damaged' ? unit.condition : '',
    accessoryName: unit.accessories[0]?.name ?? '',
    accessoryCount: unit.accessories[0] ? String(unit.accessories[0].count) : '1',
    noAccessories: unit.accessories.length === 0 && !!unit.condition,
    wear: unit.wear === 'none' ? '' : unit.wear ?? '',
    noWear: unit.wear === 'none',
    note: keepNote ? unit.checklistNote ?? '' : '',
    label: unit.physicalLabel ?? '',
    guideUnconfirmed: keepNote && Array.isArray(unit.guideUnconfirmed) ? unit.guideUnconfirmed : [],
    trackGuide: keepNote,
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
    guideUnconfirmed: draft.trackGuide ? draft.guideUnconfirmed : undefined,
  };
}

function guideGaps(
  units: InspectionUnit[],
  slots: Array<{ slotKey: string; required: boolean }>,
  skips: Array<{ unitId: string; slotKey: string; reason: string }>
) {
  const missing: Array<{ unitId: string; slotKey: string; required: boolean }> = [];
  for (const unit of units) {
    for (const slot of slots) {
      const taken = unit.photos.some((photo) => photo.slotKey === slot.slotKey);
      const skipped = !slot.required && skips.some((row) => row.unitId === unit.unitId && row.slotKey === slot.slotKey);
      if (!taken && !skipped) missing.push({ unitId: unit.unitId, slotKey: slot.slotKey, required: slot.required });
    }
  }
  return missing;
}

function submitLabel(
  stage: string,
  rulesOn: boolean,
  rules: PickupPhotoRules | null,
  view: { units: InspectionUnit[]; slotSkips?: Array<{ unitId: string; slotKey: string; reason: string }> },
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  if (stage === 'return') return t('rentalInspection.submitReturn', 'Submit return report');
  const left = rulesOn && rules?.guide
    ? submitLeftCount(guideGaps(view.units, rules.guide.slots, view.slotSkips ?? []))
    : 0;
  if (left > 0) return t('rentalInspection.submitLeft', 'Submit report · {{count}} left', { count: left });
  return t('rentalInspection.submitReport', 'Submit report');
}

function noticeRows(
  units: InspectionUnit[],
  slots: Array<{ slotKey: string; required: boolean; url?: string | null }>,
  skips: Array<{ unitId: string; slotKey: string; reason: string }>,
  t: (key: string, fallback: string, options?: Record<string, string>) => string
) {
  const gaps = guideGaps(units, slots, skips);
  return blockedScreenRows(gaps, skips, slots).map((row) => ({
    ...row,
    label: angleLabel(row.slotKey, t),
  }));
}

function photoProgress(units: InspectionUnit[], slots: Array<{ slotKey: string }>) {
  if (!slots.length) return null;
  const done = units.reduce(
    (count, unit) => count + unit.photos.filter((photo) => slots.some((slot) => slot.slotKey === photo.slotKey && photo.url)).length,
    0
  );
  return { done, total: slots.length * Math.max(units.length, 1) };
}

function angleLabel(slotKey: string, t: (key: string, fallback: string, options?: Record<string, string>) => string) {
  if (slotKey.startsWith('extra:')) return t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: slotKey.slice(6) });
  const pair = ROLE_KEY[slotKey];
  return pair ? t(pair[0], pair[1]) : slotKey;
}

function PhotoRow({
  unit,
  minPhotos,
  readOnly,
  guideSlots,
  stampZone,
  guideDate,
  onFile,
}: {
  unit: InspectionUnit;
  minPhotos: number | null;
  readOnly: boolean;
  guideSlots?: Array<{ slotKey: string; role: PhotoRole; url: string | null; required: boolean }>;
  stampZone?: string;
  guideDate?: string;
  onFile: (role: PhotoRole, file: File) => void;
}) {
  const { t, i18n } = useTranslation();
  const roles = guideSlots?.length
    ? guideSlots
    : (minPhotos == null ? REQUIRED_PHOTO_ROLES : photoRolesForMinimum(minPhotos)).map((role) => ({
        slotKey: role,
        role,
        url: null as string | null,
        required: true,
      }));
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
      {roles.map((slot) => {
        const role = slot.role;
        const photo = unit.photos.find((row) => (row.slotKey ? row.slotKey === slot.slotKey : row.role === role));
        const ghost = !photo?.url && slot.url;
        const extra = slot.slotKey.startsWith('extra:') ? slot.slotKey.slice(6) : '';
        const label = extra
          ? t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: extra })
          : t(ROLE_KEY[role][0], ROLE_KEY[role][1]);
        const stamp = photo?.capturedAt && stampZone
          ? formatListingStamp(photo.capturedAt, stampZone, i18n.language)
          : '';
        const caption = photo?.url
          ? `${label} ✓${stamp ? ` ${stamp}` : ''}`
          : ghost && guideDate
            ? `${label} · ${t('rentalInspection.fromDate', 'from {{date}}', { date: guideDate })}`
            : label;
        return (
          <Button key={slot.slotKey} component="label" variant="outlined" sx={{ minHeight: 96, minWidth: 96, display: 'flex', flexDirection: 'column' }}>
            {photo?.url ? <Box component="img" src={photo.url} alt={label} sx={{ width: 72, height: 72, objectFit: 'cover' }} /> : null}
            {ghost ? <Box component="img" src={slot.url ?? ''} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', opacity: 0.35 }} /> : null}
            <Typography variant="caption">{caption}</Typography>
            {readOnly ? null : (
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(role, file);
                }}
              />
            )}
          </Button>
        );
      })}
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
  const patch = (partial: Partial<Draft>) => setDraft((prev) => {
    if (!prev) return prev;
    const next = { ...prev, ...partial };
    const drop = Object.keys(partial).map((key) => (
      key === 'note' ? 'notes' : key === 'noAccessories' || key === 'accessoryName' ? 'accessories' : key === 'noWear' ? 'wear' : key
    ));
    return { ...next, guideUnconfirmed: next.guideUnconfirmed.filter((tag) => !drop.includes(tag)) };
  });
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
    t('rentalInspection.timelinePickupSubmitted', 'Pickup inspection submitted'),
    role === 'client'
      ? t('rentalInspection.timelineAccepted', 'You accepted the condition')
      : t('rentalInspection.statusClientAck', 'Client acknowledged'),
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
          {role === 'business' && row === 1 && pickup?.versionNo ? ` · ${t('rentalInspection.version', 'v{{version}}', { version: pickup.versionNo })}` : ''}
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
