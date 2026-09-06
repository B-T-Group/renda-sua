import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useInventoryCatalog } from '../../hooks/useInventoryCatalog';
import { useFeaturedCollections } from '../../hooks/useFeaturedCollections';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { useStockAvailabilityChecks } from '../../hooks/useStockAvailabilityChecks';
import { BrowseCartFab } from '../../components/browse/BrowseCartFab';
import { CatalogVariantPickerDialog } from '../../components/browse/CatalogVariantPickerDialog';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { useStore } from '../../stores/RootStore';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import type { ClientRootStackParamList, GuestRootStackParamList } from '../../navigation/types';

type Props =
  | NativeStackScreenProps<GuestRootStackParamList, 'CollectionDetail'>
  | NativeStackScreenProps<ClientRootStackParamList, 'CollectionDetail'>;

function CollectionDetailScreen({ route, navigation }: Props) {
  const openItem = useCallback(
    (inventoryItemId: string) => {
      (navigation as { navigate: (name: string, params: object) => void }).navigate(
        'InventoryItemDetail',
        { inventoryItemId }
      );
    },
    [navigation]
  );
  const openStore = useCallback(
    (businessLocationId: string) => {
      (navigation as { navigate: (name: string, params: object) => void }).navigate(
        'StoreDetail',
        { businessId: businessLocationId }
      );
    },
    [navigation]
  );
  const { slug } = route.params;
  const { t } = useTranslation();
  const { cart, persona, auth } = useStore();
  const { colors, spacing } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const { collections } = useFeaturedCollections({ enabled: true });
  const meta = collections.find((c) => c.slug === slug);

  const catalog = useInventoryCatalog({
    search: '',
    sort: 'relevance',
    collection: slug,
  });

  const { trackView } = useTrackItemView();

  const {
    requestCheck,
    isPending: isAvailabilityPending,
    isSending: isAvailabilitySending,
    snack: availabilitySnack,
    clearSnack: clearAvailabilitySnack,
  } = useStockAvailabilityChecks({
    isAuthenticated: auth.isAuthenticated,
    onLoginRequired: () => {
      (navigation as { navigate: (name: string, params?: object) => void }).navigate(
        'GuestTabs',
        { screen: 'GuestAuth', params: { screen: 'Login' } }
      );
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await catalog.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [catalog]);

  const {
    pickerItem,
    pickerOpen,
    closePicker,
    onPickerConfirm,
    requestBuy,
    requestAddToCart,
    confirmLabel,
  } = useCatalogVariantFlow({
    onPlaceOrder: (item, cartVariantId) => {
      trackView(item.id);
      const nav = navigation as {
        navigate: (name: string, params: object) => void;
      };
      if (persona.activePersona === 'client') {
        nav.navigate('PlaceOrder', {
          inventoryItemId: item.id,
          ...(cartVariantId ? { variantId: cartVariantId } : {}),
        });
        return;
      }
      openItem(item.id);
    },
    onCartResult: (result) => {
      setSnack(
        result === 'added'
          ? t('cart.itemAdded', 'Added to cart')
          : t('cart.itemUpdated', 'Cart updated')
      );
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: CatalogInventoryItem }) => (
      <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
        <InventoryCatalogCard
          item={item}
          primaryLabel={t('public.items.buyNow', 'Buy')}
          onPrimaryPress={(selectionId) => {
            requestBuy(item, selectionId);
          }}
          onItemPress={(id) => {
            trackView(id);
            openItem(id);
          }}
          onAddToCart={(selectionId) => requestAddToCart(item, selectionId)}
          inCartQuantity={cart.quantityForListing(item.id)}
          onStorePress={(locId) => {
            trackView(item.id);
            openStore(locId);
          }}
          onCheckAvailability={() => void requestCheck(item.id)}
          availabilityPending={isAvailabilityPending(item.id)}
          availabilitySending={isAvailabilitySending(item.id)}
        />
      </View>
    ),
    [
      cart.items,
      isAvailabilityPending,
      isAvailabilitySending,
      openItem,
      openStore,
      requestAddToCart,
      requestBuy,
      requestCheck,
      spacing.md,
      spacing.sm,
      t,
      trackView,
    ]
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBackground }]} edges={['bottom']}>
      <View style={{ padding: spacing.md }}>
        <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
          {meta?.name ?? slug.replace(/-/g, ' ')}
        </Text>
        {meta?.description ? (
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 4 }}>
            {meta.description}
          </Text>
        ) : null}
      </View>
      {catalog.loading && catalog.items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={catalog.items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (!catalog.loadingMore) void catalog.loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            catalog.error ? (
              <View style={styles.stateWrap}>
                <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
                  {catalog.error}
                </Text>
                <Button mode="contained-tonal" icon="refresh" style={styles.stateButton} onPress={() => void catalog.refetch()}>
                  {t('common.retry', 'Retry')}
                </Button>
              </View>
            ) : (
              <View style={styles.stateWrap}>
                <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                  {t('collections.empty', 'No items are available in this collection yet.')}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            catalog.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
      <BrowseCartFab />
      <CatalogVariantPickerDialog
        open={pickerOpen}
        item={pickerItem}
        onDismiss={closePicker}
        onConfirm={onPickerConfirm}
        confirmLabel={confirmLabel}
      />
      <Snackbar
        visible={!!(availabilitySnack ?? snack)}
        onDismiss={() => {
          clearAvailabilitySnack();
          setSnack(null);
        }}
        duration={2500}
      >
        {availabilitySnack ?? snack}
      </Snackbar>
    </SafeAreaView>
  );
}

export default observer(CollectionDetailScreen);

const styles = StyleSheet.create({
  root: { flex: 1 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateButton: { marginTop: 12 },
});
