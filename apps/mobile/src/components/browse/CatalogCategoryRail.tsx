import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AppEventsService } from '../../services/analytics/AppEventsService';
import type { CatalogCategoryTile } from '../../services/catalogExperienceApi';
import type { Theme } from '../../theme';
import { CatalogCategoryCard } from './CatalogCategoryCard';

const TILE_WIDTH = 148;
const TILE_HEIGHT = 180;

export function CatalogCategoryRail({
  theme,
  title,
  items,
  onSelect,
  onMore,
}: {
  theme: Theme;
  title: string;
  items: CatalogCategoryTile[];
  onSelect: (name: string) => void;
  onMore?: () => void;
}) {
  const { spacing, typography, colors } = theme;
  useCategoryImpression(title, items);
  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.subtitle1, { color: colors.text.primary, marginBottom: spacing.sm }]}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item, position) => (
          <CategoryTile
            key={item.id}
            item={item}
            onPress={() => selectCategory(item, position, onSelect)}
          />
        ))}
        {onMore ? (
          <MoreCategoriesTile
            onPress={onMore}
            color={colors.primary.main}
            text={colors.text.primary}
            hint={colors.text.secondary}
            surface={colors.primaryTint}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function selectCategory(
  item: CatalogCategoryTile,
  position: number,
  onSelect: (name: string) => void
) {
  AppEventsService.track({
    eventType: 'catalog.module.click',
    metadata: {
      moduleId: 'explore-categories',
      moduleType: 'CATEGORY_CAROUSEL',
      position,
      categoryId: item.id,
    },
  });
  onSelect(item.name);
}

function useCategoryImpression(title: string, items: CatalogCategoryTile[]) {
  useEffect(() => {
    if (!title || items.length === 0) return;
    AppEventsService.track({
      eventType: 'catalog.module.impression',
      metadata: {
        moduleId: 'explore-categories',
        moduleType: 'CATEGORY_CAROUSEL',
        position: 0,
      },
    });
  }, [title, items]);
}

function CategoryTile({ item, onPress }: { item: CatalogCategoryTile; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.frame}>
      <CatalogCategoryCard
        name={item.name}
        imageUrl={item.imageUrl}
        width={TILE_WIDTH}
        height={TILE_HEIGHT}
        onPress={onPress}
        accessibilityLabel={t('client.browse.categoryTile', 'Browse {{name}}', { name: item.name })}
      />
    </View>
  );
}

function MoreCategoriesTile({
  onPress,
  color,
  text,
  hint,
  surface,
}: {
  onPress: () => void;
  color: string;
  text: string;
  hint: string;
  surface: string;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('client.browse.moreCategoriesA11y', 'Browse all categories')}
      style={[styles.more, { backgroundColor: surface }]}
    >
      <MoreCategoriesMark color={color} />
      <Text style={[styles.moreLabel, { color: text }]}>{t('client.browse.moreCategories', 'More')}</Text>
      <Text style={[styles.moreHint, { color: hint }]}>
        {t('client.browse.moreCategoriesHint', 'All categories')}
      </Text>
    </Pressable>
  );
}

function MoreCategoriesMark({ color }: { color: string }) {
  return (
    <View style={styles.mark}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { marginRight: 12 },
  more: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: { fontWeight: '800', marginTop: 8 },
  moreHint: { opacity: 0.7, marginTop: 2, fontSize: 12 },
  mark: { width: 56, height: 56, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 24, height: 24, borderRadius: 6 },
});
