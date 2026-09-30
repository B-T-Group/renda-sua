import React, { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AppEventsService } from '../../services/analytics/AppEventsService';
import type { CatalogCategoryTile } from '../../services/catalogExperienceApi';
import type { Theme } from '../../theme';

const TILE_WIDTH = 148;
const TILE_HEIGHT = 180;

export function CatalogCategoryRail({
  theme,
  title,
  items,
  onSelect,
}: {
  theme: Theme;
  title: string;
  items: CatalogCategoryTile[];
  onSelect: (name: string) => void;
}) {
  const { colors, spacing, typography, borderRadius, shadows } = theme;
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
            themeColors={colors}
            radius={borderRadius.card}
            shadow={shadows.sm}
            item={item}
            onPress={() => {
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
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
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

function CategoryTile({
  item,
  onPress,
  themeColors,
  radius,
  shadow,
}: {
  item: CatalogCategoryTile;
  onPress: () => void;
  themeColors: Theme['colors'];
  radius: number;
  shadow: Theme['shadows']['sm'];
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('client.browse.categoryTile', 'Browse {{name}}', {
        name: item.name,
      })}
      style={[styles.tile, shadow, { borderRadius: radius, backgroundColor: themeColors.background.paper }]}
    >
      <CategoryArt item={item} color={themeColors.primary.main} text={themeColors.primary.contrast} />
      <View style={styles.overlay}>
        <Text numberOfLines={2} style={styles.label}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  );
}

function CategoryArt({
  item,
  color,
  text,
}: {
  item: CatalogCategoryTile;
  color: string;
  text: string;
}) {
  if (item.imageUrl) {
    return <Image source={{ uri: item.imageUrl }} style={styles.art} resizeMode="cover" />;
  }
  return (
    <View style={[styles.art, styles.fallback, { backgroundColor: color }]}>
      <Text style={{ color: text, fontSize: 28, fontWeight: '700' }}>
        {item.name.trim().slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE_WIDTH, height: TILE_HEIGHT, marginRight: 12, overflow: 'hidden' },
  art: { ...StyleSheet.absoluteFillObject },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 28,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  label: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
