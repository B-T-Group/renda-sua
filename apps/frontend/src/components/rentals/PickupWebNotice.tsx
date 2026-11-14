import { Alert, Stack, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PickupPhotoRules } from '../../utils/rentalInspection';
import { groupBlockedRows, type BlockedGuideRow } from '../../utils/rentals/blockedGuideRows';
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

function PlainAngle({ row }: { row: BlockedGuideRow & { label: string; reason?: string | null } }) {
  return (
    <Stack sx={{ py: 0.5 }}>
      <Typography>{row.label}</Typography>
      {row.reason ? <Typography variant="body2" color="text.secondary">{row.reason}</Typography> : null}
    </Stack>
  );
}

function AppOnlyNote() {
  const { t } = useTranslation();
  return (
    <Alert severity="info" icon={<PhoneArt />}>
      {t('rentalInspection.webAppOnly', 'Take pickup photos in the Rendasua app')}
    </Alert>
  );
}

export function PickupWebNotice({
  rules,
  busy,
  blocked,
  rows,
  progress,
  onChoose,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  blocked: boolean;
  rows: Array<BlockedGuideRow & { label: string; reason?: string | null }>;
  progress?: { done: number; total: number } | null;
  onChoose: (mode: 'guide' | 'blank') => void;
}) {
  const { t, i18n } = useTranslation();
  const guide = rules.guide;
  const date = guide ? formatListingDay(guide.submittedAt, rules.timezone, i18n.language) : '';
  const day = rules.startAt ? formatListingDay(rules.startAt, rules.timezone, i18n.language) : '';
  const city = listingCity(rules.timezone);
  const grouped = groupBlockedRows(rows);
  const note = rules.pickupDay
    ? t('rentalInspection.guideOnlyShort', 'The last return photos are a guide only.')
    : t('rentalInspection.guideOnlyNoteLater', 'The last return photos are a guide only. You must retake every photo on pickup day, ideally with the renter there.');
  return (
    <Stack spacing={1}>
      {!rules.pickupDay ? (
        <Alert severity="info" icon={<CalendarArt />}>
          {t('rentalInspection.earlyPrepareBody', 'Photos are taken on pickup day, {{date}} ({{city}} time). You can prepare the checklist now.', { date: day, city })}
        </Alert>
      ) : !rules.guideMode ? (
        <Typography>
          {t('rentalInspection.pickupTodayBody', 'Pickup today: take the condition photos, ideally with the renter.')}
        </Typography>
      ) : null}
      {progress && rules.guideMode === 'guide' ? (
        <Typography>{t('rentalInspection.retakenProgress', '{{done}} of {{total}} retaken', progress)}</Typography>
      ) : null}
      {guide && !rules.guideMode ? <GuideChoice busy={busy} date={date} guide={guide} note={note} onChoose={onChoose} /> : null}
      {blocked ? <ReadOnlyGaps date={date} grouped={grouped} /> : null}
      <AppOnlyNote />
    </Stack>
  );
}

function GuideChoice({
  busy,
  date,
  guide,
  note,
  onChoose,
}: {
  busy: boolean;
  date: string;
  guide: NonNullable<PickupPhotoRules['guide']>;
  note: string;
  onChoose: (mode: 'guide' | 'blank') => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
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
  );
}

function ReadOnlyGaps({
  date,
  grouped,
}: {
  date: string;
  grouped: ReturnType<typeof groupBlockedRows<BlockedGuideRow & { label: string; reason?: string | null }>>;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle1">{t('rentalInspection.cantSendYet', "Can't send yet")}</Typography>
      <Typography variant="body2">
        {t('rentalInspection.missingAngles', '{{count}} angles from the {{date}} guide are still missing.', {
          count: grouped.open.length,
          date,
        })}
      </Typography>
      {grouped.open.map((row) => (
        <PlainAngle key={`${row.unitId}-${row.slotKey}`} row={row} />
      ))}
      {grouped.skipped.length ? (
        <Typography variant="subtitle2">{t('rentalInspection.skippedHeading', 'Skipped')}</Typography>
      ) : null}
      {grouped.skipped.map((row) => (
        <PlainAngle key={`${row.unitId}-${row.slotKey}-skipped`} row={row} />
      ))}
    </Stack>
  );
}
