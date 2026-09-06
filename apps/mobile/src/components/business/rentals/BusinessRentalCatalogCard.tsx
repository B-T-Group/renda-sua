import React, { memo, useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { ImageLightbox } from '../../common/ImageLightbox';
import { StatusPill } from '../../common/StatusPill';
import { useTheme } from '../../../contexts/ThemeContext';
import { useImageFallback } from '../../../hooks/useImageFallback';
import type {
  BusinessRentalItemImageRow,
  BusinessRentalItemRow,
} from '../../../types/rentals';
import {
  aggregateListingModerationStatus,
  findFirstProposalPendingListingId,
  formatRentalMoney,
  rentalListingModerationColors,
} from '../../../utils/rentals';

function toNumber(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function orderedImages(
  images: BusinessRentalItemImageRow[] | undefined
): BusinessRentalItemImageRow[] {
  return [...(images ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
}

function modeLabel(
  mode: string | undefined,
  t: (k: string, d: string) => string
): string {
  if (mode === 'take_home') {
    return t('business.rentals.modes.takeHomeShort', 'Take-home');
  }
  return t('business.rentals.modes.operatedShort', 'Operated');
}

export interface BusinessRentalCatalogCardProps {
  item: BusinessRentalItemRow;
  onPress: (itemId: string) => void;
  onReviewProposal?: (listingId: string) => void;
}

function BusinessRentalCatalogCardInner({
  item,
  onPress,
  onReviewProposal,
}: BusinessRentalCatalogCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const gallery = useMemo(
    () => orderedImages(item.rental_item_images),
    [item.rental_item_images]
  );
  const coverUri = gallery[0]?.image_url;
  const image = useImageFallback(coverUri);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const listings = (item.rental_location_listings ?? []).filter(
    (l) => !l.deleted_at
  );
  const first = listings[0];
  const currency = item.currency || 'XAF';
  const mode = item.operation_mode ?? 'business_operated';
  const moderation = aggregateListingModerationStatus(listings);
  const modColors =
    moderation && moderation !== 'approved'
      ? rentalListingModerationColors(moderation, colors)
      : null;
  const hasMultiple = gallery.length > 1;
  const hourly = first
    ? formatRentalMoney(toNumber(first.base_price_per_hour), currency)
    : null;
  const daily = first
    ? formatRentalMoney(toNumber(first.base_price_per_day), currency)
    : null;

  const handleCardPress = useCallback(
    () => onPress(item.id),
    [item.id, onPress]
  );

  const pendingListingId = findFirstProposalPendingListingId(item);
  const hasPendingProposal = !!pendingListingId;

  const handleReviewPress = useCallback(() => {
    if (!pendingListingId || !onReviewProposal) return;
    onReviewProposal(pendingListingId);
  }, [onReviewProposal, pendingListingId]);

  const openLightbox = useCallback(
    (index: number) => {
      if (gallery.length === 0) return;
      setLightboxIdx(Math.min(Math.max(0, index), gallery.length - 1));
      setLightboxOpen(true);
    },
    [gallery.length]
  );

  return (
    <>
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: hasPendingProposal
              ? colors.info.main + '55'
              : colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
            borderWidth: hasPendingProposal ? 1.5 : 1,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (image.hasImage) openLightbox(0);
            else handleCardPress();
          }}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            image.hasImage
              ? t('business.rentals.catalog.openGallery', 'View photos')
              : item.name
          }
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
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
              <View style={styles.placeholder}>
                <MaterialCommunityIcons
                  name="image-off-outline"
                  size={32}
                  color={colors.text.disabled}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.disabled, marginTop: 4 },
                  ]}
                >
                  {t('business.rentals.catalog.noImage', 'No image')}
                </Text>
              </View>
            )}
            {hasMultiple ? (
              <View style={styles.photoBadge}>
                <MaterialCommunityIcons name="image-multiple" size={12} color="#fff" />
                <Text style={styles.photoBadgeText}>
                  {t('business.rentals.catalog.photosBadge', '{{count}} photos', {
                    count: gallery.length,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          onPress={handleCardPress}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={({ pressed }) => [
            styles.body,
            { padding: spacing.md, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Text
            style={[typography.subtitle1, { color: colors.text.primary }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <View style={styles.pills}>
            <StatusPill
              compact
              label={modeLabel(mode, t)}
              backgroundColor={
                mode === 'take_home'
                  ? colors.info.main + '22'
                  : colors.primaryTint
              }
              textColor={
                mode === 'take_home' ? colors.info.main : colors.primary.main
              }
            />
            {moderation === 'approved' || moderation === null ? (
              <StatusPill
                compact
                label={
                  item.is_active
                    ? t('business.rentals.catalog.active', 'Active')
                    : t('business.rentals.catalog.inactive', 'Inactive')
                }
                backgroundColor={
                  item.is_active ? colors.success.main + '22' : colors.divider
                }
                textColor={
                  item.is_active
                    ? colors.success.dark ?? colors.success.main
                    : colors.text.secondary
                }
              />
            ) : null}
            <ModerationPills
              moderation={moderation}
              modColors={modColors}
              t={t}
            />
            {hasPendingProposal && moderation !== 'proposal_pending' ? (
              <StatusPill
                compact
                label={t(
                  'business.rentals.moderation.proposalPending',
                  'AI suggestions ready'
                )}
                backgroundColor={colors.info.main + '22'}
                textColor={colors.info.dark ?? colors.info.main}
              />
            ) : null}
          </View>

          {hourly ? (
            <View style={[styles.priceRow, { marginTop: spacing.sm }]}>
              <Text
                style={[
                  typography.body1,
                  { color: colors.text.primary, fontWeight: '700' },
                ]}
              >
                {hourly}
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.secondary, fontWeight: '400' },
                  ]}
                >
                  {' '}
                  {t('business.rentals.catalog.perHour', 'per hour')}
                </Text>
              </Text>
              {daily ? (
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {daily} {t('business.rentals.catalog.perDay', '/ day')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginTop: spacing.xs },
            ]}
          >
            {t('business.rentals.catalog.listingsCount', '{{count}} listings', {
              count: listings.length,
            })}
          </Text>
        </Pressable>
        {hasPendingProposal && onReviewProposal && pendingListingId ? (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
            <Button mode="text" icon="creation" compact onPress={handleReviewPress}>
              {t('business.rentals.aiProposal.reviewCta', 'Review AI suggestions')}
            </Button>
          </View>
        ) : null}
      </View>

      <ImageLightbox
        visible={lightboxOpen}
        images={gallery}
        index={lightboxIdx}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIdx}
      />
    </>
  );
}

function ModerationPills({
  moderation,
  modColors,
  t,
}: {
  moderation: ReturnType<typeof aggregateListingModerationStatus>;
  modColors: { backgroundColor: string; textColor: string } | null;
  t: (k: string, d: string) => string;
}) {
  if (!modColors || !moderation || moderation === 'approved') return null;
  const label =
    moderation === 'rejected'
      ? t('business.rentals.moderation.rejected', 'Rejected')
      : moderation === 'proposal_pending'
        ? t('business.rentals.moderation.proposalPending', 'AI suggestions ready')
        : moderation === 'ai_reviewing'
          ? t('business.rentals.moderation.aiReviewing', 'AI reviewing')
          : moderation === 'draft'
            ? t('business.rentals.moderation.draft', 'Draft')
            : t('business.rentals.moderation.pending', 'Pending approval');
  return (
    <StatusPill
      compact
      label={label}
      backgroundColor={modColors.backgroundColor}
      textColor={modColors.textColor}
    />
  );
}

export const BusinessRentalCatalogCard = memo(BusinessRentalCatalogCardInner);

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  body: { minWidth: 0 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
});
