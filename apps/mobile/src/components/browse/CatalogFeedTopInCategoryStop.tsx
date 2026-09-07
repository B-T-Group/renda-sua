import React, { memo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogImageDisplayUrl } from '../../utils/catalogInventoryDisplay';
import { catalogFromPrice } from '../../utils/buildCartLineFromCatalog';

export interface CatalogFeedTopInCategoryStopProps {
  items: CatalogInventoryItem[];
  category: string;
  onItemPress?: (inventoryItemId: string) => void;
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

/**
 * "Top in {category}" mid-feed stop.
 * Shows popular items in the current category filter.
 */
export const CatalogFeedTopInCategoryStop = memo(function CatalogFeedTopInCategoryStop({
  items,
  category,
  onItemPress,
}: CatalogFeedTopInCategoryStopProps) {
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
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary.main + '15' }]}>
            <MaterialCommunityIcons
              name="star-outline"
              size={18}
              color={colors.secondary.main}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="titleMedium"
              style={{ color: colors.text.primary, fontWeight: '800' }}
            >
              {t('catalog.topInCategory.title', 'Top in {{category}}', { category })}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: 2 }}
            >
              {t('catalog.topInCategory.subtitle', 'Popular choices')}
            </Text>
          </View>
        </View>
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
          <ItemCard
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

interface ItemCardProps {
  item: CatalogInventoryItem;
  width: number;
  imageHeight: number;
  borderRadius: number;
  onPress: () => void;
}

const ItemCard = memo(function ItemCard({
  item,
  width,
  imageHeight,
  borderRadius,
  onPress,
}: ItemCardProps) {
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
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
