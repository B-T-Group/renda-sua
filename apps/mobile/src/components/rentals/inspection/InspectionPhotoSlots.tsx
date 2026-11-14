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
  tileLabel?: string;
  offDay?: boolean;
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
  onGallery,
  onRetry,
}: {
  slots: SlotPhoto[];
  minPhotos: number | null;
  onAdd: (role: PhotoRole, index: number) => void;
  onGallery?: (role: PhotoRole, index: number) => void;
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
        {slots.map((slot, index) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            label={slotLabel(slot, t)}
            chooseSource={!!onGallery}
            onCamera={() => (slot.failed ? onRetry(index) : onAdd(slot.role, index))}
            onGallery={onGallery ? () => onGallery(slot.role, index) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

function slotLabel(slot: SlotPhoto, t: (key: string, fallback: string, options?: Record<string, string>) => string): string {
  if (slot.tileLabel) return slot.tileLabel;
  const extra = slot.slotKey?.startsWith('extra:') ? slot.slotKey.slice(6) : '';
  if (extra) return t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: extra });
  const [key, fallback] = ROLE_KEY[slot.role] ?? ROLE_KEY.wear;
  return t(key, fallback);
}

function SlotCard({
  slot,
  label,
  chooseSource,
  onCamera,
  onGallery,
}: {
  slot: SlotPhoto;
  label: string;
  chooseSource: boolean;
  onCamera: () => void;
  onGallery?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius, typography } = useTheme();
  const ghost = !slot.uri && !!slot.ghostUri;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={chooseSource ? undefined : onCamera}
        style={[styles.slot, tileColors(slot, colors, borderRadius.lg)]}
      >
        <SlotImage slot={slot} ghost={ghost} />
        <Text numberOfLines={1} style={[typography.caption, styles.tileName, { color: slot.uri ? '#fff' : colors.text.primary }]}>
          {slot.failed ? t('rentalInspection.photoUploadFailed', 'Photo upload failed. Retry.') : label}
        </Text>
        {slot.stamp && slot.uri ? <Text numberOfLines={1} style={[typography.caption, styles.tileStamp, { color: '#fff' }]}>{slot.stamp}</Text> : null}
        {ghost && slot.fromLabel ? <Text numberOfLines={1} style={[typography.caption, styles.tileStamp, { color: colors.text.secondary }]}>{slot.fromLabel}</Text> : null}
        {chooseSource && onGallery ? <SourceButtons onCamera={onCamera} onGallery={onGallery} /> : null}
      </Pressable>
      {slot.offDay ? <Text style={[typography.caption, { color: colors.warning.dark }]}>{t('rentalInspection.notPickupDay', 'Not taken on pickup day')}</Text> : null}
    </View>
  );
}

function tileColors(slot: SlotPhoto, colors: { cta: { main: string; light: string; soft: string }; surfaceElevated: string }, radius: number) {
  return {
    borderRadius: radius,
    borderColor: slot.uri ? colors.cta.main : colors.cta.light,
    backgroundColor: slot.uri ? colors.surfaceElevated : colors.cta.soft,
  };
}

function SlotImage({ slot, ghost }: { slot: SlotPhoto; ghost: boolean }) {
  const { colors } = useTheme();
  return (
    <>
      {slot.uri ? <Image source={{ uri: slot.uri }} style={styles.image} /> : null}
      {ghost ? <Image source={{ uri: slot.ghostUri }} style={styles.ghost} /> : null}
      {slot.uri ? (
        <View style={[styles.badge, { backgroundColor: colors.cta.main }]}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
        </View>
      ) : null}
    </>
  );
}

function SourceButtons({ onCamera, onGallery }: { onCamera: () => void; onGallery: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.sources}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('rentalInspection.cameraShort', 'Camera')} onPress={onCamera} style={[styles.sourceBtn, { backgroundColor: colors.cta.main }]}>
        <Text style={styles.sourceText}>{t('rentalInspection.cameraShort', 'Camera')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('rentalInspection.gallery', 'Gallery')} onPress={onGallery} style={[styles.sourceBtn, { backgroundColor: colors.cta.dark }]}>
        <Text style={styles.sourceText}>{t('rentalInspection.gallery', 'Gallery')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { width: '31%' },
  sources: { position: 'absolute', left: 4, right: 4, bottom: 4, flexDirection: 'row', gap: 4, zIndex: 2 },
  sourceBtn: { flex: 1, minHeight: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sourceText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  slot: {
    width: '100%',
    minHeight: 112,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  badge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tileName: { position: 'absolute', left: 4, right: 4, bottom: 16, textAlign: 'center' },
  tileStamp: { position: 'absolute', left: 2, right: 2, bottom: 2, textAlign: 'center' },
  ghost: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
});

export const inspectionTouch = { minHeight: TARGET };
