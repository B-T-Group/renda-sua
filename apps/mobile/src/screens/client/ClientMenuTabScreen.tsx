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
import Logo from '../../components/Logo';
import { PersonaQuickSwitch } from '../../components/persona/PersonaQuickSwitch';
import { MenuLanguageSwitcher } from '../../components/menu/MenuLanguageSwitcher';
import { MenuThemeSwitcher } from '../../components/menu/MenuThemeSwitcher';
import { TabAwareSnackbar } from '../../components/feedback/TabAwareSnackbar';
import { UserMenuRow } from '../../components/common/UserMenuRow';
import { UserMenuSection } from '../../components/common/UserMenuSection';
import { MyRatingMenuRow } from '../../components/rating/MyRatingMenuRow';
import { UserProfileHeaderCard } from '../../components/common/UserProfileHeaderCard';
import { AccountSettingsSection } from '../../components/auth/AccountSettingsSection';
import { LogoutAccountSheet } from '../../components/auth/LogoutAccountSheet';
import { useLogoutAccountSheet } from '../../hooks/useLogoutAccountSheet';
import { formatAppFooterLabel } from '../../utils/appVersion';
import type { ClientAppNavScreen } from '../../navigation/ClientRootNavigator';
import { agentDisplayName, agentInitial } from '../../utils/agentProfileDisplay';
import { PERSONA_ACCENT } from '../../constants/personaTheme';

const ROOT_STACK_SCREENS: ClientAppNavScreen[] = [
  'ClientAccounts',
  'Profile',
  'ManageRecipients',
  'NotificationPreferences',
  'SavedAccounts',
  'AccountManagement',
  'Documents',
  'Terms',
  'Privacy',
  'FAQ',
  'AssistantChat',
  'Messages',
  'SupportTickets',
];

function ClientMenuTabScreenBase() {
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
    navigate: (name: ClientAppNavScreen) => void;
    getParent: () => { navigate: (name: ClientAppNavScreen) => void } | undefined;
  }>();
  const rootNav = navigation.getParent();

  const logoutSheet = useLogoutAccountSheet();

  const goTo = useCallback(
    (screen: ClientAppNavScreen) => {
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabScrollBottomPad, paddingHorizontal: spacing.md, paddingTop: spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Persona identity header */}
        <View style={styles.header}>
          <Logo />
          <Text
            style={[styles.personaLabel, { color: PERSONA_ACCENT.client ?? colors.primary.main }]}
          >
            {t('persona.clientTitle', 'Client')}
          </Text>
        </View>

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
          <UserMenuRow
            icon="account-multiple-outline"
            label={t('nav.manageRecipients', 'Saved recipients')}
            subtitle={t('menuTab.recipientsSubtitle', 'Manage diaspora order recipients')}
            onPress={() => goTo('ManageRecipients')}
          />
          <UserMenuRow
            icon="heart-outline"
            label={t('items.likes.title', 'Your favorites')}
            subtitle={t('items.likes.menuSubtitle', 'Items you saved')}
            onPress={() => goTo('UserLikes')}
          />
          <UserMenuRow
            icon="hand-wave-outline"
            label={t('productInterest.clientTitle', 'My interest requests')}
            subtitle={t(
              'productInterest.clientMenuSubtitle',
              'Items you asked sellers about'
            )}
            onPress={() => goTo('ClientProductInterest')}
          />
          <AccountSettingsSection />
          <UserMenuRow
            icon="file-document-multiple-outline"
            label={t('nav.documents', 'Documents')}
            subtitle={t('menuTab.documentsSubtitle', 'ID verification documents')}
            onPress={() => goTo('Documents')}
          />
          <MyRatingMenuRow persona="client" onPress={() => goTo('Profile')} />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.walletSection', 'Wallet')}>
          <UserMenuRow
            icon="wallet-outline"
            label={t('menuTab.accountsTitle', 'My wallet')}
            subtitle={t('menuTab.accountsSubtitle', 'Top up and withdraw')}
            onPress={() => goTo('ClientAccounts')}
          />
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
            icon="help-circle-outline"
            label={t('nav.faq', 'FAQ')}
            onPress={() => goTo('FAQ')}
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
          accessibilityRole="button"
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
            {formatAppFooterLabel('Rendasua')}
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

export default observer(ClientMenuTabScreenBase);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {},
  header: { alignItems: 'center', marginBottom: 20 },
  personaLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
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
