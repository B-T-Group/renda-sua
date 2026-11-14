import { Alert, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PickupPhotoRules } from '../../utils/rentalInspection';
import { formatListingDay, formatListingStamp } from '../../utils/rentals/pickupPhotoTime';

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
  missing,
  onChoose,
  onRetake,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  blocked: boolean;
  missing: string[];
  onChoose: (mode: 'guide' | 'blank') => void;
  onRetake: () => void;
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
              count: missing.length,
              date,
            })}
          </Typography>
          {missing.map((label) => <Typography key={label}>{label}</Typography>)}
          <Button onClick={onRetake}>{t('rentalInspection.retakeMissing', 'Retake missing photos')}</Button>
        </Alert>
      ) : null}
    </Stack>
  );
}
