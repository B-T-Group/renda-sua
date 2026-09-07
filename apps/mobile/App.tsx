import './src/i18n';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ApolloProvider } from '@apollo/client';
import { SystemBars } from 'react-native-edge-to-edge';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { StripeAppProvider } from './src/components/payments/StripeAppProvider';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { RootStore, RootStoreProvider } from './src/stores/RootStore';
import { client } from './src/services/apolloClient';
import { useExpoUpdatesOnStartup } from './src/hooks/useExpoUpdatesOnStartup';
import { AgentActiveDeliveryProvider } from './src/contexts/AgentActiveDeliveryContext';
import { AgentLocationProvider, useAgentLocation } from './src/contexts/AgentLocationContext';
import { AgentBackgroundLocationDisclosureDialog } from './src/components/agent/AgentBackgroundLocationDisclosureDialog';
import { useNotificationOpenedOrderNavigation } from './src/hooks/useNotificationOpenedOrderNavigation';
import { useNotificationOpenedThreadNavigation } from './src/hooks/useNotificationOpenedThreadNavigation';
import { useNotificationOpenedRentalNavigation } from './src/hooks/useNotificationOpenedRentalNavigation';
import { useNotificationOpenedLocationTransferNavigation } from './src/hooks/useNotificationOpenedLocationTransferNavigation';
import { useNotificationOpenedAiImageCleanupNavigation } from './src/hooks/useNotificationOpenedAiImageCleanupNavigation';
import { useNotificationOpenedMerchantEngagementNavigation } from './src/hooks/useNotificationOpenedMerchantEngagementNavigation';
import { useNotificationOpenedAiProposalNavigation } from './src/hooks/useNotificationOpenedAiProposalNavigation';
import { useNotificationOpenedIdDocumentNavigation } from './src/hooks/useNotificationOpenedIdDocumentNavigation';
import { useNotificationOpenedStockAvailabilityResultNavigation } from './src/hooks/useNotificationOpenedStockAvailabilityResultNavigation';
import { useNotificationOpenedAdminOrderNavigation } from './src/hooks/useNotificationOpenedAdminOrderNavigation';
import { useNotificationOpenedWhatsAppInboxNavigation } from './src/hooks/useNotificationOpenedWhatsAppInboxNavigation';
import { useNotificationInterrupts } from './src/hooks/useNotificationInterrupts';
import { useAdminBroadcastNotifications } from './src/hooks/useAdminBroadcastNotifications';
import { useReferralRejectionNotifications } from './src/hooks/useReferralRejectionNotifications';
import { usePickupReminderNotifications } from './src/hooks/usePickupReminderNotifications';
import { useStorePickupReminderNotifications } from './src/hooks/useStorePickupReminderNotifications';
import { useAppDeepLinkNavigation } from './src/hooks/useAppDeepLinkNavigation';
import { useAuthForegroundRefresh } from './src/hooks/useAuthForegroundRefresh';
import usePushTokenRegistration from './src/hooks/usePushTokenRegistration';
import AppNavigator from './src/navigation/AppNavigator';
import MaintenanceScreen from './src/screens/shared/MaintenanceScreen';
import { MAINTENANCE_MODE } from './src/config/maintenance';
import { OrderOfferOverlay } from './src/components/orderOffer/OrderOfferOverlay';
import { IncomingOrderOverlay } from './src/components/incomingOrder/IncomingOrderOverlay';
import { StockAvailabilityOverlay } from './src/components/stockAvailability/StockAvailabilityOverlay';
import { AdminBroadcastOverlay } from './src/components/admin/AdminBroadcastOverlay';
import { ReferralRejectionOverlay } from './src/components/agent/ReferralRejectionOverlay';
import { PickupReminderOverlay } from './src/components/agent/PickupReminderOverlay';
import { StorePickupReminderOverlay } from './src/components/client/StorePickupReminderOverlay';
import { rootNavigationRef } from './src/navigation/rootNavigationRef';

const rootStore = new RootStore();

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.pageBackground }]}>
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}

function AppContentBase() {
  const [hydrated, setHydrated] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const { navigationTheme } = useTheme();

  useExpoUpdatesOnStartup();
  useAuthForegroundRefresh();
  usePushTokenRegistration();
  useNotificationOpenedOrderNavigation(navReady);
  useNotificationOpenedRentalNavigation(navReady);
  useNotificationOpenedLocationTransferNavigation(navReady);
  useNotificationOpenedAiImageCleanupNavigation(navReady);
  useNotificationOpenedMerchantEngagementNavigation(navReady);
  useNotificationOpenedAiProposalNavigation(navReady);
  useNotificationOpenedIdDocumentNavigation(navReady);
  useNotificationOpenedStockAvailabilityResultNavigation(navReady);
  useNotificationOpenedThreadNavigation(navReady);
  useNotificationOpenedAdminOrderNavigation(navReady);
  useNotificationOpenedWhatsAppInboxNavigation(navReady);
  useNotificationInterrupts(navReady);
  useAdminBroadcastNotifications(navReady);
  useReferralRejectionNotifications(navReady);
  usePickupReminderNotifications(navReady);
  useStorePickupReminderNotifications(navReady);
  useAppDeepLinkNavigation(navReady);

  useEffect(() => {
    if (MAINTENANCE_MODE) return;
    rootStore.hydrate().then(() => setHydrated(true));
  }, []);

  if (MAINTENANCE_MODE) {
    return (
      <SafeAreaProvider>
        <MaintenanceScreen />
      </SafeAreaProvider>
    );
  }

  if (!hydrated) return <LoadingScreen />;

  // StripeAppProvider must mount *after* env hydrate so DEVELOPMENT does not
  // briefly call prod.api (getEnv() defaults to prod until AsyncStorage loads).
  return (
    <StripeAppProvider>
      <AgentActiveDeliveryProvider>
        <AgentLocationProvider>
          <AgentLocationDialogs />
          <SafeAreaProvider>
            <NavigationContainer
              ref={rootNavigationRef}
              theme={navigationTheme}
              onReady={() => setNavReady(true)}
            >
              <AppNavigator />
            </NavigationContainer>
            <OrderOfferOverlay />
            <IncomingOrderOverlay />
            <StockAvailabilityOverlay />
            <AdminBroadcastOverlay />
            <ReferralRejectionOverlay />
            <PickupReminderOverlay />
            <StorePickupReminderOverlay />
          </SafeAreaProvider>
        </AgentLocationProvider>
      </AgentActiveDeliveryProvider>
    </StripeAppProvider>
  );
}

function AgentLocationDialogs() {
  const {
    disclosureVisible,
    disclosurePermissionLoading,
    onDisclosureContinue,
  } = useAgentLocation();
  return (
    <AgentBackgroundLocationDisclosureDialog
      visible={disclosureVisible}
      permissionLoading={disclosurePermissionLoading}
      onContinue={onDisclosureContinue}
    />
  );
}

const AppContent = observer(AppContentBase);

function ThemedProviders({ children }: { children: React.ReactNode }) {
  const { paperTheme, isDark } = useTheme();
  return (
    <PaperProvider theme={paperTheme}>
      {children}
      <SystemBars style={isDark ? 'light' : 'dark'} />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <RootStoreProvider store={rootStore}>
        <ThemeProvider>
          <ApolloProvider client={client}>
            <ThemedProviders>
              <AppContent />
            </ThemedProviders>
          </ApolloProvider>
        </ThemeProvider>
      </RootStoreProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
