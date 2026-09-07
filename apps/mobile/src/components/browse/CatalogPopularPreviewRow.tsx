import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import {
  catalogFromPrice,
  shopperVariantOptionCount,
} from '../../utils/buildCartLineFromCatalog';
import { catalogOrderedImages } from '../../utils/catalogInventoryDisplay';

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

export interface CatalogPopularPreviewRowProps {
  items: CatalogInventoryItem[];
  loading?: boolean;
  onItemPress?: (inventoryItemId: string) => void;
}

const PreviewTile = memo(function PreviewTile({
  item,
  onPress,
}: {
  item: CatalogInventoryItem;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const imgs = catalogOrderedImages(item);
  const uri = imgs[0]?.image_url;
  const image = useImageFallback(uri);
  const currency = item.item.currency || 'XAF';
  const hasVariants = shopperVariantOptionCount(item) > 1;
  const price = catalogFromPrice(item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('public.items.popularPreview.tileA11y', 'Open {{name}}', {
        name: item.item.name,
      })}
      style={({ pressed }) => [
        styles.tile,
        shadows.sm,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {image.hasImage && image.sourceUri ? (
        <Image
          source={{ uri: image.sourceUri }}
          style={[styles.image, { borderRadius: borderRadius.sm }]}
          resizeMode="cover"
          onError={image.onImageError}
        />
      ) : (
        <View
          style={[
            styles.image,
            styles.placeholder,
            { borderRadius: borderRadius.sm, backgroundColor: colors.pageBackground },
          ]}
        >
          <Text style={[typography.caption, { color: colors.text.disabled }]}>
            {t('public.items.noImage', 'Photo')}
          </Text>
        </View>
      )}
      <Text
        style={[typography.caption, { color: colors.text.primary, marginTop: spacing.xs, fontWeight: '600' }]}
        numberOfLines={2}
      >
        {item.item.name}
      </Text>
      <Text style={[typography.caption, { color: colors.primary.main, marginTop: 2, fontWeight: '700' }]}>
        {hasVariants
          ? t('public.items.card.fromPrice', 'From {{price}}', {
              price: formatMoney(price, currency),
            })
          : formatMoney(price, currency)}
      </Text>
    </Pressable>
  );
});

const PreviewTileSkeleton = memo(function PreviewTileSkeleton() {
  const { colors, borderRadius } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bone = { backgroundColor: colors.divider, opacity: pulse };

  return (
    <View
      style={[
        styles.tile,
        { borderRadius: borderRadius.md, borderColor: colors.divider },
      ]}
    >
      <Animated.View style={[styles.image, bone, { borderRadius: borderRadius.sm }]} />
      <Animated.View style={[styles.skeletonLineLg, bone, { borderRadius: 4 }]} />
      <Animated.View style={[styles.skeletonLineSm, bone, { borderRadius: 4 }]} />
    </View>
  );
});

export const CatalogPopularPreviewRow = memo(function CatalogPopularPreviewRow({
  items,
  loading = false,
  onItemPress,
}: CatalogPopularPreviewRowProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const preview = items.slice(0, 6);

  const handlePress = useCallback(
    (id: string) => {
      onItemPress?.(id);
    },
    [onItemPress]
  );

  if (!loading && preview.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: spacing.sm }]}>
        {t('public.items.popularPreview.title', 'Available near you')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xs }}
      >
        {loading && preview.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <PreviewTileSkeleton key={`sk-${i}`} />)
          : preview.map((item) => (
              <PreviewTile
                key={item.id}
                item={item}
                onPress={() => handlePress(item.id)}
              />
            ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    width: 132,
    borderWidth: 1,
    padding: 8,
  },
  image: {
    width: '100%',
    height: 96,
  },
  skeletonLineLg: {
    height: 12,
    width: '80%',
    marginTop: 8,
  },
  skeletonLineSm: {
    height: 12,
    width: '45%',
    marginTop: 6,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
