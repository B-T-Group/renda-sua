import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { IconButton, Snackbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useReelsFeed } from '../../hooks/useReelsFeed';
import { ReelPlayer } from '../../components/reels/ReelPlayer';
import { ReelOverlay } from '../../components/reels/ReelOverlay';
import { CatalogVariantPickerDialog } from '../../components/browse/CatalogVariantPickerDialog';
import { recordReelView, type FeedReel } from '../../services/reelsApi';
import {
  fetchAuthenticatedInventoryItemById,
  fetchPublicInventoryItemById,
} from '../../services/inventoryItemsApi';
import { useTheme } from '../../contexts/ThemeContext';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { useReportTabBarScroll } from '../../navigation/floatingTabBarVisibility';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { useStore } from '../../stores/RootStore';

const HOME_TAB: Record<string, string> = {
  client: 'ClientBrowse',
  business: 'BusinessDashboard',
  agent: 'Dashboard',
};

function ReelsFeedScreen() {
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { persona, auth, cart } = useStore();
  const bottomPad = useMainTabContentBottomPadding(8);
  const { onScroll: reportTabBarScroll } = useReportTabBarScroll();
  const { items, loading, error, loadMore, refresh, sessionId } = useReelsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);
  const viewStartRef = useRef<number>(Date.now());
  const addingRef = useRef(false);

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const home = HOME_TAB[persona.activePersona] ?? 'GuestBrowse';
    (navigation as { navigate: (name: string) => void }).navigate(home);
  }, [navigation, persona.activePersona]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const top = viewableItems.find((v) => v.isViewable);
      if (top?.index == null) return;
      const prev = activeIndex;
      if (prev !== top.index && items[prev]) {
        const elapsed = Date.now() - viewStartRef.current;
        void recordReelView(items[prev].id, elapsed, sessionId);
      }
      setActiveIndex(top.index);
      viewStartRef.current = Date.now();
    },
    [activeIndex, items, sessionId]
  );

  const onBuy = useCallback(
    (item: FeedReel) => {
      if (item.subject_type !== 'item') return;
      const inventoryItemId = item.inventoryItemId;
      if (!inventoryItemId) return;
      const nav = navigation as { navigate: (n: string, p: object) => void };
      if (persona.activePersona === 'client') {
        nav.navigate('PlaceOrder', { inventoryItemId });
        return;
      }
      nav.navigate('InventoryItemDetail', { inventoryItemId });
    },
    [navigation, persona.activePersona]
  );

  const { requestAddToCart, pickerOpen, pickerItem, closePicker, onPickerConfirm, confirmLabel } =
    useCatalogVariantFlow({
      onPlaceOrder: (catalogItem, cartVariantId) => {
        const nav = navigation as { navigate: (n: string, p: object) => void };
        nav.navigate('PlaceOrder', {
          inventoryItemId: catalogItem.id,
          ...(cartVariantId ? { variantId: cartVariantId } : {}),
        });
      },
      onCartResult: (result) => {
        setSnack(
          result === 'added'
            ? t('cart.itemAdded', 'Added to cart')
            : t('cart.itemUpdated', 'Cart updated')
        );
      },
    });

  const onAddToCart = useCallback(
    async (item: FeedReel) => {
      if (addingRef.current || item.subject_type !== 'item') return;
      const inventoryItemId = item.inventoryItemId;
      if (!inventoryItemId || item.purchasable === false) return;
      addingRef.current = true;
      try {
        const fetchItem = auth.isAuthenticated
          ? fetchAuthenticatedInventoryItemById
          : fetchPublicInventoryItemById;
        const res = await fetchItem(inventoryItemId);
        if (!res.success || !res.data) {
          setSnack(t('cart.addFailed', 'Couldn’t add to cart'));
          return;
        }
        requestAddToCart(res.data);
      } catch {
        setSnack(t('cart.addFailed', 'Couldn’t add to cart'));
      } finally {
        addingRef.current = false;
      }
    },
    [auth.isAuthenticated, requestAddToCart, t]
  );

  const showCtas = persona.activePersona !== 'business';

  const renderItem = useCallback(
    ({ item, index }: { item: FeedReel; index: number }) => (
      <View style={{ height, backgroundColor: '#000' }}>
        {item.video_url ? (
          <ReelPlayer
            uri={item.video_url}
            active={isFocused && index === activeIndex}
            posterUri={item.thumbnail_url}
          />
        ) : null}
        <ReelOverlay
          reel={item}
          onBuy={showCtas ? () => onBuy(item) : undefined}
          onAddToCart={showCtas ? () => void onAddToCart(item) : undefined}
          inCart={
            !!item.inventoryItemId && cart.isListingInCart(item.inventoryItemId)
          }
        />
      </View>
    ),
    [activeIndex, cart, height, isFocused, onAddToCart, onBuy, showCtas]
  );

  const backButton = (
    <IconButton
      icon="arrow-left"
      iconColor="#fff"
      containerColor="rgba(0,0,0,0.45)"
      style={[styles.backBtn, { top: insets.top + 4 }]}
      onPress={onBack}
      accessibilityLabel={t('reels.back', 'Back')}
    />
  );

  if (loading && !items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        {backButton}
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && !items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        {backButton}
        <Text variant="titleMedium">{t('reels.errorTitle', 'Couldn’t load reels')}</Text>
        <Text style={[styles.muted, { color: colors.text.secondary }]}>{error}</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        {backButton}
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 8, textAlign: 'center' }}>
          {t('reels.emptyTitle', 'No reels yet')}
        </Text>
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t('reels.empty', 'Check back soon — merchants will post short videos here.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        style={styles.black}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={reportTabBarScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshing={loading}
        onRefresh={refresh}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />
      {backButton}
      <CatalogVariantPickerDialog
        open={pickerOpen}
        item={pickerItem}
        onDismiss={closePicker}
        onConfirm={onPickerConfirm}
        confirmLabel={confirmLabel}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

export default observer(ReelsFeedScreen);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  black: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  muted: { marginTop: 8, textAlign: 'center' },
  backBtn: { position: 'absolute', left: 4, zIndex: 20, elevation: 20 },
});
