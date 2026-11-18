import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useRentalApi } from '../../hooks/useRentalApi';
import { useClientFlags } from '../../hooks/useClientFlags';
import { ConditionPhotoLightbox, ConditionPhotoStrip } from './DeclinePickupScreens';

export const ListingConditionPhotos: React.FC<{ listingId: string; timeZone: string }> = ({ listingId, timeZone }) => {
  const { flags } = useClientFlags();
  const { fetchConditionPhotos } = useRentalApi();
  const [photos, setPhotos] = useState<Array<{ slotKey: string; url: string; capturedAt: string }>>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!flags.rentals_pickup_decline_enabled || !listingId) return undefined;
    let stop = false;
    setLoading(true);
    void fetchConditionPhotos(listingId)
      .then((data) => {
        if (stop) return;
        setPhotos((data.photos ?? []).map((photo) => ({ ...photo, capturedAt: photo.capturedAt ?? '' })));
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
    return () => {
      stop = true;
    };
  }, [fetchConditionPhotos, flags.rentals_pickup_decline_enabled, listingId]);

  if (!flags.rentals_pickup_decline_enabled || (!loading && photos.length === 0)) return null;
  if (loading) return <CircularProgress size={18} />;
  return (
    <Box sx={{ mt: 2 }}>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} onOpen={setOpen} />
      <ConditionPhotoLightbox photos={photos} timeZone={timeZone} index={open} onClose={() => setOpen(null)} />
    </Box>
  );
};
