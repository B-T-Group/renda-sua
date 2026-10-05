import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { shadows } from '../../theme';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import type { CatalogStore } from '../../types/stores';

const CAROUSEL_WIDTH = 260;
const CAROUSEL_HEIGHT = 152;

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {stores.map((store) => (
          <View
            key={store.business_location_id}
            style={{ width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT, marginRight: 12 }}
          >
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
  const { colors, spacing } = useTheme();
  const name = store.name?.trim() || t('stores.unnamed', 'Store');
  const city = store.city?.trim() || null;
  const km = formatDistanceKm(store.distance_meters);
  const palette = storeAvatarPalette(name);

  return (
    <Pressable
      onPress={() => onPress(store.business_location_id)}
      accessibilityRole="button"
      accessibilityLabel={t('foods.restaurants.openMenu', 'Open {{name}} menu', { name })}
      style={fill ? styles.fill : undefined}
    >
      <View
        style={[
          styles.row,
          shadows.sm,
          fill ? styles.fill : null,
          {
            padding: spacing.md,
            borderRadius,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          },
        ]}
      >
        {store.logo_url ? (
          <Image
            source={{ uri: store.logo_url }}
            style={[styles.logo, { backgroundColor: '#fff', borderColor: palette.bg + '44' }]}
            resizeMode="contain"
          />
        ) : (
          <StoreDefaultAvatar name={name} size={64} />
        )}
        <View style={styles.body}>
          <Text
            variant="titleMedium"
            numberOfLines={fill ? 1 : 2}
            style={{ fontWeight: '800', color: colors.text.primary }}
          >
            {name}
          </Text>
          {city ? (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.text.secondary, marginTop: 2 }}>
              {city}
            </Text>
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
            {t('foods.restaurants.dishCount', '{{count}} dishes', { count: store.item_count })}
          </Text>
          {km ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.primary.main, fontWeight: '700', marginTop: 4 }}
            >
              {t('foods.distanceFromYou', '{{km}} km from you', { km })}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  fill: { flex: 1, height: '100%' },
  more: {
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
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
