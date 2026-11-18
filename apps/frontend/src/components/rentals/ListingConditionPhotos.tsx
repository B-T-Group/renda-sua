import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useRentalApi } from '../../hooks/useRentalApi';
import { useClientFlags } from '../../hooks/useClientFlags';
import { declineDay } from './declinePickup.format';
import { ConditionPhotoLightbox, ConditionPhotoStrip } from './DeclinePickupScreens';

type ListingPhoto = { slotKey: string; url: string; capturedAt: string };

export const ListingConditionPhotos: React.FC<{
  listingId: string;
  timeZone: string;
  photos?: ListingPhoto[];
}> = ({ listingId, timeZone, photos: given }) => {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const { fetchConditionPhotos } = useRentalApi();
  const [loaded, setLoaded] = useState<ListingPhoto[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const provided = given != null;

  useEffect(() => {
    if (provided || !flags.rentals_pickup_decline_enabled || !listingId) return undefined;
    let stop = false;
    setLoading(true);
    void fetchConditionPhotos(listingId)
      .then((data) => {
        if (stop) return;
        setLoaded((data.photos ?? []).map((photo) => ({ ...photo, capturedAt: photo.capturedAt ?? '' })));
      })
      .catch(() => setLoaded([]))
      .finally(() => setLoading(false));
    return () => {
      stop = true;
    };
  }, [fetchConditionPhotos, flags.rentals_pickup_decline_enabled, listingId, provided]);

  const photos = given ?? loaded;
  if (!provided && (!flags.rentals_pickup_decline_enabled || (!loading && photos.length === 0))) return null;
  if (!provided && loading) return <CircularProgress size={18} />;
  if (photos.length === 0) return null;
  const day = declineDay(photos[0].capturedAt, timeZone, i18n.language);
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6">{t('pickupDecline.conditionPhotos', "Condition photos")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('pickupDecline.takenByBusiness', 'Taken by the business · {{date}}', { date: day })}
      </Typography>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} onOpen={setOpen} />
      <ConditionPhotoLightbox photos={photos} timeZone={timeZone} index={open} onClose={() => setOpen(null)} />
    </Box>
  );
};
