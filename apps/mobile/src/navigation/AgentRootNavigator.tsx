import React from 'react';
import { useTranslation } from 'react-i18next';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

import HomeScreen from '../screens/agent/HomeScreen';
import OpenOrdersScreen from '../screens/agent/OpenOrdersScreen';
import OrdersScreen from '../screens/agent/OrdersScreen';
import AgentOrderDetailScreen from '../screens/agent/AgentOrderDetailScreen';
import UserOrderMessagesScreen from '../screens/shared/UserOrderMessagesScreen';
import EarningsScreen from '../screens/agent/EarningsScreen';
import AgentBusinessReferralScreen from '../screens/agent/AgentBusinessReferralScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationPreferencesScreen from '../screens/shared/NotificationPreferencesScreen';
import SavedAccountsScreen from '../screens/shared/SavedAccountsScreen';
import AccountManagementScreen from '../screens/shared/AccountManagementScreen';
import DocumentsScreen from '../screens/shared/DocumentsScreen';
import MenuTabScreen from '../screens/agent/MenuTabScreen';
import ConfigurePaymentsScreen from '../screens/shared/ConfigurePaymentsScreen';
import UserMobilePaymentPhonesScreen from '../screens/shared/UserMobilePaymentPhonesScreen';
import TermsScreen from '../screens/shared/TermsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import FAQScreen from '../screens/shared/FAQScreen';
import AssistantChatScreen from '../screens/shared/AssistantChatScreen';
import MessagesScreen from '../screens/shared/MessagesScreen';
import ThreadDetailScreen from '../screens/shared/ThreadDetailScreen';
import SupportTicketsScreen from '../screens/shared/SupportTicketsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import NotificationPermissionScreen from '../screens/shared/NotificationPermissionScreen';
import AgentLocationTrackingScreen from '../screens/agent/AgentLocationTrackingScreen';
import UserAccountsScreen from '../screens/shared/UserAccountsScreen';
import { EnrollPersonaExplainScreen } from '../screens/shared/enroll/EnrollPersonaExplainScreen';
import { EnrollPersonaSetupScreen } from '../screens/shared/enroll/EnrollPersonaSetupScreen';
import { EnrollPersonaSuccessScreen } from '../screens/shared/enroll/EnrollPersonaSuccessScreen';
import { AgentStatusBar } from '../components/agent/AgentStatusBar';
import { PersistentActiveDeliveryHeader } from '../components/agent/PersistentActiveDeliveryHeader';

import { usePersonaAttentionBadge } from '../hooks/usePersonaAttentionBadge';
import { useAppIconBadge } from '../hooks/useAppIconBadge';
import useCheckNotificationPermissionOnStart from '../hooks/useCheckNotificationPermissionOnStart';

import type { OrdersStackParamList } from '../screens/shared/orderDetail/types';
import type { EnrollPersonaParams } from './types';
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

export type MainTabParamList = {
  Dashboard: undefined;
  OpenOrders: undefined;
  Orders: undefined;
  Menu: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
  MainTabs: undefined;
  NotificationsCenter: undefined;
  NotificationPermission: undefined;
  Earnings: undefined;
  AgentAccounts: undefined;
  AgentBusinessReferral: undefined;
  Profile: undefined;
  NotificationPreferences: undefined;
  SavedAccounts: { mode?: 'continue' | 'switch' };
  AccountManagement: undefined;
  ConfigurePayments: undefined;
  MobilePaymentPhones: undefined;
  Documents: undefined;
  Terms: undefined;
  Privacy: undefined;
  FAQ: undefined;
  AssistantChat: undefined;
  Messages: undefined;
  ThreadDetail: { threadId: string };
  SupportTickets: undefined;
  AgentLocationTracking: undefined;
  EnrollPersonaExplain: EnrollPersonaParams;
  EnrollPersonaSetup: EnrollPersonaParams;
  EnrollPersonaSuccess: EnrollPersonaParams;
};

export type AgentAppNavScreen = keyof RootStackParamList | keyof MainTabParamList;

function OrdersStackScreen() {
  const { colors, typography } = useTheme();
  return (
    <OrdersStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.pageBackground },
        headerTintColor: colors.text.primary,
        headerTitleStyle: typography.h6,
      }}
    >
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Mes commandes' }} />
      <OrdersStack.Screen name="OrderDetail" component={AgentOrderDetailScreen} options={{ title: 'Détail commande' }} />
      <OrdersStack.Screen
        name="OrderMessages"
        component={UserOrderMessagesScreen}
        options={{ title: 'Messages commande' }}
      />
    </OrdersStack.Navigator>
  );
}

function MainTabsScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { totalCount: attentionBadgeCount, appIconBadgeCount } = usePersonaAttentionBadge('agent');
  useAppIconBadge(appIconBadgeCount);
  useCheckNotificationPermissionOnStart();

  const bottomInset = insets.bottom || 0;
  const tabBarVerticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const tabBarHeightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = tabBarHeightBase + bottomInset + tabBarVerticalPadding / 2;

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
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
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.tabs.dashboard', 'Accueil'),
          tabBarBadge: attentionBadgeCount > 0 ? attentionBadgeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error.main, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="OpenOrders"
        component={OpenOrdersScreen}
        options={{
          tabBarLabel: t('nav.tabs.openOrders', 'Disponibles'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="package-variant" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStackScreen}
        listeners={({ navigation }) => ({
          // Always land on the orders list when the tab is pressed, even when a
          // previously opened order detail was preserved in the nested stack.
          tabPress: () => {
            const state = navigation.getState();
            const ordersRoute = state.routes.find((r) => r.name === 'Orders');
            const nestedStack = ordersRoute?.state;
            if (nestedStack?.key && (nestedStack.index ?? 0) > 0) {
              navigation.dispatch({
                ...CommonActions.reset({ index: 0, routes: [{ name: 'OrdersList' }] }),
                target: nestedStack.key,
              });
            }
          },
        })}
        options={{
          tabBarLabel: t('nav.tabs.orders', 'Actives'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'truck-delivery' : 'truck-delivery-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuTabScreen}
        options={{
          tabBarLabel: t('nav.tabs.menu', 'Menu'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'menu' : 'menu-open'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AgentRootNavigator() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <View style={{ paddingTop: insets.top }}>
        <AgentStatusBar />
        <PersistentActiveDeliveryHeader />
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <RootStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.pageBackground },
            headerTintColor: colors.text.primary,
            headerTitleStyle: typography.h6,
            headerShadowVisible: false,
          }}
        >
          <RootStack.Screen
            name="MainTabs"
            component={MainTabsScreen}
            options={{
              headerShown: false,
              title: t('nav.tabs.dashboard', 'Home'),
            }}
          />
          <RootStack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Gains' }} />
          <RootStack.Screen
            name="AgentAccounts"
            component={UserAccountsScreen}
            options={{ title: t('agent.accounts.navTitle', 'Wallet') }}
          />
          <RootStack.Screen
            name="AgentBusinessReferral"
            component={AgentBusinessReferralScreen}
            options={{
              title: t('agent.businessReferrals.navTitle', 'Refer a business'),
            }}
          />
          <RootStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
          <RootStack.Screen
            name="NotificationPreferences"
            component={NotificationPreferencesScreen}
            options={{
              title: t('notifications.preferences.title', 'Notification preferences'),
            }}
          />
          <RootStack.Screen
            name="SavedAccounts"
            component={SavedAccountsScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="AccountManagement"
            component={AccountManagementScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EnrollPersonaExplain"
            component={EnrollPersonaExplainScreen}
            options={{ title: t('enrollPersona.navTitle', 'Add a role') }}
          />
          <RootStack.Screen
            name="EnrollPersonaSetup"
            component={EnrollPersonaSetupScreen}
            options={{ title: t('enrollPersona.setup.navTitle', 'Setup') }}
          />
          <RootStack.Screen
            name="EnrollPersonaSuccess"
            component={EnrollPersonaSuccessScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <RootStack.Screen
            name="ConfigurePayments"
            component={ConfigurePaymentsScreen}
            options={{ title: t('payments.configureTitle', 'Paiements') }}
          />
          <RootStack.Screen
            name="MobilePaymentPhones"
            component={UserMobilePaymentPhonesScreen}
            options={{
              title: t('mobilePaymentPhone.manageTitle', 'Mobile money numbers'),
            }}
          />
          <RootStack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
          <RootStack.Screen name="Terms" component={TermsScreen} options={{ title: 'Conditions de service' }} />
          <RootStack.Screen
            name="Privacy"
            component={PrivacyPolicyScreen}
            options={{ title: 'Privacy Policy' }}
          />
          <RootStack.Screen name="FAQ" component={FAQScreen} options={{ title: 'FAQ' }} />
          <RootStack.Screen
            name="AssistantChat"
            component={AssistantChatScreen}
            options={{ title: t('assistant.title', 'Rendasua Assistant') }}
          />
          <RootStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
          <RootStack.Screen name="ThreadDetail" component={ThreadDetailScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="SupportTickets" component={SupportTicketsScreen} options={{ title: 'Mes tickets' }} />
          <RootStack.Screen
            name="AgentLocationTracking"
            component={AgentLocationTrackingScreen}
            options={{ title: 'Delivery tracking' }}
          />
          <RootStack.Screen
            name="NotificationPermission"
            component={NotificationPermissionScreen}
            options={{ title: t('notifications.permission.title', 'Stay in the loop') }}
          />
          <RootStack.Screen
            name="NotificationsCenter"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
        </RootStack.Navigator>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
