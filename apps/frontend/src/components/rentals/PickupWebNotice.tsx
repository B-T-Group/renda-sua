import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PickupPhotoRules } from '../../utils/rentalInspection';
import type { BlockedGuideRow } from '../../utils/rentals/blockedGuideRows';
import { formatListingDay, formatListingStamp } from '../../utils/rentals/pickupPhotoTime';

function BlockedWebRow({
  row,
  onRetake,
  onSkip,
}: {
  row: BlockedGuideRow & { label: string };
  onRetake: (row: BlockedGuideRow) => void;
  onSkip: (row: BlockedGuideRow, reason: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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
        <Typography sx={{ flex: 1 }}>{row.label}</Typography>
        {row.action === 'retake' ? (
          <Button onClick={() => onRetake(row)}>{t('rentalInspection.retake', 'Retake')}</Button>
        ) : (
          <Button onClick={() => setOpen(true)}>{t('rentalInspection.skipAngle', 'Skip this angle')}</Button>
        )}
      </Stack>
      {open ? (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label={t('rentalInspection.skipReason', 'Reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button disabled={!reason.trim()} onClick={() => onSkip(row, reason.trim())}>
            {t('rentalInspection.skipSave', 'Save reason')}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

export function CameraLockArt({ label }: { label: string }) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={label}>
      <rect x="14" y="28" width="44" height="30" rx="6" fill="#DCF5E5" stroke="#0B7A3B" strokeWidth="2" />
      <circle cx="36" cy="43" r="6" fill="#0B7A3B" />
      <path d="M28 28v-6a8 8 0 0 1 16 0v6" fill="none" stroke="#0B7A3B" strokeWidth="2" />
    </svg>
  );
}

export function PickupWebNotice({
  rules,
  busy,
  blocked,
  rows,
  onChoose,
  onRetake,
  onSkip,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  blocked: boolean;
  rows: Array<BlockedGuideRow & { label: string }>;
  onChoose: (mode: 'guide' | 'blank') => void;
  onRetake: (row: BlockedGuideRow) => void;
  onSkip: (row: BlockedGuideRow, reason: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const guide = rules.guide;
  const date = guide ? formatListingDay(guide.submittedAt, rules.timezone, i18n.language) : '';
  const when = rules.startAt ? formatListingStamp(rules.startAt, rules.timezone, i18n.language) : '';
  return (
    <Stack spacing={1}>
      <CameraLockArt label={t('rentalInspection.webAppOnly', 'Take pickup photos in the Rendasua app')} />
      {!rules.pickupDay ? (
        <Alert severity="info">
          {t('rentalInspection.earlyPrepareBody', 'You can prepare the checklist now; photos are taken on pickup day.')}
          {when ? ` ${when}` : ''}
        </Alert>
      ) : (
        <Alert severity="info">{t('rentalInspection.webAppOnly', 'Take pickup photos in the Rendasua app')}</Alert>
      )}
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
          <Typography>
            {t('rentalInspection.guideOnlyNote', 'The last return photos are a guide only. You must retake every photo today, ideally with the renter there.')}
          </Typography>
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
          <Typography>{t('rentalInspection.retakeBeforeSending', 'Retake all photos before sending')}</Typography>
          <Typography variant="body2">
            {t('rentalInspection.missingAngles', '{{count}} angles from the {{date}} guide are still missing. Retake them, or skip an extra angle with a reason.', {
              count: rows.length,
              date,
            })}
          </Typography>
          {rows.map((row) => (
            <BlockedWebRow key={`${row.unitId}-${row.slotKey}`} row={row} onRetake={onRetake} onSkip={onSkip} />
          ))}
        </Alert>
      ) : null}
    </Stack>
  );
}
