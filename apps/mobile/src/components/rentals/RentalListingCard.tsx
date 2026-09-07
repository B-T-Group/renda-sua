import { memo, useCallback } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { RentalListingRow } from '../../types/rentals';
import { formatRentalMoney } from '../../utils/rentals';

function toNumber(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export interface RentalListingCardProps {
  listing: RentalListingRow;
  onPress: (listingId: string) => void;
}

function RentalListingCardInner({ listing, onPress }: RentalListingCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const item = listing.rental_item;
  const firstImage = item.rental_item_images?.[0];
  const imageUri = firstImage?.display_url ?? firstImage?.image_url;
  const image = useImageFallback(imageUri);
  const currency = item.currency || 'XAF';
  const hourly = formatRentalMoney(toNumber(listing.base_price_per_hour), currency);
  const daily = formatRentalMoney(toNumber(listing.base_price_per_day), currency);
  const distance =
    listing.distance_text && listing.duration_text
      ? t('rentals.routeFromYou', '{{distance}} • {{duration}} from you', {
          distance: listing.distance_text,
          duration: listing.duration_text,
        })
      : listing.distance_text || null;

  const handlePress = useCallback(() => onPress(listing.id), [listing.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
          },
        ]}
      >
        <View style={[styles.imageWrap, { backgroundColor: colors.disabled }]}>
          {image.hasImage ? (
            <Image
              source={{ uri: image.sourceUri }}
              style={styles.image}
              resizeMode="cover"
              onError={image.onImageError}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.text.disabled} />
              <Text style={[typography.caption, { color: colors.text.disabled, marginTop: 4 }]}>
                {t('rentals.noImage', 'No image')}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.body, { padding: spacing.md }]}>
          <Text style={[typography.subtitle1, { color: colors.text.primary }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={{ marginTop: 6 }}>
            <StatusPill
              compact
              label={
                item.operation_mode === 'take_home'
                  ? t('rentals.modes.takeHomeShort', 'Take-home')
                  : t('rentals.modes.operatedShort', 'Operated')
              }
              backgroundColor={
                item.operation_mode === 'take_home'
                  ? colors.info.main + '22'
                  : colors.primaryTint
              }
              textColor={
                item.operation_mode === 'take_home'
                  ? colors.info.main
                  : colors.primary.main
              }
            />
          </View>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]} numberOfLines={1}>
            {item.rental_category?.name ?? t('rentals.category', 'Category')}
            {item.business?.name ? ` · ${item.business.name}` : ''}
          </Text>
          <View style={[styles.priceRow, { marginTop: spacing.sm }]}>
            <Text style={[typography.body2, { color: colors.text.primary, fontWeight: '700' }]}>
              {hourly}
              <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '400' }]}>
                {' '}
                {t('client.rentals.perHour', 'per hour')}
              </Text>
            </Text>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {daily} {t('rentals.perDay', '/ day')}
            </Text>
          </View>
          {distance ? (
            <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.text.secondary} />
              <Text
                style={[typography.caption, { color: colors.text.secondary, marginLeft: 4, flex: 1 }]}
                numberOfLines={1}
              >
                {distance}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const RentalListingCard = memo(RentalListingCardInner);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
});
