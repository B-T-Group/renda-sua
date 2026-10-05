import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { shadows } from '../../theme';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import type { CatalogStore } from '../../types/stores';

type Props = {
  stores: CatalogStore[];
  loading: boolean;
  error: string | null;
  hasSearch: boolean;
  onPress: (businessLocationId: string) => void;
  onRetry: () => void;
};

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
}: {
  store: CatalogStore;
  onPress: (id: string) => void;
  borderRadius: number;
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
    >
      <View
        style={[
          styles.row,
          shadows.sm,
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
          <Text variant="titleMedium" numberOfLines={2} style={{ fontWeight: '800', color: colors.text.primary }}>
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
});
