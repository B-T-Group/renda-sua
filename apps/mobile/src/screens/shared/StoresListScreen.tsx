import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Searchbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useCatalogStores } from '../../hooks/useCatalogStores';
import { useGuestCatalogCountry } from '../../hooks/useGuestCatalogCountry';
import { StatusPill } from '../../components/common/StatusPill';
import { StoreDefaultAvatar } from '../../components/illustrations/StoreDefaultAvatar';
import { shadows } from '../../theme';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import type { CatalogStore } from '../../types/stores';
import type {
  BusinessRootStackParamList,
  ClientRootStackParamList,
  GuestRootStackParamList,
} from '../../navigation/types';
import { useStore } from '../../stores/RootStore';

type Props =
  | NativeStackScreenProps<GuestRootStackParamList, 'StoresList'>
  | NativeStackScreenProps<ClientRootStackParamList, 'StoresList'>
  | NativeStackScreenProps<BusinessRootStackParamList, 'StoresList'>;

function formatDistanceKm(
  meters: number | null | undefined,
  approxLabel: (km: string) => string
) {
  if (meters == null || !Number.isFinite(meters)) return null;
  const km =
    meters < 1000 ? (meters / 1000).toFixed(1) : Math.round(meters / 1000).toString();
  return approxLabel(km);
}

export default function StoresListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { auth } = useStore();
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 400);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const guestCountry = useGuestCatalogCountry();
  const withAuth = auth.isAuthenticated;
  const catalogReady = withAuth || !guestCountry.loading;
  const countryCode = withAuth ? undefined : guestCountry.countryCode;

  const { stores, loading, error, refetch } = useCatalogStores({
    limit: 50,
    search: debouncedSearch,
    countryCode,
    withAuth,
    enabled: catalogReady,
  });

  const openStore = useCallback(
    (businessLocationId: string) => {
      (navigation as { navigate: (name: string, params: object) => void }).navigate(
        'StoreDetail',
        { businessId: businessLocationId }
      );
    },
    [navigation]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: CatalogStore }) => {
      const name = item.name?.trim() || t('stores.unnamed', 'Store');
      const city = item.city?.trim() || null;
      const distance = formatDistanceKm(item.distance_meters, (km) =>
        t('stores.approxKm', '~{{km}} km', { km })
      );
      const itemPhrase = t('stores.itemCount', '{{count}} items', {
        count: item.item_count,
      });
      const meta = distance ? `${distance} · ${itemPhrase}` : itemPhrase;
      const openingSoon = item.is_storefront_visible && !item.can_accept_orders;
      const palette = storeAvatarPalette(name);

      return (
        <Pressable
          onPress={() => openStore(item.business_location_id)}
          accessibilityRole="button"
          accessibilityLabel={city ? `${name}, ${city}` : name}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          <View
            style={[
              styles.row,
              shadows.sm,
              {
                marginHorizontal: spacing.md,
                marginBottom: spacing.sm,
                paddingVertical: spacing.md,
                paddingRight: spacing.md,
                paddingLeft: spacing.md + 6,
                borderRadius: borderRadius.md,
                borderColor: palette.bg + '33',
                backgroundColor: colors.surface,
                overflow: 'hidden',
              },
            ]}
          >
            <View
              style={[
                styles.accentBar,
                { backgroundColor: palette.accent },
              ]}
            />
            {item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={[
                  styles.logo,
                  { borderColor: palette.bg + '44', backgroundColor: '#fff' },
                ]}
                resizeMode="contain"
              />
            ) : (
              <StoreDefaultAvatar name={name} size={56} />
            )}
            <View style={styles.rowBody}>
              <Text
                variant="titleMedium"
                numberOfLines={2}
                style={{ fontWeight: '800', color: colors.text.primary }}
              >
                {name}
              </Text>
              {city ? (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={{ color: colors.text.secondary, marginTop: 2 }}
                >
                  {city}
                </Text>
              ) : null}
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{ color: colors.text.secondary, marginTop: 2 }}
              >
                {meta}
              </Text>
              {openingSoon ? (
                <StatusPill
                  compact
                  label={t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
                  backgroundColor={colors.warning.main + '22'}
                  textColor={colors.warning.dark ?? colors.warning.main}
                  style={{ marginTop: 6 }}
                />
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [borderRadius.md, colors, openStore, spacing, t]
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Searchbar
          placeholder={t('stores.searchPlaceholder', 'Search store locations')}
          value={searchDraft}
          onChangeText={setSearchDraft}
          style={{ marginBottom: spacing.sm }}
        />
      </View>
      {loading && stores.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.business_location_id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.stateWrap}>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.error.main, textAlign: 'center' }}
                >
                  {error}
                </Text>
                <Button
                  mode="contained-tonal"
                  icon="refresh"
                  style={styles.stateButton}
                  onPress={() => void refetch()}
                >
                  {t('common.retry', 'Retry')}
                </Button>
              </View>
            ) : (
              <View style={styles.stateWrap}>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, textAlign: 'center' }}
                >
                  {t('stores.empty', 'No store locations to show yet.')}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  logo: { width: 56, height: 56, borderRadius: 12, borderWidth: 1.5 },
  rowBody: { flex: 1, minWidth: 0, paddingLeft: 4 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateButton: { marginTop: 12 },
});
