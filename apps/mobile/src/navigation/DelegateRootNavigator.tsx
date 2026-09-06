import React, { useEffect, useLayoutEffect } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OrderMessageHeaderButton } from '@/components/orders/OrderMessageHeaderButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { DelegateOrdersApiProvider } from '@/contexts/OrdersApiContext';
import { BusinessOrdersListView } from '@/screens/business/BusinessOrdersListScreen';
import OrderDetailBusinessView from '@/screens/business/OrderDetailBusinessView';
import UserOrderMessagesScreen from '@/screens/shared/UserOrderMessagesScreen';
import { PersonaQuickSwitch } from '@/components/persona/PersonaQuickSwitch';
import { LogoutAccountSheet } from '@/components/auth/LogoutAccountSheet';
import { useLogoutAccountSheet } from '@/hooks/useLogoutAccountSheet';
import { MenuLanguageSwitcher } from '@/components/menu/MenuLanguageSwitcher';
import { UserMenuRow } from '@/components/common/UserMenuRow';
import { UserMenuSection } from '@/components/common/UserMenuSection';
import useCheckNotificationPermissionOnStart from '@/hooks/useCheckNotificationPermissionOnStart';
import { useMainTabContentBottomPadding } from '@/hooks/useMainTabContentBottomPadding';
import type {
  DelegateMainTabParamList,
  DelegateRootStackParamList,
} from './types';

const Tab = createBottomTabNavigator<DelegateMainTabParamList>();
const RootStack = createNativeStackNavigator<DelegateRootStackParamList>();

export type { DelegateAppNavScreen, DelegateMainTabParamList, DelegateRootStackParamList } from './types';

function DelegateOrdersListScreen({
  navigation,
}: NativeStackScreenProps<DelegateRootStackParamList, 'DelegateOrdersList'>) {
  return (
    <BusinessOrdersListView
      onOpenOrder={(orderId) => navigation.navigate('DelegateOrderDetail', { orderId })}
    />
  );
}

function DelegateOrderDetailScreen(
  props: NativeStackScreenProps<DelegateRootStackParamList, 'DelegateOrderDetail'>
) {
  const { navigation, route } = props;
  const { orderId, openMessages, highlightMessageId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.orders.detailTitle', 'Order'),
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginLeft: 8, paddingVertical: 4, justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      ),
      headerRight: () => (
        <OrderMessageHeaderButton
          onPress={() =>
            navigation.navigate('OrderMessages', {
              orderId,
              highlightMessageId,
            })
          }
        />
      ),
    });
  }, [navigation, t, colors.text.primary, orderId, highlightMessageId]);

  useEffect(() => {
    if (!openMessages) return;
    navigation.setParams({ openMessages: undefined });
    navigation.navigate('OrderMessages', { orderId, highlightMessageId });
  }, [openMessages, orderId, highlightMessageId, navigation]);

  return <OrderDetailBusinessView {...props} />;
}

function DelegateOrdersTabScreen({
  navigation,
}: {
  navigation: { getParent: () => { navigate: (name: string, params?: object) => void } | undefined };
}) {
  const parent = navigation.getParent();
  const tabPad = useMainTabContentBottomPadding(24);
  return (
    <View style={{ flex: 1, paddingBottom: tabPad }}>
      <BusinessOrdersListView
        onOpenOrder={(orderId) =>
          parent?.navigate('DelegateOrderDetail', { orderId })
        }
      />
    </View>
  );
}

const DelegateMenuTabScreen = observer(function DelegateMenuTabScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const { persona } = useStore();
  const insets = useSafeAreaInsets();
  const logoutSheet = useLogoutAccountSheet();
  const grant = persona.activeDelegation;

  return (
    <View
      style={[
        styles.menu,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      {grant ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.overline, { color: colors.text.secondary }]}>
            {t('delegation.activeContext', 'Managing location')}
          </Text>
          <Text style={[typography.h5, { color: colors.text.primary, marginTop: 4 }]}>
            {grant.locationName}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 2 }]}>
            {grant.businessName}
            {grant.role?.name ? ` · ${grant.role.name}` : ''}
          </Text>
        </View>
      ) : null}

      <PersonaQuickSwitch />

      <UserMenuSection title={t('menuTab.sections.settings', 'Settings')}>
        <MenuLanguageSwitcher />
      </UserMenuSection>

      <UserMenuRow
        icon="logout"
        label={t('persona.logout', 'Log out')}
        onPress={logoutSheet.open}
      />
      <LogoutAccountSheet
        visible={logoutSheet.visible}
        displayName={logoutSheet.displayName}
        loading={logoutSheet.busy}
        onKeepOnDevice={() => void logoutSheet.keep()}
        onRemoveCompletely={() => void logoutSheet.remove()}
        onDismiss={logoutSheet.dismiss}
      />
    </View>
  );
});

function DelegateMainTabsScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const tabBarVerticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const tabBarHeightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = tabBarHeightBase + bottomInset + tabBarVerticalPadding / 2;
  useCheckNotificationPermissionOnStart();

  return (
    <Tab.Navigator
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
        },
        tabBarLabelStyle: typography.caption,
      }}
    >
      <Tab.Screen
        name="DelegateOrders"
        component={DelegateOrdersTabScreen}
        options={{
          title: t('business.orders.title', 'Orders'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DelegateMenu"
        component={DelegateMenuTabScreen}
        options={{
          title: t('business.tabs.menu', 'Menu'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function DelegateRootNavigatorInner() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { persona } = useStore();
  const grant = persona.activeDelegation;
  const headerTitle = grant
    ? `${grant.locationName} · ${grant.businessName}`
    : t('business.orders.title', 'Orders');

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.pageBackground },
        headerTintColor: colors.text.primary,
        headerTitleStyle: typography.h6,
      }}
    >
      <RootStack.Screen
        name="DelegateMainTabs"
        component={DelegateMainTabsScreen}
        options={{
          headerShown: true,
          title: headerTitle,
        }}
      />
      <RootStack.Screen
        name="DelegateOrdersList"
        component={DelegateOrdersListScreen}
        options={{ title: t('business.orders.title', 'Orders') }}
      />
      <RootStack.Screen
        name="DelegateOrderDetail"
        component={DelegateOrderDetailScreen}
        options={{
          title: t('business.orders.detailTitle', 'Order'),
          headerBackTitle: t('business.orders.title', 'Orders'),
        }}
      />
      <RootStack.Screen
        name="OrderMessages"
        component={UserOrderMessagesScreen}
        options={{
          title: t('messages.orderMessages', 'Order messages'),
          headerBackTitle: t('business.orders.detailTitle', 'Order'),
        }}
      />
    </RootStack.Navigator>
  );
}

export function DelegateRootNavigator() {
  return (
    <DelegateOrdersApiProvider>
      <View style={styles.wrapper}>
        <DelegateRootNavigatorInner />
      </View>
    </DelegateOrdersApiProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  menu: { flex: 1 },
});
