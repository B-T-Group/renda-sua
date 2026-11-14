import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PickupPhotoRules } from '../../utils/rentalInspection';
import { groupBlockedRows, otherReasonReady, type BlockedGuideRow } from '../../utils/rentals/blockedGuideRows';
import { formatListingDay, listingCity } from '../../utils/rentals/pickupPhotoTime';

function CalendarArt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="#0B7A3B" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="#0B7A3B" strokeWidth="2" />
    </svg>
  );
}

function PhoneArt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="#0B7A3B" strokeWidth="2" />
      <path d="M11 18h2" stroke="#0B7A3B" strokeWidth="2" />
    </svg>
  );
}

function CameraArt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function BlockedWebRow({
  row,
  onRetake,
  onSkip,
}: {
  row: BlockedGuideRow & { label: string; reason?: string | null };
  onRetake: (row: BlockedGuideRow & { reason?: string | null }) => void;
  onSkip: (row: BlockedGuideRow, reason: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <Stack spacing={1} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component={row.thumbUrl ? 'img' : 'div'}
          src={row.thumbUrl || undefined}
          alt=""
          sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', opacity: 0.4, bgcolor: 'grey.200' }}
        />
        <Typography sx={{ flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{row.label}</Typography>
        {row.reason ? (
          <Button size="small" onClick={() => setOpen(true)} sx={{ whiteSpace: 'nowrap' }}>
            {t('rentalInspection.changeSkip', 'Change')}
          </Button>
        ) : row.action === 'skip' ? (
          <Button size="small" onClick={() => setOpen(true)} sx={{ whiteSpace: 'nowrap' }}>
            {t('rentalInspection.skipShort', 'Skip')}
          </Button>
        ) : null}
        <Button variant="contained" color="success" onClick={() => onRetake(row)} aria-label={row.label} sx={{ minWidth: 44, width: 44, height: 44, borderRadius: '22px', p: 0 }}>
          <CameraArt />
        </Button>
      </Stack>
      {row.reason ? <Typography variant="body2">{row.reason}</Typography> : null}
      {open ? (
        <Stack spacing={1}>
          {(['skipNotOnUnit', 'skipAccessory', 'skipCantReach'] as const).map((key) => (
            <Button key={key} variant="outlined" onClick={() => onSkip(row, t(`rentalInspection.${key}`, key))}>
              {t(`rentalInspection.${key}`, key)}
            </Button>
          ))}
          <Button onClick={() => setOther(true)}>{t('rentalInspection.skipOther', 'Other')}</Button>
          {other ? (
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label={t('rentalInspection.skipReason', 'Reason')}
                value={reason}
                inputProps={{ maxLength: 280 }}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button disabled={!otherReasonReady(reason)} onClick={() => onSkip(row, reason.trim())}>
                {t('rentalInspection.skipSave', 'Save reason')}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function PickupWebNotice({
  rules,
  busy,
  blocked,
  rows,
  progress,
  onChoose,
  onRetake,
  onSkip,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  blocked: boolean;
  rows: Array<BlockedGuideRow & { label: string; reason?: string | null }>;
  progress?: { done: number; total: number } | null;
  onChoose: (mode: 'guide' | 'blank') => void;
  onRetake: (row: BlockedGuideRow & { reason?: string | null }) => void;
  onSkip: (row: BlockedGuideRow, reason: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const guide = rules.guide;
  const date = guide ? formatListingDay(guide.submittedAt, rules.timezone, i18n.language) : '';
  const day = rules.startAt ? formatListingDay(rules.startAt, rules.timezone, i18n.language) : '';
  const city = listingCity(rules.timezone);
  const note = rules.pickupDay
    ? t('rentalInspection.guideOnlyNote', 'The last return photos are a guide only. You must retake every photo today, ideally with the renter there.')
    : t('rentalInspection.guideOnlyNoteLater', 'The last return photos are a guide only. You must retake every photo on pickup day, ideally with the renter there.');
  return (
    <Stack spacing={1}>
      {!rules.pickupDay ? (
        <Alert severity="info" icon={<CalendarArt />}>
          {t('rentalInspection.earlyPrepareBody', 'Photos are taken on pickup day, {{date}} ({{city}} time). You can prepare the checklist now.', { date: day, city })}
        </Alert>
      ) : !rules.guideMode ? (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <CameraArt />
          <Typography sx={{ flex: 1, minWidth: 0 }}>
            {t('rentalInspection.pickupTodayBody', 'Pickup today: take the condition photos, ideally with the renter.')}
          </Typography>
        </Stack>
      ) : (
        <Alert severity="info" icon={<PhoneArt />}>
          {t('rentalInspection.webAppOnly', 'Take pickup photos in the Rendasua app')}
        </Alert>
      )}
      {progress && rules.guideMode === 'guide' ? (
        <Typography>
          {t('rentalInspection.retakenProgress', '{{done}} of {{total}} retaken', progress)}
        </Typography>
      ) : null}
      {guide && !rules.guideMode ? (
        <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: 'success.main', borderRadius: 2 }}>
          <Typography variant="subtitle1">{t('rentalInspection.startFromLast', 'Start from last report')}</Typography>
          <Typography variant="body2">
            {t('rentalInspection.lastReturnSummary', 'Last return · {{date}} · {{photos}} photos · {{checks}} checks', {
              date,
              photos: guide.photoCount,
              checks: guide.checkCount,
            })}
          </Typography>
          <Typography>{note}</Typography>
          <Button variant="contained" color="success" disabled={busy} onClick={() => onChoose('guide')}>
            {t('rentalInspection.useAsGuide', 'Use as guide')}
          </Button>
          <Button variant="outlined" disabled={busy} onClick={() => onChoose('blank')}>
            {t('rentalInspection.startBlank', 'Start blank')}
          </Button>
        </Stack>
      ) : null}
      {blocked ? (
        <Alert severity="warning">
          <Typography variant="subtitle1">{t('rentalInspection.cantSendYet', "Can't send yet")}</Typography>
          <Typography>{t('rentalInspection.retakeOrSkip', 'Retake or skip the missing angles')}</Typography>
          <Typography variant="body2">
            {t('rentalInspection.missingAngles', '{{count}} angles from the {{date}} guide are still missing.', {
              count: groupBlockedRows(rows).open.length,
              date,
            })}
          </Typography>
          {groupBlockedRows(rows).open.map((row) => (
            <BlockedWebRow key={`${row.unitId}-${row.slotKey}`} row={row} onRetake={onRetake} onSkip={onSkip} />
          ))}
          {groupBlockedRows(rows).skipped.length ? (
            <Typography variant="subtitle2">{t('rentalInspection.skippedHeading', 'Skipped')}</Typography>
          ) : null}
          {groupBlockedRows(rows).skipped.map((row) => (
            <BlockedWebRow key={`${row.unitId}-${row.slotKey}-skipped`} row={row} onRetake={onRetake} onSkip={onSkip} />
          ))}
        </Alert>
      ) : null}
    </Stack>
  );
}
