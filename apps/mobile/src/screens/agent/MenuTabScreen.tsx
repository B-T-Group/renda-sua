import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useManualAppUpdateCheck } from '../../hooks/useManualAppUpdateCheck';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { MenuLanguageSwitcher } from '../../components/menu/MenuLanguageSwitcher';
import { MenuThemeSwitcher } from '../../components/menu/MenuThemeSwitcher';
import { PersonaQuickSwitch } from '../../components/persona/PersonaQuickSwitch';
import { TabAwareSnackbar } from '../../components/feedback/TabAwareSnackbar';
import { UserMenuRow } from '../../components/common/UserMenuRow';
import { UserMenuSection } from '../../components/common/UserMenuSection';
import { MyRatingMenuRow } from '../../components/rating/MyRatingMenuRow';
import { UserProfileHeaderCard } from '../../components/common/UserProfileHeaderCard';
import { AccountSettingsSection } from '../../components/auth/AccountSettingsSection';
import { LogoutAccountSheet } from '../../components/auth/LogoutAccountSheet';
import { useLogoutAccountSheet } from '../../hooks/useLogoutAccountSheet';
import { formatAppFooterLabel } from '../../utils/appVersion';
import type { AppNavScreen } from '../../navigation/AppNavigator';
import { agentDisplayName, agentInitial } from '../../utils/agentProfileDisplay';
import { useAgentLocationOptional } from '../../contexts/AgentLocationContext';
import { useAgentFocus } from '../../hooks/useAgentFocus';

const ROOT_STACK_SCREENS: AppNavScreen[] = [
  'Earnings',
  'AgentAccounts',
  'AgentBusinessReferral',
  'Profile',
  'NotificationPreferences',
  'SavedAccounts',
  'AccountManagement',
  'ConfigurePayments',
  'MobilePaymentPhones',
  'Documents',
  'Terms',
  'Privacy',
  'FAQ',
  'AssistantChat',
  'Messages',
  'SupportTickets',
  'AgentLocationTracking',
];

function MenuTabScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { auth } = useStore();
  const tabScrollBottomPad = useMainTabContentBottomPadding(40);
  const {
    checking: checkingUpdate,
    runCheck: handleCheckUpdate,
    snack: updateSnack,
    dismissSnack: dismissUpdateSnack,
  } = useManualAppUpdateCheck();
  const navigation = useNavigation<{
    navigate: (name: AppNavScreen) => void;
    getParent: () => { navigate: (name: AppNavScreen) => void } | undefined;
  }>();
  const rootNav = navigation.getParent();
  const locationCtx = useAgentLocationOptional();
  const { isStripeRail } = useIsStripeRail();
  const { showCommercial } = useAgentFocus(true);

  const logoutSheet = useLogoutAccountSheet();

  const goTo = useCallback(
    (screen: AppNavScreen) => {
      if (ROOT_STACK_SCREENS.includes(screen) && rootNav) {
        rootNav.navigate(screen);
      } else {
        navigation.navigate(screen);
      }
    },
    [navigation, rootNav]
  );

  const handleLogout = useCallback(() => {
    logoutSheet.open();
  }, [logoutSheet]);

  const locationSubtitle = () => {
    const consent = locationCtx?.consent;
    if (consent === 'accepted')
      return t('agent.locationTracking.menuSubtitleEnabled', 'Location consent accepted');
    return t('agent.locationTracking.menuSubtitleOff', 'Set up in settings');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={[]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabScrollBottomPad, paddingHorizontal: spacing.md, paddingTop: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {auth.user ? (
          <UserProfileHeaderCard
            displayName={agentDisplayName(auth.user)}
            initials={agentInitial(auth.user)}
            photoUri={auth.displayProfilePhotoUri}
            contactText={auth.user.email || auth.user.phoneNumber}
            onPress={() => goTo('Profile')}
          />
        ) : null}

        <PersonaQuickSwitch />

        <UserMenuSection title={t('menuTab.sections.account', 'Account')}>
          <UserMenuRow
            icon="account-outline"
            label={t('nav.profile', 'Profile')}
            subtitle={t('menuTab.profileSubtitle', 'Personal info and addresses')}
            onPress={() => goTo('Profile')}
          />
          <AccountSettingsSection />
          <UserMenuRow
            icon="file-document-multiple-outline"
            label={t('nav.documents', 'Documents')}
            subtitle={t('menuTab.documentsSubtitle', 'ID verification documents')}
            onPress={() => goTo('Documents')}
          />
          <UserMenuRow
            icon="crosshairs-gps"
            label={t('agent.locationTracking.menuTitle', 'Delivery tracking')}
            subtitle={locationSubtitle()}
            onPress={() => goTo('AgentLocationTracking')}
          />
          <MyRatingMenuRow persona="agent" onPress={() => goTo('Profile')} />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.payments', 'Payments')}>
          <UserMenuRow
            icon="cash-multiple"
            label={t('nav.earnings', 'Earnings')}
            subtitle={t('menuTab.earningsSubtitle', 'Earnings and withdrawals')}
            onPress={() => goTo('Earnings')}
          />
          <UserMenuRow
            icon="wallet-outline"
            label={t('menuTab.accountsTitle', 'My wallet')}
            subtitle={t('menuTab.accountsSubtitle', 'Top up and withdraw')}
            onPress={() => goTo('AgentAccounts')}
          />
          {showCommercial ? (
            <UserMenuRow
              icon="storefront-outline"
              label={t('agent.businessReferrals.navTitle', 'Refer a business')}
              subtitle={t(
                'agent.businessReferrals.menuSubtitle',
                'Commissions, duties, and your referral code'
              )}
              onPress={() => goTo('AgentBusinessReferral')}
            />
          ) : null}
          {isStripeRail ? (
            <UserMenuRow
              icon="credit-card-outline"
              label={t('payments.menuTitle', 'Payments')}
              subtitle={t('payments.menuSubtitle', 'Configure Stripe payouts')}
              onPress={() => goTo('ConfigurePayments')}
            />
          ) : (
            <UserMenuRow
              icon="cellphone-check"
              label={t('mobilePaymentPhone.menuTitle', 'Mobile money numbers')}
              subtitle={t(
                'mobilePaymentPhone.menuSubtitle',
                'Add, verify, and delete payout numbers'
              )}
              onPress={() => goTo('MobilePaymentPhones')}
            />
          )}
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.settings', 'Settings')}>
          <UserMenuRow
            icon="bell-outline"
            label={t('notifications.preferences.title', 'Notification preferences')}
            subtitle={t(
              'notifications.preferences.menuSubtitle',
              'Push, WhatsApp, email, and categories'
            )}
            onPress={() => goTo('NotificationPreferences')}
          />
          <MenuLanguageSwitcher />
          <MenuThemeSwitcher />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.support', 'Support')}>
          <UserMenuRow
            icon="robot-outline"
            label={t('assistant.title', 'Rendasua Assistant')}
            subtitle={t(
              'assistant.subtitle',
              'Ask about delivery, payments, and more'
            )}
            onPress={() => goTo('AssistantChat')}
          />
          <UserMenuRow
            icon="message-text-outline"
            label={t('nav.messages', 'Messages')}
            subtitle={t('menuTab.messagesSubtitle', 'Message center')}
            onPress={() => goTo('Messages')}
          />
          <UserMenuRow
            icon="ticket-outline"
            label={t('nav.supportTickets', 'Support tickets')}
            subtitle={t('menuTab.supportTicketsSubtitle', 'Support and complaints')}
            onPress={() => goTo('SupportTickets')}
          />
          <UserMenuRow
            icon="help-circle-outline"
            label={t('nav.faq', 'FAQ')}
            onPress={() => goTo('FAQ')}
          />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.legal', 'Legal')}>
          <UserMenuRow
            icon="file-document-outline"
            label={t('nav.terms', 'Terms of service')}
            onPress={() => goTo('Terms')}
          />
          <UserMenuRow
            icon="shield-lock-outline"
            label={t('nav.privacy', 'Privacy Policy')}
            onPress={() => goTo('Privacy')}
          />
          <UserMenuRow
            icon="cellphone-arrow-down"
            label={t('menuTab.checkUpdates', 'Check for updates')}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            trailingElement={
              checkingUpdate ? (
                <ActivityIndicator size="small" color={colors.primary.main} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.disabled} />
              )
            }
          />
        </UserMenuSection>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.error.main + '0e',
              borderColor: colors.error.main + '40',
              borderRadius: borderRadius.card,
              marginBottom: spacing.xl,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="logout" size={20} color={colors.error.main} />
          <Text variant="bodyMedium" style={[styles.logoutLabel, { color: colors.error.main }]}>
            {t('auth.logout', 'Log out')}
          </Text>
        </Pressable>

        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <Text variant="bodySmall" style={[styles.footerText, { color: colors.text.disabled }]}>
            {formatAppFooterLabel('Rendasua Agent')}
          </Text>
        </View>
      </ScrollView>

      <TabAwareSnackbar visible={!!updateSnack} onDismiss={dismissUpdateSnack} duration={5000}>
        {updateSnack}
      </TabAwareSnackbar>

      <LogoutAccountSheet
        visible={logoutSheet.visible}
        displayName={logoutSheet.displayName}
        loading={logoutSheet.busy}
        onKeepOnDevice={() => void logoutSheet.keep()}
        onRemoveCompletely={() => void logoutSheet.remove()}
        onDismiss={logoutSheet.dismiss}
      />
    </SafeAreaView>
  );
}

export default observer(MenuTabScreen);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    justifyContent: 'center',
  },
  logoutLabel: { fontWeight: '700' },
  footer: {
    paddingTop: 20,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  footerText: { letterSpacing: 0.3 },
});
