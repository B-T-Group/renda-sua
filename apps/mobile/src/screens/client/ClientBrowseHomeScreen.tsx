import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Badge } from 'react-native-paper';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrowseCatalogScreen } from '../shared/BrowseCatalogScreen';
import ClientRentalsHomeScreen from './ClientRentalsHomeScreen';
import { CatalogVariantPickerDialog } from '../../components/browse/CatalogVariantPickerDialog';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { useNearbyAgentsCount } from '../../hooks/useNearbyAgentsCount';
import type {
  ClientMainTabParamList,
  ClientRootStackParamList,
} from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import { BuyAgainCard, buyAgainLines } from '../../components/client/BuyAgainCard';
import { DiscoveryRails } from '../../components/client/DiscoveryRails';
import { HomeLaneSwitcher, type HomeLane } from '../../components/client/HomeLaneSwitcher';
import { ActionsNeededSection } from '../../components/common/ActionsNeededSection';
import { StoreCreditsSnapshot } from '../../components/credits/StoreCreditsSnapshot';
import { AssistantIconButton } from '../../components/common/AssistantIconButton';
import { NotificationBellButton } from '../../components/common/NotificationBellButton';
import { useActionsNeeded } from '../../hooks/useActionsNeeded';
import { usePurchaseCredits } from '../../hooks/usePurchaseCredits';
import { useNotifications } from '../../hooks/useNotifications';
import { usePostSignupCreditShopNavigation } from '../../hooks/usePostSignupCreditShopNavigation';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme';
import { selectClientHomeOrders } from '../../utils/selectClientHomeOrders';
import { purchaseCreditShopTarget } from '../../utils/purchaseCredits';
import type { Order } from '../../types/agent';

/** Client browse tab: catalog + navigation to item detail on the root stack. */
function ClientBrowseHomeScreenBase() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ClientMainTabParamList, 'ClientBrowse'>>();
  const { auth, persona } = useStore();
  const [snack, setSnack] = useState<string | null>(null);
  const clientBrowseOrders = auth.isAuthenticated && persona.activePersona === 'client';
  const { orders } = useClientOrders(clientBrowseOrders);
  const { count: nearbyAgentsCount } = useNearbyAgentsCount(clientBrowseOrders);
  const { unreadCount } = useNotifications();

  const rootNav =
    navigation.getParent<NativeStackNavigationProp<ClientRootStackParamList> | undefined>();
  const tabNav = navigation as BottomTabNavigationProp<ClientMainTabParamList>;

  const openAssistant = useCallback(() => {
    rootNav?.navigate('AssistantChat');
  }, [rootNav]);

  const { selected: homeOrders, totalActive: homeOrdersTotalActive } = useMemo(
    () => selectClientHomeOrders(clientBrowseOrders ? orders : []),
    [clientBrowseOrders, orders]
  );

  const onOpenHomeOrder = useCallback(
    (order: Order) => {
      rootNav?.navigate('OrderDetail', { orderId: order.id, backTo: 'home' });
    },
    [rootNav]
  );

  const onSeeAllHomeOrders = useCallback(() => {
    tabNav.navigate('ClientOrders');
  }, [tabNav]);

  const onItemPress = useCallback(
    (inventoryItemId: string) => {
      rootNav?.navigate('InventoryItemDetail', { inventoryItemId });
    },
    [rootNav]
  );

  const onCollectionPress = useCallback(
    (slug: string) => {
      rootNav?.navigate('CollectionDetail', { slug });
    },
    [rootNav]
  );

  const onStorePress = useCallback(
    (businessLocationId: string) => {
      rootNav?.navigate('StoreDetail', { businessId: businessLocationId });
    },
    [rootNav]
  );

  const onSeeAllStores = useCallback(() => {
    rootNav?.navigate('StoresList');
  }, [rootNav]);

  const onBrowseCategories = useCallback(() => {
    rootNav?.navigate('CategoriesBrowse');
  }, [rootNav]);

  const onPlaceOrder = useCallback(
    (catalogItem: CatalogInventoryItem, cartVariantId?: string) => {
      rootNav?.navigate('PlaceOrder', {
        inventoryItemId: catalogItem.id,
        ...(cartVariantId ? { variantId: cartVariantId } : {}),
      });
    },
    [rootNav]
  );

  const onOpenNotifications = useCallback(() => {
    rootNav?.navigate('NotificationsCenter');
  }, [rootNav]);

  const variantFlow = useCatalogVariantFlow({
    onPlaceOrder,
    onCartResult: (result) => {
      setSnack(
        result === 'added'
          ? t('cart.itemAdded', 'Added to cart')
          : t('cart.itemUpdated', 'Cart updated')
      );
    },
  });

  const isClientAuthenticated = auth.isAuthenticated && persona.activePersona === 'client';
  const lane: HomeLane =
    route.params?.segment === 'food' ? 'food' : route.params?.segment === 'rentals' ? 'rentals' : 'shop';
  const foodOnly = lane === 'food';
  const { items: actionsNeededItems, dismissAll } = useActionsNeeded(
    isClientAuthenticated ? 'client' : null
  );
  const { summary, usable } = usePurchaseCredits(isClientAuthenticated);
  usePostSignupCreditShopNavigation(isClientAuthenticated);
  const showActions =
    !foodOnly && isClientAuthenticated && actionsNeededItems.length > 0;
  const showCredits =
    !foodOnly && isClientAuthenticated && summary.totalRemaining > 0;
  const buyAgainOrder = useMemo(
    () =>
      (clientBrowseOrders ? orders : []).find(
        (order) => order.current_status === 'complete' || order.current_status === 'delivered'
      ),
    [clientBrowseOrders, orders]
  );
  const onLaneChange = useCallback(
    (next: HomeLane) => {
      tabNav.setParams({
        segment: next === 'shop' ? 'all' : next,
      });
    },
    [tabNav]
  );

  const onShopCredits = useCallback(() => {
    const grant = summary.primaryGrant;
    if (!grant) {
      rootNav?.navigate('StoresList');
      return;
    }
    const target = purchaseCreditShopTarget(grant);
    if (target.kind === 'store') {
      rootNav?.navigate('StoreDetail', { businessId: target.businessId });
      return;
    }
    if (target.kind === 'partners') {
      rootNav?.navigate('StoresList', { partnersOnly: true });
      return;
    }
    rootNav?.navigate('StoresList');
  }, [rootNav, summary.primaryGrant]);

  const notificationBell = isClientAuthenticated ? (
    <NotificationBellButton unreadCount={unreadCount} onPress={onOpenNotifications} />
  ) : null;

  if (lane === 'rentals') {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.pageBackground }}>
        <HomeLaneSwitcher value={lane} onChange={onLaneChange} />
        <ClientRentalsHomeScreen />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.pageBackground,
      }}
    >
      <HomeLaneSwitcher value={lane} onChange={onLaneChange} />
      {showActions ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <ActionsNeededSection
            items={actionsNeededItems}
            onMarkAllRead={() => void dismissAll()}
          />
        </View>
      ) : null}
      {showCredits ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <StoreCreditsSnapshot
            grants={usable}
            totalRemaining={summary.totalRemaining}
            currency={summary.currency}
            nearestExpiry={summary.nearestExpiry}
            primaryGrant={summary.primaryGrant}
            onShop={onShopCredits}
            onViewDetails={() => rootNav?.navigate('UserPurchaseCredits')}
          />
        </View>
      ) : null}
      <BrowseCatalogScreen
        foodOnly={foodOnly}
        initialSegment={foodOnly ? 'food' : 'all'}
        requestedCategory={route.params?.category}
        categoryRequestId={route.params?.categoryRequestId}
        onBrowseCategories={foodOnly ? undefined : onBrowseCategories}
        applyTopSafeArea={false}
        onItemPress={onItemPress}
        onClientPlaceOrder={variantFlow.requestBuy}
        onAddToCart={variantFlow.requestAddToCart}
        homeOrders={homeOrders}
        homeOrdersTotalActive={homeOrdersTotalActive}
        onOpenHomeOrder={homeOrders.length > 0 ? onOpenHomeOrder : undefined}
        onSeeAllHomeOrders={
          homeOrdersTotalActive > homeOrders.length ? onSeeAllHomeOrders : undefined
        }
        nearbyAgentsCount={nearbyAgentsCount}
        inventoryRequestsWithAuth={auth.isAuthenticated}
        onCollectionPress={onCollectionPress}
        onStorePress={onStorePress}
        onSeeAllStores={onSeeAllStores}
        headerTrailing={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <HomeCartButton />
            {notificationBell}
          </View>
        }
        headerMarketTrailing={<AssistantIconButton onPress={openAssistant} />}
        discoveryExtra={
          <>
            {buyAgainOrder ? (
              <BuyAgainCard
                orderId={buyAgainOrder.id}
                orderStatus={buyAgainOrder.current_status}
                items={buyAgainLines(buyAgainOrder.order_items)}
              />
            ) : null}
            <DiscoveryRails authenticated={isClientAuthenticated} onItemPress={onItemPress} />
          </>
        }
      />
      <CatalogVariantPickerDialog
        open={variantFlow.pickerOpen}
        item={variantFlow.pickerItem}
        onDismiss={variantFlow.closePicker}
        onConfirm={variantFlow.onPickerConfirm}
        confirmLabel={variantFlow.confirmLabel}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const HomeCartButton = observer(function HomeCartButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { cart } = useStore();
  const count = cart.lineCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('cart.fabA11y', 'Open cart')}
      onPress={() => (navigation as { navigate: (name: string) => void }).navigate('Cart')}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <MaterialCommunityIcons name="cart-outline" size={24} color={colors.text.primary} />
      {count > 0 ? (
        <Badge style={{ position: 'absolute', top: 4, right: 0, backgroundColor: colors.cta.main }} size={16}>
          {count > 99 ? '99+' : String(count)}
        </Badge>
      ) : null}
    </Pressable>
  );
});

export default observer(ClientBrowseHomeScreenBase);
