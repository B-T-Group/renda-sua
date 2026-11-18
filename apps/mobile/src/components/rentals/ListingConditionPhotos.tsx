import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { getConditionPhotos } from '../../services/rentalsApi';
import { declineDay } from './declinePickup.format';
import { ConditionPhotoStrip } from './DeclinePickupScreens';

type ListingPhoto = { slotKey: string; url: string; capturedAt: string };

export function ListingConditionPhotos({
  listingId,
  timeZone,
  photos: given,
}: {
  listingId: string;
  timeZone: string;
  photos?: ListingPhoto[];
}) {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const [loaded, setLoaded] = useState<ListingPhoto[]>([]);
  const provided = given != null;

  useEffect(() => {
    if (provided || !flags.rentals_pickup_decline_enabled || !listingId) return undefined;
    let stop = false;
    void getConditionPhotos(listingId).then((rows) => {
      if (!stop) setLoaded(rows);
    });
    return () => {
      stop = true;
    };
  }, [flags.rentals_pickup_decline_enabled, listingId, provided]);

  const photos = given ?? loaded;
  if (photos.length === 0) return null;
  const day = declineDay(photos[0].capturedAt, timeZone, i18n.language);
  return (
    <View style={{ marginTop: 8, gap: 4 }}>
      <Text variant="titleMedium">{t('pickupDecline.conditionPhotos', 'Condition photos')}</Text>
      <Text>{t('pickupDecline.takenByBusiness', 'Taken by the business · {{date}}', { date: day })}</Text>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} />
    </View>
  );
}
