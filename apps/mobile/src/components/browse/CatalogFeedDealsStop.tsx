import React, { memo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogImageDisplayUrl } from '../../utils/catalogInventoryDisplay';
import { catalogFromPrice } from '../../utils/buildCartLineFromCatalog';

export interface CatalogFeedDealsStopProps {
  items: CatalogInventoryItem[];
  onItemPress?: (inventoryItemId: string) => void;
  onSeeAllDeals?: () => void;
}

const CARD_WIDTH = 140;
const CARD_IMAGE_HEIGHT = 120;

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'XAF',
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function dealPercent(item: CatalogInventoryItem): number {
  const hasDeal =
    item.hasActiveDeal &&
    typeof item.original_price === 'number' &&
    typeof item.discounted_price === 'number' &&
    item.original_price > item.discounted_price;
  if (!hasDeal || !item.original_price) return 0;
  const disc = item.discounted_price ?? 0;
  return Math.max(0, Math.round((1 - disc / item.original_price) * 100));
}

/**
 * "Deals near you" mid-feed stop.
 * Compact horizontal rail with one heading and see all.
 */
export const CatalogFeedDealsStop = memo(function CatalogFeedDealsStop({
  items,
  onItemPress,
  onSeeAllDeals,
}: CatalogFeedDealsStopProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const cardGap = spacing.sm;

  if (items.length === 0) return null;

  return (
    <View
      style={[
        styles.section,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <View style={[styles.headerRow, { paddingHorizontal: spacing.md, paddingTop: spacing.md }]}>
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.error.main + '15' }]}>
            <MaterialCommunityIcons
              name="tag-outline"
              size={18}
              color={colors.error.main}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="titleMedium"
              style={{ color: colors.text.primary, fontWeight: '800' }}
            >
              {t('catalog.deals.title', 'Deals near you')}
            </Text>
          </View>
        </View>
        {onSeeAllDeals ? (
          <Button mode="text" compact onPress={onSeeAllDeals} style={styles.seeAllBtn}>
            {t('catalog.deals.seeAll', 'See all')}
          </Button>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        style={Platform.OS === 'web' ? styles.listWeb : undefined}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: cardGap,
          },
        ]}
      >
        {items.map((item) => (
          <DealCard
            key={item.id}
            item={item}
            width={CARD_WIDTH}
            imageHeight={CARD_IMAGE_HEIGHT}
            borderRadius={borderRadius.md}
            onPress={() => onItemPress?.(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

interface DealCardProps {
  item: CatalogInventoryItem;
  width: number;
  imageHeight: number;
  borderRadius: number;
  onPress: () => void;
}

const DealCard = memo(function DealCard({
  item,
  width,
  imageHeight,
  borderRadius,
  onPress,
}: DealCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, shadows } = useTheme();

  const imageUrl = (() => {
    const imgs = item.item.item_images ?? [];
    const sorted = [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return catalogImageDisplayUrl(sorted[0]) ?? null;
  })();

  const image = useImageFallback(imageUrl);
  const price = catalogFromPrice(item);
  const currency = item.item.currency || 'XAF';
  const priceLabel = formatMoney(price, currency);
  const discountPct = dealPercent(item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.item.name}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            width,
            borderRadius,
            borderColor: colors.divider,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View
          style={[
            styles.imageContainer,
            { height: imageHeight, borderRadius, backgroundColor: colors.pageBackground },
          ]}
        >
          {image.hasImage && image.sourceUri ? (
            <Image
              source={{ uri: image.sourceUri }}
              style={styles.image}
              resizeMode="cover"
              onError={image.onImageError}
            />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={[typography.caption, { color: colors.text.disabled }]}>
                {t('public.items.noImage', 'Photo')}
              </Text>
            </View>
          )}
          {discountPct > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.error.main }]}>
              <Text style={[typography.caption, { color: '#fff', fontWeight: '800' }]}>
                {t('public.items.card.savePercent', '-{{pct}}%', { pct: discountPct })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: spacing.xs }}>
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: colors.text.primary, height: 32 }}
          >
            {item.item.name}
          </Text>
          <Text
            variant="labelMedium"
            style={{ color: colors.primary.main, fontWeight: '700', marginTop: 4 }}
          >
            {priceLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllBtn: {
    marginTop: -4,
    marginRight: -8,
  },
  listWeb: Platform.select({
    web: { overflow: 'scroll' as const },
    default: {},
  }),
  listContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '90%',
  },
});
