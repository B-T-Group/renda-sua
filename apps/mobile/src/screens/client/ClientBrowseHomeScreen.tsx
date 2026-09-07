import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrowseCatalogScreen } from '../shared/BrowseCatalogScreen';
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
import { BrowseCartFab } from '../../components/browse/BrowseCartFab';
import { ActionsNeededSection } from '../../components/common/ActionsNeededSection';
import { AssistantIconButton } from '../../components/common/AssistantIconButton';
import { NotificationBellButton } from '../../components/common/NotificationBellButton';
import { useActionsNeeded } from '../../hooks/useActionsNeeded';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme';
import { selectClientHomeOrders } from '../../utils/selectClientHomeOrders';
import type { Order } from '../../types/agent';

/** Client browse tab: catalog + navigation to item detail on the root stack. */
function ClientBrowseHomeScreenBase({
  foodOnly = false,
}: {
  foodOnly?: boolean;
} = {}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
      rootNav?.navigate('OrderDetail', { orderId: order.id });
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
  const { items: actionsNeededItems, dismissAll } = useActionsNeeded(
    isClientAuthenticated ? 'client' : null
  );
  const showActions =
    !foodOnly && isClientAuthenticated && actionsNeededItems.length > 0;

  const notificationBell = isClientAuthenticated ? (
    <NotificationBellButton unreadCount={unreadCount} onPress={onOpenNotifications} />
  ) : null;

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.pageBackground,
      }}
    >
      {showActions ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <ActionsNeededSection
            items={actionsNeededItems}
            onMarkAllRead={() => void dismissAll()}
          />
        </View>
      ) : null}
      <BrowseCatalogScreen
        foodOnly={foodOnly}
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
        headerTrailing={notificationBell}
        headerMarketTrailing={<AssistantIconButton onPress={openAssistant} />}
      />
      <BrowseCartFab />
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

export default observer(ClientBrowseHomeScreenBase);
