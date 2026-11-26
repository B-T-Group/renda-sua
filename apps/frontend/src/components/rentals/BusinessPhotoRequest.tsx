import { OutlinedFlag, PhotoCamera, Send, Upload } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { createRentalInspectionApi } from '../../services/rentalInspectionApi';
import type { InspectionPhoto } from '../../utils/rentalInspection';
import { splitCorrectionReason } from '../../utils/rentalInspection';
import { formatListingStamp, listingCity, slotTileLabel } from '../../utils/rentals/pickupPhotoTime';
import { formatPhotoStamp } from '../../utils/rentalStartWindow';
import { elidesBefore } from '../../utils/rentals/frenchElision';

interface Props {
  bookingId: string;
  renterName: string;
  reason?: string | null;
  photos: Array<InspectionPhoto & { unitId: string }>;
  timeZone?: string;
  askedAt?: string | null;
  /** Start day with weekday (listing clock), e.g. "Sat 28 Nov": an unresolved flag cancels the booking at 23:59. */
  fixDay?: string;
  /** Formatted reservation fee, when the booking has one. */
  fee?: string;
  onSent: () => void;
}

export function BusinessPhotoRequest(props: Props) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const zone = props.timeZone || 'America/Toronto';
  const parts = splitCorrectionReason(props.reason, reasonLabels(t));
  const que = elidesBefore(props.renterName) ? 'qu’' : 'que ';
  const asked = props.askedAt ? formatListingStamp(props.askedAt, zone, i18n.language) : '';
  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: 1, borderColor: 'warning.main', bgcolor: (theme) => alpha(theme.palette.warning.main, 0.16), color: 'text.primary' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} data-testid="check-flagged">
        <OutlinedFlag sx={{ color: 'warning.dark' }} />
        <Typography variant="h6" fontWeight={800}>{t('rentals.business.checkFlagged', 'Check flagged')}</Typography>
      </Stack>
      {props.fixDay ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} data-testid="check-flagged-deadline">
          {props.fee
            ? t('rentals.business.fixByFee', 'Fix it by 23:59 today ({{day}}), or the booking is cancelled and {{name}} gets the {{fee}} fee back. Nothing can be paid or handed over until {{name}} accepts.', { day: props.fixDay, name: props.renterName, fee: props.fee, que })
            : t('rentals.business.fixBy', 'Fix it by 23:59 today ({{day}}), or the booking is cancelled. Nothing can be paid or handed over until {{name}} accepts.', { day: props.fixDay, name: props.renterName, que })}
        </Typography>
      ) : null}
      <Typography>
        {t('rentals.business.photosAsked', '{{name}} asked for new photos before starting.', { name: props.renterName })}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
        {parts.chips.map((chip) => (
          <Typography key={chip} variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 999, border: 1, borderColor: 'warning.main' }}>{chip}</Typography>
        ))}
      </Stack>
      {parts.note ? <Typography sx={{ mt: 1 }}>{parts.note}</Typography> : null}
      {asked ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('rentals.business.askedAt', 'Asked {{when}} ({{zone}} time)', { when: asked, zone: listingCity(zone) })}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
        {props.photos.map((photo) => (
          <PhotoUpload key={photo.id} photo={photo} bookingId={props.bookingId} onError={setError} language={i18n.language} timeZone={zone} />
        ))}
      </Stack>
      {error ? <Typography color="error">{error}</Typography> : null}
      <Button
        variant="contained"
        color="primary"
        startIcon={<Send />}
        disabled={busy}
        sx={{ mt: 2 }}
        onClick={() => void sendUpdated(api, props, setBusy, setError, t)}
      >
        {t('rentals.business.sendPhotos', 'Send updated photos')}
      </Button>
    </Box>
  );
}

function PhotoUpload({
  photo,
  bookingId,
  onError,
  language,
  timeZone,
}: {
  photo: InspectionPhoto & { unitId: string };
  bookingId: string;
  onError: (message: string) => void;
  language: string;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const camera = `camera-${photo.id}`;
  const library = `library-${photo.id}`;
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ width: 148 }}>
      {photo.url ? <Box component="img" src={photo.url} alt={slotTileLabel(photo.role, language)} sx={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 1 }} /> : null}
      <Typography variant="caption" align="center">{slotTileLabel(photo.role, language)}</Typography>
      <Typography variant="caption" color="text.secondary" align="center" sx={{ whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.3 }}>
        {photoBadge(photo, language, timeZone, t)}
      </Typography>
      <Stack direction="row">
        <Button component="label" size="small" aria-label={camera}>
          <PhotoCamera fontSize="small" />
          <input hidden type="file" accept="image/*" capture="environment" onChange={(event) => void uploadFile(api, bookingId, photo, event, onError)} />
        </Button>
        <Button component="label" size="small" aria-label={library}>
          <Upload fontSize="small" />
          <input hidden type="file" accept="image/*" onChange={(event) => void uploadFile(api, bookingId, photo, event, onError)} />
        </Button>
      </Stack>
    </Stack>
  );
}

function photoBadge(
  photo: InspectionPhoto,
  language: string,
  timeZone: string,
  t: (key: string, fallback: string) => string
): string {
  const fresh = photo.reused
    ? t('rentalInspection.reusedBadge', 'Reused')
    : t('rentalInspection.newBadge', 'New');
  if (!photo.capturedAt) return fresh;
  return `${fresh} · ${formatPhotoStamp(photo.capturedAt, timeZone, language)}`;
}

function reasonLabels(t: (key: string, fallback: string) => string): Record<string, string> {
  return {
    wear_hidden: t('rentalInspection.reasonWearHidden', 'Wear not shown'),
    photo_mismatch: t('rentalInspection.reasonPhotoMismatch', "Photo doesn't match"),
  };
}

async function uploadFile(
  api: ReturnType<typeof useApiClient>,
  bookingId: string,
  photo: InspectionPhoto & { unitId: string },
  event: React.ChangeEvent<HTMLInputElement>,
  onError: (message: string) => void
) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await createRentalInspectionApi(api).upload({
      bookingId,
      unitId: photo.unitId,
      role: (photo.role as 'overview') || 'overview',
      file,
      captureSource: 'web',
    });
  } catch (error: unknown) {
    onError(error instanceof Error ? error.message : 'Upload failed');
  }
}

async function sendUpdated(
  api: ReturnType<typeof useApiClient>,
  props: Props,
  setBusy: (value: boolean) => void,
  setError: (value: string) => void,
  t: (key: string, fallback: string) => string
) {
  setBusy(true);
  setError('');
  try {
    await createRentalInspectionApi(api).submit(props.bookingId, 'pickup');
    props.onSent();
  } catch (error: unknown) {
    setError(error instanceof Error ? error.message : t('rentals.requestFailed', 'Request failed'));
  } finally {
    setBusy(false);
  }
}
