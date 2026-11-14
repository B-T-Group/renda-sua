import { Alert, Box, Stack, Typography } from '@mui/material';
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

function CameraArt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="#0B7A3B" strokeWidth="2" />
      <circle cx="12" cy="13" r="3" fill="none" stroke="#0B7A3B" strokeWidth="2" />
    </svg>
  );
}

function AngleGrid({ rows }: { rows: Array<BlockedGuideRow & { label: string; reason?: string | null }> }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 2 }}>
      {rows.map((row) => {
        const text = row.reason ? `${row.label} · ${row.reason}` : row.label;
        return (
          <Typography key={`${row.unitId}-${row.slotKey}`} noWrap variant="body2" title={text} sx={{ height: 32, lineHeight: '32px', gridColumn: row.reason ? '1 / -1' : undefined }}>
            {text}
          </Typography>
        );
      })}
    </Box>
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
  blocked,
  rows,
  progress,
}: {
  rules: PickupPhotoRules;
  blocked: boolean;
  rows: Array<BlockedGuideRow & { label: string; reason?: string | null }>;
  progress?: { done: number; total: number } | null;
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
      <DayStatus city={city} day={day} rules={rules} />
      {progress && rules.guideMode === 'guide' && !blocked ? (
        <Typography>{t('rentalInspection.retakenProgress', '{{done}} of {{total}} retaken', progress)}</Typography>
      ) : null}
      {guide && !rules.guideMode ? <GuideCard date={date} guide={guide} note={note} /> : null}
      {blocked ? <ReadOnlyGaps grouped={grouped} progress={progress} /> : null}
      <AppOnlyNote />
    </Stack>
  );
}

function DayStatus({ city, day, rules }: { city: string; day: string; rules: PickupPhotoRules }) {
  const { t } = useTranslation();
  if (!rules.pickupDay) {
    return (
      <Alert severity="info" icon={<CalendarArt />}>
        {t('rentalInspection.earlyPrepareBody', 'Photos are taken on pickup day, {{date}} ({{city}} time). You can prepare the checklist now.', { date: day, city })}
      </Alert>
    );
  }
  return rules.guideMode ? null : <TodayCard />;
}

function TodayCard() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(14, 116, 144, 0.08)' }}>
      <CameraArt />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        {t('rentalInspection.pickupTodayBody', 'Pickup today: take the condition photos, ideally with the renter.')}
      </Typography>
    </Stack>
  );
}

function GuideCard({
  date,
  guide,
  note,
}: {
  date: string;
  guide: NonNullable<PickupPhotoRules['guide']>;
  note: string;
}) {
  const thumb = guide.slots.find((slot) => slot.url)?.url;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        {thumb ? <Box component="img" src={thumb} alt="" sx={{ width: 64, height: 64, borderRadius: 1, objectFit: 'cover' }} /> : null}
        <GuideSummary date={date} guide={guide} />
      </Stack>
      <Alert severity="info">{note}</Alert>
    </Stack>
  );
}

function GuideSummary({ date, guide }: { date: string; guide: NonNullable<PickupPhotoRules['guide']> }) {
  const { t } = useTranslation();
  const summary = t('rentalInspection.lastReturnSummary', 'Last return · {{date}} · {{photos}} photos · {{checks}} checks', {
    date,
    photos: guide.photoCount,
    checks: guide.checkCount,
  });
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="subtitle1">{t('rentalInspection.startFromLast', 'Start from last report')}</Typography>
      <Typography variant="body2">{summary}</Typography>
    </Stack>
  );
}

function ReadOnlyGaps({
  grouped,
  progress,
}: {
  grouped: ReturnType<typeof groupBlockedRows<BlockedGuideRow & { label: string; reason?: string | null }>>;
  progress?: { done: number; total: number } | null;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={0.5}>
      <Typography variant="h6">{t('rentalInspection.pickupPhotosTitle', 'Pickup photos')}</Typography>
      {progress ? (
        <Typography variant="body2">{t('rentalInspection.retakenProgress', '{{done}} of {{total}} retaken', progress)}</Typography>
      ) : null}
      {grouped.open.length ? <Typography variant="subtitle2">{t('rentalInspection.missingHeading', 'Missing')}</Typography> : null}
      <AngleGrid rows={grouped.open} />
      {grouped.skipped.length ? <Typography variant="subtitle2">{t('rentalInspection.skippedHeading', 'Skipped')}</Typography> : null}
      <AngleGrid rows={grouped.skipped} />
    </Stack>
  );
}
