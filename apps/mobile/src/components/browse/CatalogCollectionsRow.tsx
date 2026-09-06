import { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { CollectionSummary } from '../../types/collections';
import { shadows, type Theme } from '../../theme';
import { CollectionPreviewMosaic } from './CollectionPreviewMosaic';

export interface CatalogCollectionsRowProps {
  theme: Theme;
  collections: CollectionSummary[];
  loading: boolean;
  onCollectionPress: (slug: string) => void;
  onSeeAllCollections?: () => void;
}

/** Mini spotlight card width (smaller than full-width deals grid). */
export const COLLECTION_CARD_WIDTH = 252;

const CARD_INNER_PADDING = 8;

const TITLE_LINE_HEIGHT = 20;
const TITLE_MAX_LINES = 2;
const TITLE_TOP_GAP = 8;

/** Grid side length inside a collection card. */
export const COLLECTION_CARD_GRID_SIZE =
  COLLECTION_CARD_WIDTH - CARD_INNER_PADDING * 2;

/** Total card height (padded 2×2 grid + title, up to two lines). */
export const COLLECTION_ROW_HEIGHT =
  CARD_INNER_PADDING * 2 +
  COLLECTION_CARD_GRID_SIZE +
  TITLE_TOP_GAP +
  TITLE_LINE_HEIGHT * TITLE_MAX_LINES;

export function collectionCardSnapInterval(gap: number): number {
  return COLLECTION_CARD_WIDTH + gap;
}

export const CatalogCollectionsRow = memo(function CatalogCollectionsRow({
  theme,
  collections,
  loading,
  onCollectionPress,
  onSeeAllCollections,
}: CatalogCollectionsRowProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = theme;
  const cardGap = spacing.sm;
  const snapInterval = collectionCardSnapInterval(cardGap);
  const canScroll = collections.length > 1;

  const renderItem: ListRenderItem<CollectionSummary> = useCallback(
    ({ item }) => (
      <CollectionCard
        collection={item}
        colors={colors}
        spacing={spacing}
        borderRadius={borderRadius.md}
        onPress={() => onCollectionPress(item.slug)}
      />
    ),
    [borderRadius.md, colors, onCollectionPress, spacing]
  );

  const keyExtractor = useCallback((item: CollectionSummary) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={{ width: cardGap }} />,
    [cardGap]
  );

  if (!loading && collections.length === 0) return null;

  return (
    <View
      style={[
        styles.section,
        shadows.sm,
        {
          marginTop: spacing.md,
          marginHorizontal: -spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      {onSeeAllCollections ? (
        <View style={[styles.seeAllRow, { paddingHorizontal: spacing.md, marginBottom: spacing.xs }]}>
          <Button mode="text" compact onPress={onSeeAllCollections} style={styles.seeAllBtn}>
            {t('collections.viewAll', 'View all')}
          </Button>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ paddingVertical: spacing.sm }} />
      ) : (
        <FlatList
          horizontal
          data={collections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={canScroll}
          nestedScrollEnabled
          directionalLockEnabled
          decelerationRate="fast"
          snapToInterval={canScroll ? snapInterval : undefined}
          snapToAlignment="start"
          disableIntervalMomentum
          style={Platform.OS === 'web' ? styles.listWeb : undefined}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
            !canScroll && styles.listContentSingle,
          ]}
        />
      )}
    </View>
  );
});

interface CollectionCardProps {
  collection: CollectionSummary;
  colors: Theme['colors'];
  spacing: Theme['spacing'];
  borderRadius: number;
  onPress: () => void;
}

const CollectionCard = memo(function CollectionCard({
  collection: c,
  colors,
  spacing,
  borderRadius,
  onPress,
}: CollectionCardProps) {
  const previewUrls = useMemo(() => {
    const fromApi = (c.preview_image_urls ?? [])
      .map((url) => url?.trim())
      .filter((url): url is string => Boolean(url))
      .slice(0, 4);
    if (fromApi.length > 0) return fromApi;
    if (c.image_url?.trim()) {
      return [c.image_url.trim(), c.image_url.trim(), c.image_url.trim(), c.image_url.trim()];
    }
    return [];
  }, [c.image_url, c.preview_image_urls]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={c.name}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            width: COLLECTION_CARD_WIDTH,
            borderRadius,
            borderColor: colors.divider,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={styles.cardInner}>
          <CollectionPreviewMosaic
            imageUrls={previewUrls}
            gap={spacing.sm}
            tileBorderRadius={borderRadius}
            borderColor={colors.border}
            placeholderColor={colors.pageBackground}
          />
          <Text
            variant="titleSmall"
            numberOfLines={2}
            style={[
              styles.title,
              { color: colors.text.primary, marginTop: TITLE_TOP_GAP },
            ]}
          >
            {c.name}
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
  seeAllRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  listContentSingle: {
    flexGrow: 0,
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardInner: {
    padding: CARD_INNER_PADDING,
  },
  title: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: TITLE_LINE_HEIGHT,
  },
});
