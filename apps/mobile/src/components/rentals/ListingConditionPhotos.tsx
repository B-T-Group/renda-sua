import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { getConditionPhotos } from '../../services/rentalsApi';
import { ConditionPhotoStrip } from './DeclinePickupScreens';

export function ListingConditionPhotos({ listingId, timeZone }: { listingId: string; timeZone: string }) {
  const { flags } = useClientFlags();
  const [photos, setPhotos] = useState<Array<{ slotKey: string; url: string; capturedAt: string }>>([]);

  useEffect(() => {
    if (!flags.rentals_pickup_decline_enabled || !listingId) return undefined;
    let stop = false;
    void getConditionPhotos(listingId).then((rows) => {
      if (!stop) setPhotos(rows);
    });
    return () => {
      stop = true;
    };
  }, [flags.rentals_pickup_decline_enabled, listingId]);

  if (photos.length === 0) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} />
    </View>
  );
}
