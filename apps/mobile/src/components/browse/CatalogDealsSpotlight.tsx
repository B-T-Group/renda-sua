import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogFromPrice } from '../../utils/buildCartLineFromCatalog';
import { catalogOrderedImages } from '../../utils/catalogInventoryDisplay';

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

export interface CatalogDealsSpotlightProps {
  items: CatalogInventoryItem[];
  loading: boolean;
  onItemPress?: (inventoryItemId: string) => void;
  /** Applies deals sort on the main catalog (same as filter sheet “Deals”). */
  onSeeAllDeals?: () => void;
}

const SLOT_COUNT = 4;

function buildSlots(
  items: CatalogInventoryItem[],
  loading: boolean
): Array<{ key: string; item: CatalogInventoryItem | null }> {
  if (loading && items.length === 0) {
    return Array.from({ length: SLOT_COUNT }, (_, i) => ({ key: `sk-${i}`, item: null }));
  }
  const out: Array<{ key: string; item: CatalogInventoryItem | null }> = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const item = items[i] ?? null;
    out.push({ key: item?.id ?? `empty-${i}`, item });
  }
  return out;
}

export const CatalogDealsSpotlight = memo(function CatalogDealsSpotlight({
  items,
  loading,
  onItemPress,
  onSeeAllDeals,
}: CatalogDealsSpotlightProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const gap = spacing.sm;
  const tileBorder = colors.border;

  const slots = useMemo(() => buildSlots(items, loading), [items, loading]);

  if (!loading && items.length === 0) return null;

  const row = (left: (typeof slots)[0], right: (typeof slots)[0]) => (
    <View style={[styles.row, { gap }]}>
      <SpotlightCell
        key={left.key}
        slot={left}
        borderColor={tileBorder}
        borderRadius={borderRadius.md}
        onItemPress={onItemPress}
      />
      <SpotlightCell
        key={right.key}
        slot={right}
        borderColor={tileBorder}
        borderRadius={borderRadius.md}
        onItemPress={onItemPress}
      />
    </View>
  );

  return (
    <View
      style={[
        styles.wrap,
        shadows.sm,
        {
          marginTop: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <View style={{ padding: spacing.md }}>
        <View style={styles.titleRow}>
          <Text
            variant="titleMedium"
            style={[styles.titleText, { color: colors.text.primary, fontWeight: '800' }]}
          >
            {t('public.items.dealsSpotlight.title', 'Featured deals')}
          </Text>
          {onSeeAllDeals ? (
            <Button mode="text" compact onPress={onSeeAllDeals} style={styles.seeAllBtn}>
              {t('public.items.dealsSpotlight.seeAll', 'See all')}
            </Button>
          ) : null}
        </View>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.md }}
        >
          {t('public.items.dealsSpotlight.subtitle', 'Hand-picked discounts — tap an image for details')}
        </Text>
        <View style={[styles.grid, { gap }]}>
          {row(slots[0], slots[1])}
          {row(slots[2], slots[3])}
        </View>
      </View>
    </View>
  );
});

const SpotlightCell = memo(function SpotlightCell({
  slot,
  borderColor,
  borderRadius: r,
  onItemPress,
}: {
  slot: { key: string; item: CatalogInventoryItem | null };
  borderColor: string;
  borderRadius: number;
  onItemPress?: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.cellOuter,
        {
          flex: 1,
          aspectRatio: 1,
          borderRadius: r,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.pageBackground,
          overflow: 'hidden',
        },
      ]}
    >
      {slot.item ? (
        <DealTile item={slot.item} borderRadius={r} onPress={() => onItemPress?.(slot.item!.id)} />
      ) : (
        <View style={[styles.skeletonInner, { backgroundColor: colors.divider }]} />
      )}
    </View>
  );
});

const DealTile = memo(function DealTile({
  item,
  borderRadius: r,
  onPress,
}: {
  item: CatalogInventoryItem;
  borderRadius: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const imgs = catalogOrderedImages(item);
  const uri = imgs[0]?.image_url;
  const image = useImageFallback(uri);
  const pct = dealPercent(item);
  const currency = item.item.currency || 'XAF';
  const price = catalogFromPrice(item);
  const priceLabel = (() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'XAF',
      }).format(price);
    } catch {
      return `${price} ${currency}`;
    }
  })();
  const a11y = t('public.items.dealsSpotlight.tileA11y', 'Open deal: {{name}}', { name: item.item.name });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.tilePress, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.tileInner, { borderRadius: r }]}>
        {image.hasImage && image.sourceUri ? (
          <Image
            source={{ uri: image.sourceUri }}
            style={[styles.img, { borderRadius: r }]}
            resizeMode="cover"
            onError={image.onImageError}
          />
        ) : (
          <View style={[styles.img, styles.placeholder, { borderRadius: r }]}>
            <Text style={[typography.caption, { color: colors.text.disabled }]}>{t('public.items.noImage', 'Photo')}</Text>
          </View>
        )}
        {pct > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.secondary.main }]}>
            <Text style={[typography.caption, { color: colors.secondary.contrast, fontWeight: '800' }]}>
              {t('public.items.card.savePercent', 'Save {{pct}}%', { pct })}
            </Text>
          </View>
        ) : null}
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.52)' }]}>
          <Text
            style={[typography.caption, { color: '#fff', fontWeight: '700' }]}
            numberOfLines={2}
          >
            {item.item.name}
          </Text>
          <Text style={[typography.caption, { color: '#fff', marginTop: 2, fontWeight: '600' }]}>
            {priceLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  seeAllBtn: {
    marginTop: -4,
    marginRight: -8,
  },
  grid: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  cellOuter: {},
  tilePress: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tileInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  skeletonInner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  img: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
