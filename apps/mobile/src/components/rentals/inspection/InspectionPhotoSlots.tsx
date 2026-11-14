import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PhotoRole } from '../../../utils/rentals/rentalInspection';

const TARGET = 48;

export interface SlotPhoto {
  key: string;
  role: PhotoRole;
  slotKey?: string;
  uri?: string;
  ghostUri?: string;
  stamp?: string;
  fromLabel?: string;
  failed?: boolean;
  pending?: boolean;
}

const ROLE_KEY: Record<PhotoRole, [string, string]> = {
  overview: ['rentalInspection.overview', 'Overview'],
  other_side: ['rentalInspection.otherSide', 'Other side'],
  accessories: ['rentalInspection.accessories', 'Accessories'],
  wear: ['rentalInspection.wearCloseup', 'Close-up'],
  counter: ['rentalInspection.counterPhotos', 'Counter-photo'],
};

export function InspectionPhotoSlots({
  slots,
  minPhotos,
  onAdd,
  onRetry,
}: {
  slots: SlotPhoto[];
  minPhotos: number | null;
  onAdd: (role: PhotoRole, index: number) => void;
  onRetry: (index: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <View>
      <View style={[styles.titleRow, { marginBottom: spacing.sm }]}>
        <Text style={[typography.subtitle2, { color: colors.text.secondary }]}>
          {t('rentalInspection.photosTitle', 'PHOTOS')}
        </Text>
        {minPhotos != null ? (
          <View style={[styles.pill, { borderColor: colors.warning.main, borderRadius: borderRadius.lg }]}>
            <Text style={[typography.caption, { color: colors.warning.dark }]}>
              {t('rentalInspection.minPhotos', 'Min {{count}}', { count: minPhotos })}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {slots.map((slot, index) => {
          const [key, fallback] = ROLE_KEY[slot.role] ?? ROLE_KEY.wear;
          const extra = slot.slotKey?.startsWith('extra:') ? slot.slotKey.slice(6) : '';
          const label = extra
            ? t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: extra })
            : t(key, fallback);
          const ghost = !slot.uri && !!slot.ghostUri;
          return (
            <Pressable
              key={slot.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => (slot.failed ? onRetry(index) : onAdd(slot.role, index))}
              style={[
                styles.slot,
                {
                  borderRadius: borderRadius.lg,
                  borderColor: slot.uri ? colors.cta.main : colors.cta.light,
                  backgroundColor: slot.uri ? colors.surfaceElevated : colors.cta.soft,
                },
              ]}
            >
              {slot.uri ? <Image source={{ uri: slot.uri }} style={styles.image} /> : null}
              {ghost ? <Image source={{ uri: slot.ghostUri }} style={styles.ghost} /> : null}
              <Text style={[typography.caption, { color: slot.uri ? '#fff' : colors.text.primary, textAlign: 'center' }]}>
                {slot.failed
                  ? t('rentalInspection.photoUploadFailed', 'Photo upload failed. Retry.')
                  : slot.uri
                    ? `${label} ✓`
                    : ghost && slot.fromLabel
                      ? `${label} · ${slot.fromLabel}`
                      : label}
              </Text>
              {slot.stamp && slot.uri ? (
                <Text style={[typography.caption, { color: '#fff' }]}>{slot.stamp}</Text>
              ) : null}
              {slot.pending ? (
                <Text style={[typography.caption, { color: colors.warning.dark }]}>
                  {t('rentalInspection.photosNotSynced', 'Photos not synced. Connect to submit.')}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: {
    width: '31%',
    minHeight: 112,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  ghost: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
});

export const inspectionTouch = { minHeight: TARGET };
