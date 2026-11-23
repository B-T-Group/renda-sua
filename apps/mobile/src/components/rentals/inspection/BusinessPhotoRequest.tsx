import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { submitInspection, uploadInspectionPhoto } from '../../../services/rentalInspectionApi';
import type { InspectionPhoto } from '../../../utils/rentals/rentalInspection';
import { formatPhotoStamp } from '../../../utils/rentals/rentalStartWindow';
import { filterSupportedImageAssets, IMAGE_LIBRARY_PICKER_OPTIONS } from '../../../utils/supportedImageFormats';

interface Props {
  bookingId: string;
  renterName: string;
  reason?: string | null;
  photos: Array<InspectionPhoto & { unitId: string }>;
  timeZone: string;
  onSent: () => void;
}

export function BusinessPhotoRequest(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <View style={[styles.banner, { backgroundColor: colors.warning.main + '22', borderRadius: borderRadius.md, padding: spacing.md }]}>
        <Text style={{ color: colors.text.primary }}>
          {t('rentals.business.photosAsked', '{{name}} asked for new photos before starting.', { name: props.renterName })}
        </Text>
        {props.reason ? <Text style={{ color: colors.text.primary, marginTop: 8 }}>{props.reason}</Text> : null}
      </View>
      <View style={styles.photos}>
        {props.photos.map((photo) => (
          <RetakeTile key={photo.id} photo={photo} bookingId={props.bookingId} timeZone={props.timeZone} onError={setError} />
        ))}
      </View>
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      <Button mode="contained" icon="send" buttonColor={colors.success.main} loading={busy} onPress={() => void send(props, setBusy, setError, t)}>
        {t('rentals.business.sendPhotos', 'Send updated photos')}
      </Button>
    </View>
  );
}

function RetakeTile({
  photo,
  bookingId,
  timeZone,
  onError,
}: {
  photo: InspectionPhoto & { unitId: string };
  bookingId: string;
  timeZone: string;
  onError: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const badge = photo.reused ? t('rentalInspection.reusedBadge', 'Reused') : t('rentalInspection.newBadge', 'New');
  const when = photo.capturedAt ? formatPhotoStamp(photo.capturedAt, timeZone, i18n.language) : '';
  return (
    <View style={styles.tile}>
      <View style={[styles.frame, { backgroundColor: colors.surfaceInput }]}>
        {photo.url ? <Image source={{ uri: photo.url }} style={styles.image} /> : null}
      </View>
      <Text style={{ textAlign: 'center', color: colors.text.secondary, fontSize: 11 }}>{`${badge}${when ? ` · ${when}` : ''}`}</Text>
      <View style={styles.tools}>
        <Pressable accessibilityRole="button" onPress={() => void pick(photo, bookingId, 'camera', onError)}>
          <MaterialCommunityIcons name="camera" size={22} color={colors.primary.main} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void pick(photo, bookingId, 'gallery', onError)}>
          <MaterialCommunityIcons name="image" size={22} color={colors.primary.main} />
        </Pressable>
      </View>
    </View>
  );
}

async function pick(
  photo: InspectionPhoto,
  bookingId: string,
  source: 'camera' | 'gallery',
  onError: (message: string) => void
) {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return;
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(IMAGE_LIBRARY_PICKER_OPTIONS)
    : await ImagePicker.launchImageLibraryAsync(IMAGE_LIBRARY_PICKER_OPTIONS);
  const asset = filterSupportedImageAssets(result.canceled ? [] : result.assets).supported[0];
  if (!asset) return;
  try {
    await uploadInspectionPhoto({
      bookingId,
      unitId: photo.unitId,
      role: (photo.role as 'overview') || 'overview',
      uri: asset.uri,
      contentType: (asset.mimeType || 'image/jpeg').replace('image/jpg', 'image/jpeg'),
      fileSize: asset.fileSize ?? 0,
      slotKey: photo.slotKey ?? photo.role,
      captureSource: source,
    });
  } catch (error: unknown) {
    onError(error instanceof Error ? error.message : 'Upload failed');
  }
}

async function send(
  props: Props,
  setBusy: (value: boolean) => void,
  setError: (value: string) => void,
  t: (key: string, fallback: string) => string
) {
  setBusy(true);
  setError('');
  try {
    await submitInspection(props.bookingId, 'pickup');
    props.onSent();
  } catch (error: unknown) {
    setError(error instanceof Error ? error.message : t('rentals.requestFailed', 'Request failed'));
  } finally {
    setBusy(false);
  }
}

const styles = StyleSheet.create({
  banner: {},
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%' },
  frame: { height: 96, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: 96 },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
});
