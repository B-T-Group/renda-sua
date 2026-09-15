import React from 'react';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import type { AuthStackParamList, GuestRootStackParamList, GuestTabParamList } from './types';
import GuestBrowseScreen from '../screens/guest/GuestBrowseScreen';
import GuestRentalsScreen from '../screens/guest/GuestRentalsScreen';
import LoginScreen from '../screens/shared/LoginScreen';
import SignupScreen from '../screens/shared/SignupScreen';
import ResetPasswordScreen from '../screens/shared/ResetPasswordScreen';
import OtpVerificationScreen from '../screens/shared/OtpVerificationScreen';
import AboutScreen from '../screens/shared/AboutScreen';
import DeveloperOptionsScreen from '../screens/shared/DeveloperOptionsScreen';
import SavedAccountsScreen from '../screens/shared/SavedAccountsScreen';
import InventoryItemDetailScreen from '../screens/shared/InventoryItemDetailScreen';
import CollectionDetailScreen from '../screens/shared/CollectionDetailScreen';
import StoresListScreen from '../screens/shared/StoresListScreen';
import StoreDetailScreen from '../screens/shared/StoreDetailScreen';
import CartScreen from '../screens/shared/CartScreen';
import RentalListingDetailScreen from '../screens/shared/RentalListingDetailScreen';
import ReelsFeedScreen from '../screens/shared/ReelsFeedScreen';
import {
  TabBarIconContent,
  useFloatingTabBarSafeAreaInsets,
  useTabBarScreenOptions,
} from './tabBarGeometry';
import { useClientFlags } from '../contexts/ClientFlagsContext';

const GuestTab = createBottomTabNavigator<GuestTabParamList>();
const GuestAuthStack = createNativeStackNavigator<AuthStackParamList>();
const GuestRootStack = createNativeStackNavigator<GuestRootStackParamList>();

/** Multi-step auth flows: hide guest tabs so the sticky footer owns the bottom edge. */
const AUTH_ROUTES_HIDE_TAB_BAR: Array<keyof AuthStackParamList> = [
  'Signup',
  'OtpVerification',
  'ResetPassword',
];

/** Keep these when returning to Sign in; reset everything else to Login. */
const AUTH_ROUTES_KEEP_ON_TAB: Array<keyof AuthStackParamList> = [
  'Login',
  'SavedAccounts',
];

function GuestAuthStackScreen({
  initialRouteName = 'Login',
  initialSignupParams,
}: {
  initialRouteName?: keyof AuthStackParamList;
  initialSignupParams?: AuthStackParamList['Signup'];
}) {
  return (
    <GuestAuthStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <GuestAuthStack.Screen
        name="SavedAccounts"
        component={SavedAccountsScreen}
        initialParams={{ mode: 'continue' }}
      />
      <GuestAuthStack.Screen name="Login" component={LoginScreen} />
      <GuestAuthStack.Screen
        name="Signup"
        component={SignupScreen}
        initialParams={initialSignupParams}
      />
      <GuestAuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <GuestAuthStack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <GuestAuthStack.Screen name="About" component={AboutScreen} />
      <GuestAuthStack.Screen name="DeveloperOptions" component={DeveloperOptionsScreen} />
    </GuestAuthStack.Navigator>
  );
}

function resetGuestAuthToLogin(navigation: {
  getState: () => {
    routes: Array<{
      name: string;
      state?: { key?: string; index?: number; routes: Array<{ name: string }> };
    }>;
  };
  dispatch: (action: object) => void;
}) {
  const authRoute = navigation.getState().routes.find((r) => r.name === 'GuestAuth');
  const nestedStack = authRoute?.state;
  if (!nestedStack?.key) return;
  const focusedName = nestedStack.routes[nestedStack.index ?? 0]?.name as
    | keyof AuthStackParamList
    | undefined;
  if (focusedName && AUTH_ROUTES_KEEP_ON_TAB.includes(focusedName)) return;
  navigation.dispatch({
    ...CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
    target: nestedStack.key,
  });
}

function GuestTabsNavigator({
  initialAuthRoute,
  initialSignupParams,
  preferBrowse,
}: {
  initialAuthRoute?: keyof AuthStackParamList;
  initialSignupParams?: AuthStackParamList['Signup'];
  /** When true, land on marketplace even if an auth route is also prepared. */
  preferBrowse?: boolean;
}) {
  const { t } = useTranslation();
  const tabBarScreenOptions = useTabBarScreenOptions();
  const floatingSafeAreaInsets = useFloatingTabBarSafeAreaInsets();
  const { flags } = useClientFlags();
  const visibleTabBarStyle = tabBarScreenOptions.tabBarStyle;

  const initialTab =
    preferBrowse || !initialAuthRoute ? 'GuestBrowse' : 'GuestAuth';

  return (
    <GuestTab.Navigator
      initialRouteName={initialTab}
      safeAreaInsets={floatingSafeAreaInsets}
      screenOptions={tabBarScreenOptions}
    >
      <GuestTab.Screen
        name="GuestBrowse"
        component={GuestBrowseScreen}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.setParams({ segment: 'all' }),
        })}
        options={{
          tabBarLabel: t('nav.guestTabs.browse', 'Items'),
          tabBarAccessibilityLabel: t('nav.guestTabs.browse', 'Items'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconContent focused={focused} label={t('nav.guestTabs.browse', 'Items')}>
              <MaterialCommunityIcons name={focused ? 'shopping' : 'shopping-outline'} size={24} color={color} />
            </TabBarIconContent>
          ),
        }}
      />
      <GuestTab.Screen
        name="GuestRentals"
        component={GuestRentalsScreen}
        options={{
          tabBarLabel: t('nav.guestTabs.rentals', 'Rentals'),
          tabBarAccessibilityLabel: t('nav.guestTabs.rentals', 'Rentals'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconContent focused={focused} label={t('nav.guestTabs.rentals', 'Rentals')}>
              <MaterialCommunityIcons name={focused ? 'calendar-clock' : 'calendar-clock-outline'} size={24} color={color} />
            </TabBarIconContent>
          ),
        }}
      />
      <GuestTab.Screen
        name="GuestFoods"
        listeners={({ navigation }) => ({
          focus: () => {
            if (flags.floating_nav_enabled) {
              navigation.navigate('GuestBrowse', { segment: 'food' });
            }
          },
        })}
        options={{
          tabBarLabel: t('nav.guestTabs.foods', 'Food'),
          tabBarAccessibilityLabel: t('nav.guestTabs.foods', 'Food'),
          tabBarButton: flags.floating_nav_enabled ? () => null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconContent focused={focused} label={t('nav.guestTabs.foods', 'Food')}>
              <MaterialCommunityIcons name={focused ? 'food' : 'food-outline'} size={24} color={color} />
            </TabBarIconContent>
          ),
        }}
      >
        {() => <GuestBrowseScreen foodOnly />}
      </GuestTab.Screen>
      {flags.reels_enabled ? (
        <GuestTab.Screen
          name="GuestReels"
          component={ReelsFeedScreen}
          options={{
            tabBarLabel: t('nav.guestTabs.reels', 'Reels'),
            tabBarAccessibilityLabel: t('nav.guestTabs.reels', 'Reels'),
            tabBarIcon: ({ color, focused }) => (
              <TabBarIconContent focused={focused} label={t('nav.guestTabs.reels', 'Reels')}>
                <MaterialCommunityIcons name={focused ? 'play-circle' : 'play-circle-outline'} size={24} color={color} />
              </TabBarIconContent>
            ),
          }}
        />
      ) : null}
      <GuestTab.Screen
        name="GuestAuth"
        listeners={({ navigation }) => ({
          tabPress: () => {
            resetGuestAuthToLogin(navigation);
          },
        })}
        options={({ route }) => {
          const focused =
            (getFocusedRouteNameFromRoute(route) as keyof AuthStackParamList | undefined) ??
            initialAuthRoute ??
            'Login';
          const hideTabBar = AUTH_ROUTES_HIDE_TAB_BAR.includes(focused);
          return {
            tabBarLabel: t('nav.guestTabs.login', 'Sign in'),
            tabBarAccessibilityLabel: t('nav.guestTabs.login', 'Sign in'),
            tabBarIcon: ({ color, focused: iconFocused }) => (
              <TabBarIconContent focused={iconFocused} label={t('nav.guestTabs.login', 'Sign in')}>
                <MaterialCommunityIcons
                  name={iconFocused ? 'account-circle' : 'account-circle-outline'}
                  size={24}
                  color={color}
                />
              </TabBarIconContent>
            ),
            tabBarStyle: hideTabBar ? { display: 'none' } : visibleTabBarStyle,
          };
        }}
      >
        {() => (
          <GuestAuthStackScreen
            initialRouteName={initialAuthRoute ?? 'Login'}
            initialSignupParams={initialSignupParams}
          />
        )}
      </GuestTab.Screen>
    </GuestTab.Navigator>
  );
}

export function GuestRootNavigator({
  initialAuthRoute,
  initialSignupParams,
  preferBrowse,
}: {
  initialAuthRoute?: keyof AuthStackParamList;
  initialSignupParams?: AuthStackParamList['Signup'];
  preferBrowse?: boolean;
} = {}) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  return (
    <View style={styles.flex}>
      <GuestRootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.text.primary,
          headerTitleStyle: typography.h6,
          headerShadowVisible: false,
        }}
      >
        <GuestRootStack.Screen
          name="GuestTabs"
          options={{
            headerShown: false,
            title: t('client.placeOrder.successScreen.backToHome', 'Home'),
          }}
        >
          {() => (
            <GuestTabsNavigator
              initialAuthRoute={initialAuthRoute}
              initialSignupParams={initialSignupParams}
              preferBrowse={preferBrowse}
            />
          )}
        </GuestRootStack.Screen>
        <GuestRootStack.Screen
          name="CollectionDetail"
          component={CollectionDetailScreen}
          options={{
            headerShown: true,
            title: t('collections.landing', 'Collection'),
          }}
        />
        <GuestRootStack.Screen
          name="StoresList"
          component={StoresListScreen}
          options={{
            headerShown: true,
            title: t('stores.listTitle', 'Store locations'),
          }}
        />
        <GuestRootStack.Screen
          name="StoreDetail"
          component={StoreDetailScreen}
          options={{
            headerShown: true,
            title: t('stores.detailTitle', 'Store'),
            headerBackTitle: t('stores.listTitle', 'Store locations'),
          }}
        />
        <GuestRootStack.Screen
          name="InventoryItemDetail"
          component={InventoryItemDetailScreen}
          options={{
            headerShown: true,
            title: t('public.items.detail.navTitle', 'Item'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
        <GuestRootStack.Screen
          name="RentalListingDetail"
          component={RentalListingDetailScreen}
          options={{
            headerShown: true,
            title: t('rentals.title', 'Rentals'),
            headerBackTitle: t('nav.guestTabs.rentals', 'Rentals'),
          }}
        />
        <GuestRootStack.Screen
          name="Cart"
          component={CartScreen}
          options={{
            title: t('cart.title', 'Cart'),
            headerBackTitle: t('public.items.detail.browseMore', 'Browse more items'),
          }}
        />
      </GuestRootStack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
