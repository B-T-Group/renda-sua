import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

import ClientBrowseHomeScreen from '../screens/client/ClientBrowseHomeScreen';
import ClientRentalsHomeScreen from '../screens/client/ClientRentalsHomeScreen';
import ClientOrdersScreen from '../screens/client/ClientOrdersScreen';
import ClientMenuTabScreen from '../screens/client/ClientMenuTabScreen';
import ManageRecipientsScreen from '../screens/client/ManageRecipientsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import UserLikesScreen from '../screens/shared/UserLikesScreen';
import ClientProductInterestScreen from '../screens/client/ClientProductInterestScreen';
import SavedAccountsScreen from '../screens/shared/SavedAccountsScreen';
import AccountManagementScreen from '../screens/shared/AccountManagementScreen';
import DocumentsScreen from '../screens/shared/DocumentsScreen';
import TermsScreen from '../screens/shared/TermsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import FAQScreen from '../screens/shared/FAQScreen';
import AssistantChatScreen from '../screens/shared/AssistantChatScreen';
import MessagesScreen from '../screens/shared/MessagesScreen';
import ThreadDetailScreen from '../screens/shared/ThreadDetailScreen';
import SupportTicketsScreen from '../screens/shared/SupportTicketsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import NotificationPermissionScreen from '../screens/shared/NotificationPermissionScreen';
import NotificationPreferencesScreen from '../screens/shared/NotificationPreferencesScreen';
import InventoryItemDetailScreen from '../screens/shared/InventoryItemDetailScreen';
import CollectionDetailScreen from '../screens/shared/CollectionDetailScreen';
import StoresListScreen from '../screens/shared/StoresListScreen';
import StoreDetailScreen from '../screens/shared/StoreDetailScreen';
import PlaceOrderScreen from '../screens/client/PlaceOrderScreen';
import OrderPlacedSuccessScreen from '../screens/client/OrderPlacedSuccessScreen';
import MobileMoneyAwaitingPaymentScreen from '../screens/client/MobileMoneyAwaitingPaymentScreen';
import CartScreen from '../screens/shared/CartScreen';
import CartCheckoutScreen from '../screens/client/CartCheckoutScreen';
import ClientOrderDetailScreen from '../screens/client/ClientOrderDetailScreen';
import UserOrderMessagesScreen from '../screens/shared/UserOrderMessagesScreen';
import UserAccountsScreen from '../screens/shared/UserAccountsScreen';
import RentalListingDetailScreen from '../screens/shared/RentalListingDetailScreen';
import RentalRequestSubmittedScreen from '../screens/client/RentalRequestSubmittedScreen';
import ClientMyRentalsScreen from '../screens/client/ClientMyRentalsScreen';
import RentalBookingDetailScreen from '../screens/client/RentalBookingDetailScreen';
import RentalRateBookingScreen from '../screens/client/RentalRateBookingScreen';
import { EnrollPersonaExplainScreen } from '../screens/shared/enroll/EnrollPersonaExplainScreen';
import { EnrollPersonaSetupScreen } from '../screens/shared/enroll/EnrollPersonaSetupScreen';
import { EnrollPersonaSuccessScreen } from '../screens/shared/enroll/EnrollPersonaSuccessScreen';
import { useStore } from '../stores/RootStore';
import { usePersonaAttentionBadge } from '../hooks/usePersonaAttentionBadge';
import { useAppIconBadge } from '../hooks/useAppIconBadge';
import useCheckNotificationPermissionOnStart from '../hooks/useCheckNotificationPermissionOnStart';
import type { ClientMainTabParamList, ClientRootStackParamList, PlaceOrderParams } from './types';

const ClientTab = createBottomTabNavigator<ClientMainTabParamList>();
const ClientRootStack = createNativeStackNavigator<ClientRootStackParamList>();

export type { ClientAppNavScreen, ClientMainTabParamList, ClientRootStackParamList } from './types';

function deferWithCancel(run: () => void): { cancel: () => void } {
  let cancelled = false;
  const id = setTimeout(() => {
    if (!cancelled) run();
  }, 0);
  return {
    cancel() {
      cancelled = true;
      clearTimeout(id);
    },
  };
}

const ClientMainTabsScreen = observer(function ClientMainTabsScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { auth, persona } = useStore();
  void auth.postAuthResumeInventoryItemId;
  void auth.postAuthResumeInventoryDetailId;
  void auth.postAuthResumeCartCheckout;
  void persona.activePersona;

  const { totalCount: attentionBadgeCount, appIconBadgeCount } = usePersonaAttentionBadge(
    persona.activePersona === 'client' ? 'client' : null
  );
  useAppIconBadge(appIconBadgeCount);
  useCheckNotificationPermissionOnStart();

  useEffect(() => {
    if (persona.activePersona !== 'client') return;

    if (auth.postAuthResumeCartCheckout) {
      const task = deferWithCancel(() => {
        const shouldOpenCartCheckout = auth.consumePostAuthResumeForCartCheckout();
        if (!shouldOpenCartCheckout) return;
        const stackNav = navigation.getParent() ?? navigation;
        (stackNav as { navigate: (name: string) => void }).navigate('CartCheckout');
      });
      return () => task.cancel();
    }

    if (auth.postAuthResumeInventoryDetailId?.trim()) {
      const task = deferWithCancel(() => {
        const id = auth.consumePostAuthResumeForInventoryDetail();
        if (!id) return;
        const stackNav = navigation.getParent() ?? navigation;
        (
          stackNav as {
            navigate: (
              name: string,
              params: { inventoryItemId: string }
            ) => void;
          }
        ).navigate('InventoryItemDetail', { inventoryItemId: id });
      });
      return () => task.cancel();
    }

    if (!auth.postAuthResumeInventoryItemId?.trim()) return;

    const task = deferWithCancel(() => {
      const id = auth.consumePostAuthResumeForInventoryItem();
      if (!id) return;
      const stackNav = navigation.getParent() ?? navigation;
      (stackNav as { navigate: (name: string, params: PlaceOrderParams) => void }).navigate('PlaceOrder', {
        inventoryItemId: id,
      });
    });
    return () => task.cancel();
  }, [
    auth,
    navigation,
    persona.activePersona,
    auth.postAuthResumeCartCheckout,
    auth.postAuthResumeInventoryDetailId,
    auth.postAuthResumeInventoryItemId,
  ]);

  const bottomInset = insets.bottom || 0;
  const tabBarVerticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const tabBarHeightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = tabBarHeightBase + bottomInset + tabBarVerticalPadding / 2;

  return (
    <ClientTab.Navigator
      initialRouteName="ClientBrowse"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: tabBarHeight,
          backgroundColor: colors.pageBackground,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          paddingBottom: bottomInset + tabBarVerticalPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <ClientTab.Screen
        name="ClientBrowse"
        component={ClientBrowseHomeScreen}
        options={{
          tabBarLabel: t('nav.clientTabs.browseItems', { defaultValue: 'Browse Items' }),
          tabBarBadge: attentionBadgeCount > 0 ? attentionBadgeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error.main, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'shopping' : 'shopping-outline'} size={24} color={color} />
          ),
        }}
      />
      <ClientTab.Screen
        name="ClientRentals"
        component={ClientRentalsHomeScreen}
        options={{
          tabBarLabel: t('nav.clientTabs.rentals', { defaultValue: 'Rentals' }),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'calendar-clock' : 'calendar-clock-outline'} size={24} color={color} />
          ),
        }}
      />
      <ClientTab.Screen
        name="ClientFoods"
        options={{
          tabBarLabel: t('nav.clientTabs.foods', { defaultValue: 'Food' }),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'food' : 'food-outline'} size={24} color={color} />
          ),
        }}
      >
        {() => <ClientBrowseHomeScreen foodOnly />}
      </ClientTab.Screen>
      <ClientTab.Screen
        name="ClientOrders"
        component={ClientOrdersScreen}
        options={{
          tabBarLabel: t('nav.clientTabs.orders', { defaultValue: 'Orders' }),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'clipboard-text' : 'clipboard-text-outline'} size={24} color={color} />
          ),
        }}
      />
      <ClientTab.Screen
        name="ClientMenu"
        component={ClientMenuTabScreen}
        options={{
          tabBarLabel: t('nav.tabs.menu', 'Menu'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'menu' : 'menu-open'} size={24} color={color} />
          ),
        }}
      />
    </ClientTab.Navigator>
  );
});

export function ClientRootNavigator() {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.flex}>
      <ClientRootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.text.primary,
          headerTitleStyle: typography.h6,
          headerShadowVisible: false,
        }}
      >
        <ClientRootStack.Screen
          name="ClientMainTabs"
          component={ClientMainTabsScreen}
          options={{
            headerShown: false,
            title: t('client.placeOrder.successScreen.backToHome', 'Home'),
          }}
        />
        <ClientRootStack.Screen
          name="CollectionDetail"
          component={CollectionDetailScreen}
          options={{
            title: t('collections.landing', 'Collection'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <ClientRootStack.Screen
          name="StoresList"
          component={StoresListScreen}
          options={{
            title: t('stores.listTitle', 'Store locations'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <ClientRootStack.Screen
          name="StoreDetail"
          component={StoreDetailScreen}
          options={{
            title: t('stores.detailTitle', 'Store'),
            headerBackTitle: t('stores.listTitle', 'Store locations'),
          }}
        />
        <ClientRootStack.Screen
          name="InventoryItemDetail"
          component={InventoryItemDetailScreen}
          options={{
            title: t('public.items.detail.navTitle', 'Item'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <ClientRootStack.Screen
          name="PlaceOrder"
          component={PlaceOrderScreen}
          options={{
            title: t('client.placeOrder.title', 'Place order'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <ClientRootStack.Screen
          name="Cart"
          component={CartScreen}
          options={{
            title: t('cart.title', 'Cart'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <ClientRootStack.Screen
          name="CartCheckout"
          component={CartCheckoutScreen}
          options={{
            title: t('checkout.title', 'Checkout'),
            headerBackTitle: t('cart.title', 'Cart'),
          }}
        />
        <ClientRootStack.Screen
          name="OrderPlacedSuccess"
          component={OrderPlacedSuccessScreen}
          options={{
            title: t('client.placeOrder.successScreen.navTitle', 'Order placed'),
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <ClientRootStack.Screen
          name="MobileMoneyAwaitingPayment"
          component={MobileMoneyAwaitingPaymentScreen}
          options={{
            title: t('orders.momoAwaiting.navTitle', 'Approve payment'),
          }}
        />
        <ClientRootStack.Screen
          name="OrderDetail"
          component={ClientOrderDetailScreen}
          options={{
            title: t('orders.detailScreenTitle', 'Order detail'),
            headerBackTitle: t('nav.clientTabs.orders', 'Orders'),
          }}
        />
        <ClientRootStack.Screen
          name="OrderMessages"
          component={UserOrderMessagesScreen}
          options={{
            title: t('messages.orderMessages', 'Order messages'),
            headerBackTitle: t('orders.detailScreenTitle', 'Order detail'),
          }}
        />
        <ClientRootStack.Screen
          name="RentalListingDetail"
          component={RentalListingDetailScreen}
          options={{
            title: t('rentals.title', 'Rentals'),
            headerBackTitle: t('nav.clientTabs.rentals', 'Rentals'),
          }}
        />
        <ClientRootStack.Screen
          name="RentalRequestSubmitted"
          component={RentalRequestSubmittedScreen}
          options={{
            title: t('rentals.requestSubmitted.pageTitle', 'Request sent'),
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <ClientRootStack.Screen
          name="ClientMyRentals"
          component={ClientMyRentalsScreen}
          options={{
            title: t('client.rentals.tabMyRentals', 'My rentals'),
            headerBackTitle: t('nav.clientTabs.rentals', 'Rentals'),
          }}
        />
        <ClientRootStack.Screen
          name="RentalBookingDetail"
          component={RentalBookingDetailScreen}
          options={{
            title: t('rentals.title', 'Rentals'),
            headerBackTitle: t('client.rentals.tabMyRentals', 'My rentals'),
          }}
        />
        <ClientRootStack.Screen
          name="RentalRateBooking"
          component={RentalRateBookingScreen}
          options={{
            title: t('client.rentals.rateRental', 'Rate this rental'),
            headerBackTitle: t('common.back', 'Back'),
          }}
        />
        <ClientRootStack.Screen
          name="ClientAccounts"
          component={UserAccountsScreen}
          options={{ title: t('client.accounts.navTitle', 'Wallet') }}
        />
        <ClientRootStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
        <ClientRootStack.Screen
          name="ManageRecipients"
          component={ManageRecipientsScreen}
          options={{ title: t('nav.manageRecipients', 'Saved Recipients') }}
        />
        <ClientRootStack.Screen
          name="UserLikes"
          component={UserLikesScreen}
          options={{ title: t('items.likes.title', 'Your favorites') }}
        />
        <ClientRootStack.Screen
          name="ClientProductInterest"
          component={ClientProductInterestScreen}
          options={{
            title: t('productInterest.clientTitle', 'My interest requests'),
          }}
        />
        <ClientRootStack.Screen
          name="NotificationPreferences"
          component={NotificationPreferencesScreen}
          options={{
            title: t('notifications.preferences.title', 'Notification preferences'),
          }}
        />
        <ClientRootStack.Screen
          name="SavedAccounts"
          component={SavedAccountsScreen}
          options={{ headerShown: false }}
        />
        <ClientRootStack.Screen
          name="AccountManagement"
          component={AccountManagementScreen}
          options={{ headerShown: false }}
        />
        <ClientRootStack.Screen
          name="EnrollPersonaExplain"
          component={EnrollPersonaExplainScreen}
          options={{ title: t('enrollPersona.navTitle', 'Add a role') }}
        />
        <ClientRootStack.Screen
          name="EnrollPersonaSetup"
          component={EnrollPersonaSetupScreen}
          options={{ title: t('enrollPersona.setup.navTitle', 'Setup') }}
        />
        <ClientRootStack.Screen
          name="EnrollPersonaSuccess"
          component={EnrollPersonaSuccessScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <ClientRootStack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
        <ClientRootStack.Screen name="Terms" component={TermsScreen} options={{ title: 'Conditions de service' }} />
        <ClientRootStack.Screen
          name="Privacy"
          component={PrivacyPolicyScreen}
          options={{ title: 'Privacy Policy' }}
        />
        <ClientRootStack.Screen name="FAQ" component={FAQScreen} options={{ title: 'FAQ' }} />
        <ClientRootStack.Screen
          name="AssistantChat"
          component={AssistantChatScreen}
          options={{ title: t('assistant.title', 'Rendasua Assistant') }}
        />
        <ClientRootStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
        <ClientRootStack.Screen name="ThreadDetail" component={ThreadDetailScreen} options={{ headerShown: false }} />
        <ClientRootStack.Screen name="SupportTickets" component={SupportTicketsScreen} options={{ title: 'Mes tickets' }} />
        <ClientRootStack.Screen
          name="NotificationPermission"
          component={NotificationPermissionScreen}
          options={{ title: t('notifications.permission.title', 'Stay in the loop') }}
        />
        <ClientRootStack.Screen
          name="NotificationsCenter"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
        />
      </ClientRootStack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
