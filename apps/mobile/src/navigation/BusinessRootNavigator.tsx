import React from 'react';
import { useTranslation } from 'react-i18next';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

import BusinessDashboardScreen from '../screens/business/BusinessDashboardScreen';
import BusinessMenuTabScreen from '../screens/business/BusinessMenuTabScreen';
import BusinessOrdersListScreen from '../screens/business/BusinessOrdersListScreen';
import BusinessCatalogTabScreen from '../screens/business/BusinessCatalogTabScreen';
import BusinessOrderDetailScreen from '../screens/business/BusinessOrderDetailScreen';
import BusinessPickupPaymentAwaitingScreen from '../screens/business/BusinessPickupPaymentAwaitingScreen';
import UserOrderMessagesScreen from '../screens/shared/UserOrderMessagesScreen';
import BusinessFailedDeliveriesListScreen from '../screens/business/BusinessFailedDeliveriesListScreen';
import BusinessRefundsListScreen from '../screens/business/BusinessRefundsListScreen';
import BusinessLocationsListScreen from '../screens/business/BusinessLocationsListScreen';
import BusinessTeamScreen from '../screens/business/BusinessTeamScreen';
import BusinessLocationFormScreen from '../screens/business/BusinessLocationFormScreen';
import BusinessLocationHoursScreen from '../screens/business/BusinessLocationHoursScreen';
import BusinessItemsListScreen from '../screens/business/BusinessItemsListScreen';
import BusinessAddItemFromImageScreen from '../screens/business/BusinessAddItemFromImageScreen';
import BusinessMerchantAgreementScreen from '../screens/business/BusinessMerchantAgreementScreen';
import BusinessSetupStepSuccessScreen from '../screens/business/BusinessSetupStepSuccessScreen';
import ConfigurePaymentsScreen from '../screens/shared/ConfigurePaymentsScreen';
import UserMobilePaymentPhonesScreen from '../screens/shared/UserMobilePaymentPhonesScreen';
import BusinessItemDetailScreen from '../screens/business/BusinessItemDetailScreen';
import BusinessItemFormScreen from '../screens/business/BusinessItemFormScreen';
import BusinessItemFulfillmentScreen from '../screens/business/BusinessItemFulfillmentScreen';
import BusinessRentalsStudioScreen from '../screens/business/BusinessRentalsStudioScreen';
import BusinessProductInterestScreen from '../screens/business/BusinessProductInterestScreen';
import BusinessAddRentalFromImageScreen from '../screens/business/BusinessAddRentalFromImageScreen';
import BusinessRentalItemDetailScreen from '../screens/business/BusinessRentalItemDetailScreen';
import BusinessRentalItemEditScreen from '../screens/business/BusinessRentalItemEditScreen';
import BusinessRentalAddListingScreen from '../screens/business/BusinessRentalAddListingScreen';
import BusinessRentalBookingDetailScreen from '../screens/business/BusinessRentalBookingDetailScreen';
import AdminRentalListingsModerationScreen from '../screens/business/AdminRentalListingsModerationScreen';
import AdminRentalAiReviewsScreen from '../screens/business/AdminRentalAiReviewsScreen';
import BusinessRentalAiProposalScreen from '../screens/business/BusinessRentalAiProposalScreen';
import AdminItemModerationScreen from '../screens/business/AdminItemModerationScreen';
import AdminItemAiReviewsScreen from '../screens/business/AdminItemAiReviewsScreen';
import AdminItemsBrowserScreen from '../screens/business/AdminItemsBrowserScreen';
import AdminItemDetailScreen from '../screens/business/AdminItemDetailScreen';
import AdminBusinessesListScreen from '../screens/business/AdminBusinessesListScreen';
import AdminBusinessVerificationScreen from '../screens/business/AdminBusinessVerificationScreen';
import AdminPerformanceScreen from '../screens/business/AdminPerformanceScreen';
import BusinessReferralReviewScreen from '../screens/business/BusinessReferralReviewScreen';
import BusinessReferredBusinessesScreen from '../screens/business/BusinessReferredBusinessesScreen';
import AdminUsersScreen from '../screens/business/AdminUsersScreen';
import AdminBroadcastsScreen from '../screens/business/AdminBroadcastsScreen';
import AdminWhatsAppInboxScreen from '../screens/business/AdminWhatsAppInboxScreen';
import AdminWhatsAppConversationScreen from '../screens/business/AdminWhatsAppConversationScreen';
import AdminOrdersScreen from '../screens/business/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/business/AdminOrderDetailScreen';
import AdminCreditsScreen from '../screens/business/AdminCreditsScreen';
import AccountRechargeScreen from '../screens/business/AccountRechargeScreen';
import BusinessItemAiProposalScreen from '../screens/business/BusinessItemAiProposalScreen';
import BusinessAiImageCleanupReviewScreen from '../screens/business/BusinessAiImageCleanupReviewScreen';
import BusinessStockAvailabilityConfirmScreen from '../screens/business/BusinessStockAvailabilityConfirmScreen';
import BusinessClientCitiesScreen from '../screens/business/BusinessClientCitiesScreen';
import BusinessInsightsScreen from '../screens/business/BusinessInsightsScreen';
import BusinessAiTokensScreen from '../screens/business/BusinessAiTokensScreen';
import BusinessAccountTypeScreen from '../screens/business/BusinessAccountTypeScreen';
import UserAccountsScreen from '../screens/shared/UserAccountsScreen';
import StoresListScreen from '../screens/shared/StoresListScreen';
import StoreDetailScreen from '../screens/shared/StoreDetailScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationPreferencesScreen from '../screens/shared/NotificationPreferencesScreen';
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
import { EnrollPersonaExplainScreen } from '../screens/shared/enroll/EnrollPersonaExplainScreen';
import { EnrollPersonaSetupScreen } from '../screens/shared/enroll/EnrollPersonaSetupScreen';
import { EnrollPersonaSuccessScreen } from '../screens/shared/enroll/EnrollPersonaSuccessScreen';

import type { BusinessMainTabParamList, BusinessRootStackParamList } from './types';
import { usePersonaAttentionBadge } from '../hooks/usePersonaAttentionBadge';
import { useAppIconBadge } from '../hooks/useAppIconBadge';
import useCheckNotificationPermissionOnStart from '../hooks/useCheckNotificationPermissionOnStart';
import { useBusinessActiveOrders } from '../hooks/business/useBusinessActiveOrders';
import { useProfileMe } from '../hooks/useProfileMe';
import { OwnerOrdersApiProvider } from '../contexts/OrdersApiContext';

const Tab = createBottomTabNavigator<BusinessMainTabParamList>();
const RootStack = createNativeStackNavigator<BusinessRootStackParamList>();

export type { BusinessAppNavScreen, BusinessMainTabParamList, BusinessRootStackParamList } from './types';

function BusinessMainTabsScreen() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const tabBarVerticalPadding = Platform.OS === 'ios' ? 20 : 10;
  const tabBarHeightBase = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = tabBarHeightBase + bottomInset + tabBarVerticalPadding / 2;
  const { totalCount: attentionBadgeCount, appIconBadgeCount } =
    usePersonaAttentionBadge('business');
  const { activeCount: activeOrdersCount } = useBusinessActiveOrders({
    pollWhileFocused: false,
  });
  const { me } = useProfileMe();
  const isRentalFocused = me?.business?.main_interest === 'rent_items';
  useAppIconBadge(appIconBadgeCount);
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
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tab.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreen}
        options={{
          title: t('business.tabs.dashboard', 'Home'),
          tabBarLabel: t('business.tabs.dashboard', 'Home'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarBadge: attentionBadgeCount > 0 ? attentionBadgeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error.main, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="BusinessOrders"
        component={BusinessOrdersListScreen}
        options={{
          headerShown: true,
          title: t('business.orders.title', 'Orders'),
          tabBarLabel: t('business.tabs.orders', 'Orders'),
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.text.primary,
          headerTitleStyle: typography.h6,
          headerShadowVisible: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'clipboard-text' : 'clipboard-text-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarBadge: activeOrdersCount > 0 ? activeOrdersCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error.main, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="BusinessCatalog"
        component={BusinessCatalogTabScreen}
        options={{
          headerShown: true,
          title: isRentalFocused
            ? t('business.tabs.rentals', 'Rentals')
            : t('business.tabs.items', 'Items'),
          tabBarLabel: isRentalFocused
            ? t('business.tabs.rentals', 'Rentals')
            : t('business.tabs.items', 'Items'),
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.text.primary,
          headerTitleStyle: typography.h6,
          headerShadowVisible: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={
                isRentalFocused
                  ? focused
                    ? 'calendar-clock'
                    : 'calendar-clock-outline'
                  : focused
                    ? 'package-variant'
                    : 'package-variant-closed'
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="BusinessMenu"
        component={BusinessMenuTabScreen}
        options={{
          title: t('business.tabs.menu', 'Menu'),
          tabBarLabel: t('business.tabs.menu', 'Menu'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'menu' : 'menu-open'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function BusinessRootNavigator() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  return (
    <OwnerOrdersApiProvider>
    <View style={styles.wrapper}>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.text.primary,
          headerTitleStyle: typography.h6,
        }}
      >
        <RootStack.Screen
          name="BusinessMainTabs"
          component={BusinessMainTabsScreen}
          options={{
            headerShown: false,
            // Used as the iOS back-button label on stack screens pushed from tabs.
            title: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessOrdersList"
          component={BusinessOrdersListScreen}
          options={{
            title: t('business.orders.title', 'Orders'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessOrderDetail"
          component={BusinessOrderDetailScreen}
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
        <RootStack.Screen
          name="BusinessPickupPaymentAwaiting"
          component={BusinessPickupPaymentAwaitingScreen}
          options={{
            title: t('business.pickup.momoNavTitle', 'Waiting for payment'),
            headerBackTitle: t('business.orders.detailTitle', 'Order'),
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <RootStack.Screen
          name="BusinessFailedDeliveriesList"
          component={BusinessFailedDeliveriesListScreen}
          options={{
            title: t('business.failedDeliveries.title', 'Failed deliveries'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessRefundsList"
          component={BusinessRefundsListScreen}
          options={{
            title: t('orders.refunds.centerTitle', 'Refund Center'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessLocationsList"
          component={BusinessLocationsListScreen}
          options={{
            title: t('business.locations.title', 'Locations'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessTeam"
          component={BusinessTeamScreen}
          options={{
            title: t('delegation.team.title', 'Team'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessLocationForm"
          component={BusinessLocationFormScreen}
          options={({ route }) => ({
            title: route.params?.locationId
              ? t('business.locations.editTitle', 'Edit location')
              : t('business.locations.addTitle', 'Add location'),
            headerBackTitle: t('business.locations.title', 'Locations'),
          })}
        />
        <RootStack.Screen
          name="BusinessLocationHours"
          component={BusinessLocationHoursScreen}
          options={{
            title: t('business.locations.operatingHours.title', 'Operating hours'),
            headerBackTitle: t('business.locations.title', 'Locations'),
          }}
        />
        <RootStack.Screen
          name="BusinessItemsList"
          component={BusinessItemsListScreen}
          options={{
            title: t('business.items.title', 'Items'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessAddItemFromImage"
          component={BusinessAddItemFromImageScreen}
          options={{
            headerShown: false,
            title: t('business.items.addFromImage', 'Add from image'),
          }}
        />
        <RootStack.Screen
          name="BusinessItemDetail"
          component={BusinessItemDetailScreen}
          options={{
            title: t('business.items.detailTitle', 'Item'),
            headerBackTitle: t('business.items.title', 'Items'),
          }}
        />
        <RootStack.Screen
          name="BusinessItemForm"
          component={BusinessItemFormScreen}
          options={{
            title: t('business.items.editItem', 'Edit Item'),
            headerBackTitle: t('business.items.title', 'Items'),
          }}
        />
        <RootStack.Screen
          name="BusinessItemFulfillment"
          component={BusinessItemFulfillmentScreen}
          options={{
            title: t('business.items.fulfillment.navTitle', 'Fulfillment'),
            headerBackTitle: t('business.items.title', 'Items'),
          }}
        />
        <RootStack.Screen
          name="BusinessItemAiProposal"
          component={BusinessItemAiProposalScreen}
          options={{
            title: t('business.items.aiProposal.title', 'Review AI suggestions'),
            headerBackTitle: t('business.items.title', 'Items'),
          }}
        />
        <RootStack.Screen
          name="BusinessAiImageCleanupReview"
          component={BusinessAiImageCleanupReviewScreen}
          options={{
            title: t('business.images.asyncCleanup.reviewTitle', 'Review cleaned photos'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessStockAvailabilityConfirm"
          component={BusinessStockAvailabilityConfirmScreen}
          options={{
            title: t('business.availability.navTitle', 'Stock availability'),
            presentation: 'modal',
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalsStudio"
          component={BusinessRentalsStudioScreen}
          options={{
            title: t('business.rentals.studioTitle', 'Rentals'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessProductInterest"
          component={BusinessProductInterestScreen}
          options={{
            title: t('productInterest.businessTitle', 'Product interest'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessAddRentalFromImage"
          component={BusinessAddRentalFromImageScreen}
          options={{
            headerShown: false,
            title: t('business.rentals.addFromImage', 'Add rental from image'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalItemDetail"
          component={BusinessRentalItemDetailScreen}
          options={{
            title: t('business.rentals.detailTitle', 'Rental'),
            headerBackTitle: t('business.rentals.studioTitle', 'Rentals'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalItemEdit"
          component={BusinessRentalItemEditScreen}
          options={{
            title: t('business.rentals.editTitle', 'Edit rental'),
            headerBackTitle: t('business.rentals.detailTitle', 'Rental'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalAddListing"
          component={BusinessRentalAddListingScreen}
          options={{
            title: t('business.rentals.addListing', 'Add location listing'),
            headerBackTitle: t('business.rentals.detailTitle', 'Rental'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalAiProposal"
          component={BusinessRentalAiProposalScreen}
          options={{
            title: t('business.rentals.aiProposal.title', 'Review AI suggestions'),
            headerBackTitle: t('business.rentals.studioTitle', 'Rentals'),
          }}
        />
        <RootStack.Screen
          name="BusinessRentalBookingDetail"
          component={BusinessRentalBookingDetailScreen}
          options={{
            title: t('business.rentals.bookingTitle', 'Booking'),
            headerBackTitle: t('business.rentals.studioTitle', 'Rentals'),
          }}
        />
        <RootStack.Screen
          name="AdminRentalListingsModeration"
          component={AdminRentalListingsModerationScreen}
          options={{
            title: t('admin.rentals.moderation.title', 'Rental listing moderation'),
          }}
        />
        <RootStack.Screen
          name="AdminRentalAiReviews"
          component={AdminRentalAiReviewsScreen}
          options={{
            title: t('admin.rentals.aiReviews.title', 'AI review decisions'),
          }}
        />
        <RootStack.Screen
          name="AdminItemModeration"
          component={AdminItemModerationScreen}
          options={{
            title: t('admin.items.moderation.title', 'Sale item moderation'),
          }}
        />
        <RootStack.Screen
          name="AdminItemAiReviews"
          component={AdminItemAiReviewsScreen}
          options={{
            title: t('admin.items.aiReviews.title', 'Sale item AI reviews'),
          }}
        />
        <RootStack.Screen
          name="AdminItemsBrowser"
          component={AdminItemsBrowserScreen}
          options={{
            title: t('admin.itemsBrowser.title', 'All items'),
          }}
        />
        <RootStack.Screen
          name="AdminItemDetail"
          component={AdminItemDetailScreen}
          options={{
            title: t('admin.itemsBrowser.detailTitle', 'Item details'),
          }}
        />
        <RootStack.Screen
          name="AdminBusinessesList"
          component={AdminBusinessesListScreen}
          options={{
            title: t('admin.businesses.title', 'Business verification'),
          }}
        />
        <RootStack.Screen
          name="AdminBusinessVerification"
          component={AdminBusinessVerificationScreen}
          options={{
            title: t('admin.businesses.verificationTitle', 'Business verification'),
          }}
        />
        <RootStack.Screen
          name="AdminPerformance"
          component={AdminPerformanceScreen}
          options={{
            title: t('admin.performance.title', 'Platform performance'),
          }}
        />
        <RootStack.Screen
          name="BusinessReferralReview"
          component={BusinessReferralReviewScreen}
          options={{
            title: t('admin.referralReview.title', 'Referral payout review'),
          }}
        />
        <RootStack.Screen
          name="BusinessReferredBusinesses"
          component={BusinessReferredBusinessesScreen}
          options={{
            title: t('referrals.followUp.listTitle', 'Referred businesses'),
          }}
        />
        <RootStack.Screen
          name="AdminUsers"
          component={AdminUsersScreen}
          options={{ title: t('admin.users.title', 'Manage users') }}
        />
        <RootStack.Screen
          name="AdminBroadcasts"
          component={AdminBroadcastsScreen}
          options={{ title: t('admin.broadcasts.title', 'Global messaging') }}
        />
        <RootStack.Screen
          name="AdminWhatsAppInbox"
          component={AdminWhatsAppInboxScreen}
          options={{ title: t('admin.whatsappInbox.title', 'WhatsApp inbox') }}
        />
        <RootStack.Screen
          name="AdminWhatsAppConversation"
          component={AdminWhatsAppConversationScreen}
          options={{
            title: t('admin.whatsappInbox.conversationTitle', 'Conversation'),
          }}
        />
        <RootStack.Screen
          name="AdminOrders"
          component={AdminOrdersScreen}
          options={{ title: t('admin.orders.title', 'Order operations') }}
        />
        <RootStack.Screen
          name="AdminOrderDetail"
          component={AdminOrderDetailScreen}
          options={{ title: t('admin.orders.detailTitle', 'Order intervention') }}
        />
        <RootStack.Screen
          name="AdminCredits"
          component={AdminCreditsScreen}
          options={{ title: t('admin.credits.pageTitle', 'Ops follow-ups') }}
        />
        <RootStack.Screen
          name="AccountRecharge"
          component={AccountRechargeScreen}
          options={{ title: t('admin.accountRecharge.screenTitle', 'HQ Account Recharge') }}
        />
        <RootStack.Screen name="Profile" component={ProfileScreen} options={{
          title: t('menuTab.profile', 'Profile'),
          headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
        }} />
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
          options={{
            title: t('enrollPersona.navTitle', 'Add a role'),
            headerBackTitle: t('menuTab.profile', 'Profile'),
          }}
        />
        <RootStack.Screen
          name="EnrollPersonaSetup"
          component={EnrollPersonaSetupScreen}
          options={{
            title: t('enrollPersona.setup.navTitle', 'Setup'),
            headerBackTitle: t('enrollPersona.navTitle', 'Add a role'),
          }}
        />
        <RootStack.Screen
          name="EnrollPersonaSuccess"
          component={EnrollPersonaSuccessScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <RootStack.Screen
          name="BusinessMerchantAgreement"
          component={BusinessMerchantAgreementScreen}
          options={{
            title: t('business.verification.agreementTitle', 'Merchant agreement'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessSetupStepSuccess"
          component={BusinessSetupStepSuccessScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <RootStack.Screen
          name="BusinessConfigurePayments"
          component={ConfigurePaymentsScreen}
          options={{
            title: t('payments.configureTitle', 'Payments'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessMobilePaymentPhones"
          component={UserMobilePaymentPhonesScreen}
          options={{
            title: t('mobilePaymentPhone.manageTitle', 'Mobile money numbers'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="Documents"
          component={DocumentsScreen}
          options={{
            title: t('nav.documents', 'Documents'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="Terms"
          component={TermsScreen}
          options={{
            title: t('nav.terms', 'Terms of Service'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="Privacy"
          component={PrivacyPolicyScreen}
          options={{
            title: t('nav.privacy', 'Privacy Policy'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="FAQ"
          component={FAQScreen}
          options={{
            title: t('nav.faq', 'FAQ'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="AssistantChat"
          component={AssistantChatScreen}
          options={{
            title: t('assistant.title', 'Rendasua Assistant'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessAccounts"
          component={UserAccountsScreen}
          options={{
            title: t('business.accounts.navTitle', 'Wallet'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessAiTokens"
          component={BusinessAiTokensScreen}
          options={{
            title: t('business.tokens.navTitle', 'AI tokens'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessAccountTypeScreen"
          component={BusinessAccountTypeScreen}
          options={{
            title: t('business.accountType.pageTitle', 'Account & Plan'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessClientCities"
          component={BusinessClientCitiesScreen}
          options={{
            title: t('business.clientCities.navTitle', 'Where your clients are from'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="BusinessInsights"
          component={BusinessInsightsScreen}
          options={{
            title: t('business.insights.navTitle', 'Store insights'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="StoresList"
          component={StoresListScreen}
          options={{
            title: t('stores.listTitle', 'Store locations'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="StoreDetail"
          component={StoreDetailScreen}
          options={{
            title: t('stores.detailTitle', 'Store'),
            headerBackTitle: t('stores.listTitle', 'Store locations'),
          }}
        />
        <RootStack.Screen
          name="Messages"
          component={MessagesScreen}
          options={{
            title: t('nav.messages', 'Messages'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="ThreadDetail"
          component={ThreadDetailScreen}
          options={{
            headerShown: false,
            title: t('nav.messages', 'Messages'),
          }}
        />
        <RootStack.Screen
          name="SupportTickets"
          component={SupportTicketsScreen}
          options={{
            title: t('nav.supportTickets', 'My tickets'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="NotificationPermission"
          component={NotificationPermissionScreen}
          options={{
            title: t('notifications.permission.title', 'Stay in the loop'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
        <RootStack.Screen
          name="NotificationsCenter"
          component={NotificationsScreen}
          options={{
            title: t('notifications.center.title', 'Notifications'),
            headerBackTitle: t('business.tabs.dashboard', 'Dashboard'),
          }}
        />
      </RootStack.Navigator>
    </View>
    </OwnerOrdersApiProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
