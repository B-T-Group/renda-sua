import React from 'react';
import type { TFunction } from 'i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  tileLabel?: string;
  origin?: string;
  reused?: boolean;
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
  galleryLabel,
  onGallery,
}: {
  slots: SlotPhoto[];
  minPhotos: number | null;
  onAdd: (role: PhotoRole, index: number) => void;
  onRetry: (index: number) => void;
  galleryLabel?: string;
  onGallery?: (role: PhotoRole, index: number) => void;
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
        {slots.map((slot, index) => (
          <SlotTile
            key={slot.key}
            slot={slot}
            index={index}
            galleryLabel={galleryLabel}
            onAdd={onAdd}
            onRetry={onRetry}
            onGallery={onGallery}
          />
        ))}
      </View>
    </View>
  );
}

function SlotTile({
  slot,
  index,
  galleryLabel,
  onAdd,
  onRetry,
  onGallery,
}: {
  slot: SlotPhoto;
  index: number;
  galleryLabel?: string;
  onAdd: (role: PhotoRole, index: number) => void;
  onRetry: (index: number) => void;
  onGallery?: (role: PhotoRole, index: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius, typography } = useTheme();
  const label = slotLabel(slot, t);
  const ghost = !slot.uri && !!slot.ghostUri;
  const failed = t('rentalInspection.photoUploadFailed', 'Photo upload failed. Retry.');
  return (
    <View style={styles.tile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => (slot.failed ? onRetry(index) : onAdd(slot.role, index))}
        style={[styles.frame, frameColors(slot, colors, borderRadius.lg)]}
      >
        {slot.uri ? <Image source={{ uri: slot.uri }} style={styles.image} /> : null}
        {ghost ? <Image source={{ uri: slot.ghostUri }} style={styles.ghost} /> : null}
        <EmptyCamera show={!slot.uri && !ghost} color={colors.cta.main} />
        <CornerMark slot={slot} />
      </Pressable>
      <Text numberOfLines={1} style={[typography.caption, styles.role, { color: colors.text.primary }]}>
        {slot.failed ? failed : label}
      </Text>
      {slot.uri && (slot.origin || slot.stamp) ? <OriginDate origin={slot.origin} stamp={slot.stamp} /> : null}
      {ghost && slot.fromLabel ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{slot.fromLabel}</Text> : null}
      {onGallery && galleryLabel ? (
        <Pressable accessibilityRole="button" onPress={() => onGallery(slot.role, index)}>
          <Text style={[typography.caption, { color: colors.primary.main }]}>{galleryLabel}</Text>
        </Pressable>
      ) : null}
      {slot.pending ? <Text style={[typography.caption, { color: colors.warning.dark }]}>{t('rentalInspection.photosNotSynced', 'Photos not synced. Connect to submit.')}</Text> : null}
    </View>
  );
}

function slotLabel(slot: SlotPhoto, t: TFunction): string {
  if (slot.tileLabel) return slot.tileLabel;
  const extra = slot.slotKey?.startsWith('extra:') ? slot.slotKey.slice(6) : '';
  if (extra) return t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: extra });
  const [key, fallback] = ROLE_KEY[slot.role] ?? ROLE_KEY.wear;
  return t(key, fallback);
}

function frameColors(slot: SlotPhoto, colors: { cta: { main: string; light: string; soft: string }; surfaceElevated: string }, radius: number) {
  return {
    borderRadius: radius,
    borderColor: slot.uri ? colors.cta.main : colors.cta.light,
    backgroundColor: slot.uri ? colors.surfaceElevated : colors.cta.soft,
  };
}

function EmptyCamera({ show, color }: { show: boolean; color: string }) {
  if (!show) return null;
  return (
    <View pointerEvents="none" style={styles.camera}>
      <MaterialCommunityIcons name="camera-outline" size={28} color={color} />
    </View>
  );
}

function CornerMark({ slot }: { slot: SlotPhoto }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (slot.reused) {
    return (
      <View style={[styles.reused, { backgroundColor: colors.text.primary }]}>
        <Text style={styles.reusedText}>{t('rentalInspection.reusedBadge', 'Reused')}</Text>
      </View>
    );
  }
  if (!slot.uri) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.cta.main }]}>
      <Text style={styles.badgeText}>✓</Text>
    </View>
  );
}

function OriginDate({ origin, stamp }: { origin?: string; stamp?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.metaRow}>
      {origin ? (
        <Text numberOfLines={1} style={[typography.caption, styles.metaWord, { color: colors.text.secondary }]}>{origin}</Text>
      ) : null}
      {stamp ? (
        <Text style={[typography.caption, styles.metaDate, { color: colors.text.secondary }]}>{`${origin ? ' · ' : ''}${stamp}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '31%', alignItems: 'center' },
  frame: { width: '100%', height: 96, borderWidth: 1, overflow: 'hidden' },
  image: { ...StyleSheet.absoluteFillObject },
  ghost: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  camera: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reused: { position: 'absolute', top: 4, right: 4, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  reusedText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  role: { textAlign: 'center', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'center', maxWidth: '100%' },
  metaWord: { flexShrink: 1 },
  metaDate: { flexShrink: 0 },
});

export const inspectionTouch = { minHeight: TARGET };
