import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { hashStoreName, storeAvatarPalette } from '../../utils/storeAvatarPalette';
import type { CatalogStore } from '../../types/stores';

const CAROUSEL_WIDTH = 220;
const COVERS = [
  require('../../../assets/restaurants/cover-table.jpg'),
  require('../../../assets/restaurants/cover-kitchen.jpg'),
];

type Props = {
  stores: CatalogStore[];
  loading: boolean;
  error: string | null;
  hasSearch: boolean;
  onPress: (businessLocationId: string) => void;
  onRetry: () => void;
};

type CarouselProps = {
  stores: CatalogStore[];
  loading: boolean;
  onPress: (businessLocationId: string) => void;
  onMore: () => void;
};

export function FoodsRestaurantCarousel({ stores, loading, onPress, onMore }: CarouselProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  if (loading && stores.length === 0) {
    return (
      <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.md }} />
    );
  }
  if (stores.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.subtitle1, { color: colors.text.primary, marginBottom: spacing.sm }]}>
        {t('foods.restaurants.section', 'Restaurants')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {stores.map((store) => (
          <View key={store.business_location_id} style={{ width: CAROUSEL_WIDTH, marginRight: 12 }}>
            <RestaurantRow store={store} onPress={onPress} borderRadius={12} fill />
          </View>
        ))}
        <MoreRestaurantsTile onPress={onMore} />
      </ScrollView>
    </View>
  );
}

export function FoodsRestaurantList({
  stores,
  loading,
  error,
  hasSearch,
  onPress,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();

  if (loading && stores.length === 0) {
    return (
      <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.lg }} />
    );
  }

  if (error && stores.length === 0) {
    return (
      <Pressable onPress={onRetry} accessibilityRole="button">
        <Text style={[typography.body2, { color: colors.error.main, marginTop: spacing.md }]}>
          {error}
        </Text>
      </Pressable>
    );
  }

  if (stores.length === 0) {
    return (
      <View style={{ paddingVertical: spacing.lg }}>
        <Text style={[typography.subtitle2, { color: colors.text.primary, textAlign: 'center' }]}>
          {hasSearch
            ? t('foods.restaurants.noMatches', 'No restaurants match your search')
            : t('foods.empty.noDishes', 'No restaurants near you yet')}
        </Text>
        <Text
          style={[
            typography.body2,
            { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs },
          ]}
        >
          {hasSearch
            ? t('foods.restaurants.tryAgain', 'Try another restaurant name.')
            : t('foods.empty.checkBack', 'Check back soon as restaurants join the platform.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      {stores.map((store) => (
        <RestaurantRow
          key={store.business_location_id}
          store={store}
          onPress={onPress}
          borderRadius={borderRadius.md}
        />
      ))}
    </View>
  );
}

function RestaurantRow({
  store,
  onPress,
  borderRadius,
  fill = false,
}: {
  store: CatalogStore;
  onPress: (id: string) => void;
  borderRadius: number;
  fill?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [logoFailed, setLogoFailed] = useState(false);
  const name = store.name?.trim() || t('stores.unnamed', 'Store');
  const showLogo = Boolean(store.logo_url) && !logoFailed;

  return (
    <Pressable
      onPress={() => onPress(store.business_location_id)}
      accessibilityRole="button"
      accessibilityLabel={t('foods.restaurants.openMenu', 'Open {{name}} menu', { name })}
      style={fill ? styles.fill : undefined}
    >
      <View style={[styles.card, shadows.sm, fill ? styles.fill : null, { borderRadius, backgroundColor: colors.surface }]}>
        {showLogo ? (
          <LogoRestaurant name={name} logoUrl={store.logo_url!} store={store} fill={fill} onLogoError={() => setLogoFailed(true)} />
        ) : (
          <IllustratedRestaurant name={name} store={store} />
        )}
      </View>
    </Pressable>
  );
}

function LogoRestaurant({
  name, logoUrl, store, fill, onLogoError,
}: {
  name: string;
  logoUrl: string;
  store: CatalogStore;
  fill: boolean;
  onLogoError: () => void;
}) {
  const { colors } = useTheme();
  const palette = storeAvatarPalette(name);
  return (
    <>
      <View style={[styles.logoBand, { height: fill ? 44 : 52, backgroundColor: palette.bg }]} />
      <View style={[styles.body, fill ? styles.fillBody : null]}>
        <View style={styles.plate}>
          <Image source={{ uri: logoUrl }} style={styles.plateImage} resizeMode="contain" onError={onLogoError} />
        </View>
        <Text variant="titleMedium" numberOfLines={1} style={[styles.name, { color: colors.text.primary }]}>{name}</Text>
        <RestaurantFacts store={store} />
      </View>
    </>
  );
}

function IllustratedRestaurant({ name, store }: { name: string; store: CatalogStore }) {
  const cover = COVERS[hashStoreName(name) % COVERS.length];
  return (
    <>
      <View style={styles.cover}>
        <Image source={cover} style={styles.coverImage} resizeMode="contain" />
        <View style={styles.scrim}>
          <Text numberOfLines={1} style={styles.coverName}>{name}</Text>
        </View>
      </View>
      <View style={styles.factsOnly}>
        <RestaurantFacts store={store} />
      </View>
    </>
  );
}

function RestaurantFacts({ store }: { store: CatalogStore }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const city = store.city?.trim() || null;
  const km = formatDistanceKm(store.distance_meters);
  const dishes = t('foods.restaurants.dishCount', '{{count}} dishes', { count: store.item_count });
  const place = [city, dishes].filter(Boolean).join(' · ');
  return (
    <View>
      <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.text.secondary }}>{place}</Text>
      {km ? <DistanceLabel km={km} /> : null}
    </View>
  );
}

function DistanceLabel({ km }: { km: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Text variant="bodySmall" numberOfLines={1} style={[styles.distance, { color: colors.primary.main }]}>
      {t('foods.distanceFromYou', '{{km}} km from you', { km })}
    </Text>
  );
}

function MoreRestaurantsTile({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('foods.restaurants.moreA11y', 'Browse all restaurants')}
      style={[styles.more, { backgroundColor: colors.primaryTint }]}
    >
      <View style={styles.mark}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={[styles.dot, { backgroundColor: colors.primary.main }]} />
        ))}
      </View>
      <Text style={[styles.moreLabel, { color: colors.text.primary }]}>
        {t('foods.restaurants.more', 'More')}
      </Text>
      <Text style={[styles.moreHint, { color: colors.text.secondary }]}>
        {t('foods.restaurants.moreHint', 'All restaurants')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  logoBand: { width: '100%' },
  body: { paddingHorizontal: 12, paddingBottom: 10 },
  fillBody: { flex: 1 },
  plate: {
    width: 52,
    height: 52,
    marginTop: -26,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  plateImage: { width: '100%', height: '100%' },
  name: { fontWeight: '800', marginTop: 4 },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: '#1c1410',
  },
  coverImage: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  coverName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  factsOnly: { paddingHorizontal: 12, paddingVertical: 8 },
  distance: { fontWeight: '700', marginTop: 2 },
  fill: { flex: 1, height: '100%' },
  more: {
    width: CAROUSEL_WIDTH,
    alignSelf: 'stretch',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  moreLabel: { fontWeight: '800', marginTop: 8 },
  moreHint: { marginTop: 2, fontSize: 12 },
  mark: { width: 56, height: 56, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 24, height: 24, borderRadius: 6 },
});
