import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useRentalInspection } from '../../hooks/useRentalInspection';
import {
  CORRECTION_REASON_CODES,
  REQUIRED_PHOTO_ROLES,
  allUnitsReviewed,
  correctionReasonText,
  damageRail,
  handbackEnabled,
  photoRolesForMinimum,
  reportReadyToSubmit,
  returnHasDamage,
  type InspectionStage,
  type InspectionUnit,
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
  const { t } = useTranslation();
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

  const submit = async () => {
    if (!stage || minPhotos == null || !view) return;
    if (!reportReadyToSubmit(view.units, minPhotos)) {
      setBanner('incomplete');
      return;
    }
    await run(async () => {
      await model.api.submit(bookingId, stage);
    }, 'submitted');
  };

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {message ? <Alert severity={model.error === 'conflict' || banner === 'conflict' ? 'warning' : 'info'}>{message}</Alert> : null}
      {role === 'business' && model.gate.mode === 'waiting' ? (
        <Alert severity="warning">
          {booking.status === 'reserved'
            ? t('rentalInspection.waitingBeforePayment', 'The client reviews the report before you collect payment.')
            : t('rentalInspection.waitingBeforeCode', 'The client reviews the report before a support code can start the rental.')}
        </Alert>
      ) : null}
      {stage === 'return' && role === 'client' && !model.pickup?.units.some((row) => row.photos.length) ? (
        <Alert severity="warning">
          {t('rentalInspection.pickupBaselineMissing', 'Pickup baseline unavailable for this rental')}
        </Alert>
      ) : null}
      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="overline">{t('rentalInspection.timelineTitle', 'Timeline')}</Typography>
        <Timeline role={role} booking={booking} pickup={model.pickup} returnView={model.returnView} />
      </Box>
      {role === 'client' && stage && view && view.units.length === 0 ? (
        <Alert severity="info">{t('rentalInspection.businessRecording', 'The business is recording the condition report.')}</Alert>
      ) : null}
      {stage && view && unit && draft ? (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {view.units.map((row, rowIndex) => (
              <Button key={row.unitId} variant={rowIndex === index ? 'contained' : 'outlined'} sx={{ minHeight: 48 }} onClick={() => setIndex(rowIndex)}>
                {row.displayLabel}
              </Button>
            ))}
            {role === 'business' && view.versionNo != null ? <Chip label={t('rentalInspection.version', 'v{{version}}', { version: view.versionNo })} /> : null}
          </Stack>
          {role === 'business' && view.correctionReason ? <Alert severity="warning">{view.correctionReason}</Alert> : null}
          <Typography variant="h6" sx={{ mb: 1 }}>{unit.displayLabel}</Typography>
          {minPhotos != null ? (
            <Chip sx={{ mb: 1 }} label={t('rentalInspection.minPhotos', 'Min {{count}}', { count: minPhotos })} />
          ) : null}
          <PhotoRow
            unit={unit}
            minPhotos={minPhotos}
            readOnly={role === 'client' || view.status === 'submitted'}
            onFile={(photoRole, file) => void upload(photoRole, file)}
          />
          {role === 'business' ? (
            <BusinessFields stage={stage} draft={draft} setDraft={setDraft} />
          ) : (
            <ClientFacts unit={unit} />
          )}
          {role === 'client' && damaged ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {damageRail(booking) === 'card'
                ? t('rentalInspection.cardDamage', 'Damage can only come from the card deposit, after a person reviews it. The rental amount and overtime settle as usual.')
                : t('rentalInspection.recordedDamage', 'This damage claim is recorded for review. It is not charged automatically. The rental amount and overtime settle as usual.')}
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            {role === 'business' ? (
              <>
                <Button variant="contained" color="success" sx={{ minHeight: 48 }} disabled={busy || view.status === 'submitted'} onClick={() => void saveUnit()}>
                  {t('rentalInspection.saveUnitNext', 'Save unit · next')}
                </Button>
                <Button variant="contained" sx={{ minHeight: 48 }} disabled={busy || minPhotos == null || offline || view.status === 'submitted'} onClick={() => void submit()}>
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
            ) : panel === 'review' ? (
              <>
                <Button
                  variant="contained"
                  sx={{ minHeight: 48 }}
                  disabled={busy || !reviewed || !view.versionId}
                  onClick={() => void run(() => model.api.acknowledge(bookingId, stage, { versionId: view.versionId!, decision: 'accept' }).then(() => undefined), 'accepted')}
                >
                  {damaged
                    ? t('rentalInspection.agreeReport', 'I agree with this report')
                    : stage === 'return'
                      ? t('rentalInspection.confirmNoDisagreement', 'Confirm · no disagreement')
                      : t('rentalInspection.acceptReport', 'Accept this condition report')}
                </Button>
                <Button variant="outlined" color="error" sx={{ minHeight: 48 }} onClick={() => setPanel(damaged ? 'dispute' : 'correction')}>
                  {damaged
                    ? t('rentalInspection.disputeClaim', 'Dispute this claim')
                    : t('rentalInspection.requestCorrection', 'Request a correction')}
                </Button>
              </>
            ) : (
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

function PhotoRow({
  unit,
  minPhotos,
  readOnly,
  onFile,
}: {
  unit: InspectionUnit;
  minPhotos: number | null;
  readOnly: boolean;
  onFile: (role: PhotoRole, file: File) => void;
}) {
  const { t } = useTranslation();
  const roles = minPhotos == null ? REQUIRED_PHOTO_ROLES : photoRolesForMinimum(minPhotos);
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
      {roles.map((role) => {
        const photo = unit.photos.find((row) => row.role === role);
        const label = t(ROLE_KEY[role][0], ROLE_KEY[role][1]);
        return (
          <Button key={role} component="label" variant="outlined" sx={{ minHeight: 96, minWidth: 96 }}>
            {photo?.url ? <Box component="img" src={photo.url} alt={label} sx={{ width: 72, height: 72, objectFit: 'cover' }} /> : label}
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
  const accepted = pickup?.yourDecision === 'accept';
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
