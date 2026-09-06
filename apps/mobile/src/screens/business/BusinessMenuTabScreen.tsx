import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { usePermissions } from '../../hooks/usePermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { useBusinessVerificationStatus } from '../../hooks/useBusinessVerificationStatus';
import Logo from '../../components/Logo';
import { PersonaQuickSwitch } from '../../components/persona/PersonaQuickSwitch';
import { MenuLanguageSwitcher } from '../../components/menu/MenuLanguageSwitcher';
import { MenuThemeSwitcher } from '../../components/menu/MenuThemeSwitcher';
import { UserMenuRow } from '../../components/common/UserMenuRow';
import { UserMenuSection } from '../../components/common/UserMenuSection';
import { UserProfileHeaderCard } from '../../components/common/UserProfileHeaderCard';
import { AccountSettingsSection } from '../../components/auth/AccountSettingsSection';
import { TipsRemindersToggleRow } from '../../components/business/TipsRemindersToggleRow';
import { LogoutAccountSheet } from '../../components/auth/LogoutAccountSheet';

import { useLogoutAccountSheet } from '../../hooks/useLogoutAccountSheet';
import { PERSONA_ACCENT } from '../../constants/personaTheme';
import { PlatformPermissions } from '../../constants/platformPermissions';
import type { BusinessAppNavScreen } from '../../navigation/types';
import { formatAppFooterLabel } from '../../utils/appVersion';
import { agentDisplayName, agentInitial } from '../../utils/agentProfileDisplay';

function BusinessMenuTabScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { auth } = useStore();
  const tabScrollBottomPad = useMainTabContentBottomPadding(40);
  const { isStripeRail } = useIsStripeRail();
  const { me } = useProfileMe();
  const { status: verificationStatus, refetch: refetchVerification } =
    useBusinessVerificationStatus();
  useFocusEffect(
    useCallback(() => {
      void refetchVerification();
    }, [refetchVerification])
  );
  const agreementSigned =
    verificationStatus?.contract?.complete === true ||
    verificationStatus?.steps?.agreement?.complete === true;
  const { can, isSuperuser } = usePermissions(me);
  const navigation = useNavigation<{
    getParent: () => { navigate: (name: BusinessAppNavScreen) => void } | undefined;
  }>();
  const rootNav = navigation.getParent();

  const canManageUsers =
    isSuperuser ||
    can(PlatformPermissions.MANAGE_CLIENTS) ||
    can(PlatformPermissions.MANAGE_BUSINESSES) ||
    can(PlatformPermissions.MANAGE_AGENTS);

  const canSeeBusinessVerification =
    isSuperuser || can(PlatformPermissions.MANAGE_BUSINESSES);

  const canSeeModeration =
    isSuperuser ||
    can(PlatformPermissions.MODERATE_ITEMS) ||
    can(PlatformPermissions.MODERATE_RENTALS);

  const canBrowseCatalog =
    isSuperuser || can(PlatformPermissions.CATALOG_CROSS_BUSINESS);

  const canSeePerformance =
    isSuperuser || can(PlatformPermissions.DASHBOARD_PLATFORM_STATS);

  const canRechargeAccount =
    isSuperuser || can(PlatformPermissions.RECHARGE_ACCOUNT);
  const canSendBroadcasts =
    isSuperuser || can(PlatformPermissions.OPS_USER_MESSAGES);
  const canSeeWhatsAppInbox =
    isSuperuser || can(PlatformPermissions.OPS_WHATSAPP_INBOX);
  const canSeeOrderOps =
    isSuperuser || can(PlatformPermissions.ORDERS_CROSS_BUSINESS);
  const canSeeCredits =
    isSuperuser || can(PlatformPermissions.OPS_CREDITS);

  const logoutSheet = useLogoutAccountSheet();

  const goTo = useCallback(
    (screen: BusinessAppNavScreen) => {
      rootNav?.navigate(screen);
    },
    [rootNav]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={['top']}
    >
      <ScrollView
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
            style={[styles.personaLabel, { color: PERSONA_ACCENT.business ?? colors.primary.main }]}
          >
            {t('persona.businessTitle', 'Business')}
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

        <UserMenuSection title={t('menuTab.sections.catalog', 'Catalog')}>
          {me?.business?.main_interest === 'rent_items' ? (
            <UserMenuRow
              icon="package-variant"
              label={t('business.dashboard.itemsTitle', 'Items')}
              subtitle={t(
                'business.menu.saleItemsSubtitle',
                'Add and manage products for sale'
              )}
              onPress={() => goTo('BusinessItemsList')}
            />
          ) : (
            <UserMenuRow
              icon="calendar-clock"
              label={t('business.dashboard.rentalsTitle', 'Rentals')}
              subtitle={t(
                'business.menu.rentalsSubtitle',
                'Add and manage rental items and listings'
              )}
              onPress={() => goTo('BusinessRentalsStudio')}
            />
          )}
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.operations', 'Operations')}>
          <UserMenuRow
            icon="hand-wave-outline"
            label={t('productInterest.businessTitle', 'Product interest')}
            subtitle={t(
              'productInterest.businessMenuSubtitle',
              'Leads from shoppers'
            )}
            onPress={() => goTo('BusinessProductInterest')}
          />
          <UserMenuRow
            icon="account-multiple-outline"
            label={t('delegation.team.title', 'Team')}
            subtitle={t(
              'delegation.team.menuSubtitle',
              'Invite people to manage orders at a location'
            )}
            onPress={() => goTo('BusinessTeam')}
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
          <TipsRemindersToggleRow />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.account', 'Account')}>
          <UserMenuRow
            icon="account-outline"
            label={t('menuTab.profile', 'Profile')}
            subtitle={t('menuTab.profileSubtitle', 'Personal info and addresses')}
            onPress={() => goTo('Profile')}
          />
          <UserMenuRow
            icon="storefront-outline"
            label={t('referrals.followUp.listTitle', 'Referred businesses')}
            subtitle={t(
              'business.referrals.menuSubtitle',
              'Your code and businesses you referred'
            )}
            onPress={() => goTo('BusinessReferredBusinesses')}
          />
          <AccountSettingsSection />
          <UserMenuRow
            icon="file-sign"
            label={t('business.setup.menuAgreement', 'Merchant agreement')}
            subtitle={
              agreementSigned
                ? t(
                    'business.setup.menuAgreementViewSubtitle',
                    'View your signed partnership agreement'
                  )
                : t(
                    'business.setup.menuAgreementSubtitle',
                    'View or sign your partnership agreement'
                  )
            }
            onPress={() => goTo('BusinessMerchantAgreement')}
          />
          <UserMenuRow
            icon="file-document-outline"
            label={t('menuTab.documents', 'Documents')}
            onPress={() => goTo('Documents')}
          />
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.walletSection', 'Wallet')}>
          <UserMenuRow
            icon="wallet-outline"
            label={t('menuTab.accountsTitle', 'My wallet')}
            subtitle={t('menuTab.accountsSubtitle', 'Top up and withdraw')}
            onPress={() => goTo('BusinessAccounts')}
          />
          <UserMenuRow
            icon="auto-fix"
            label={t('business.tokens.menuTitle', 'AI tokens')}
            subtitle={t('business.tokens.menuSubtitle', 'Buy credits for image cleanup')}
            onPress={() => goTo('BusinessAiTokens')}
          />
          <UserMenuRow
            icon="star-outline"
            label={t('business.accountType.sectionTitle', 'Account & Plan')}
            subtitle={t('business.accountType.cardDescription', 'Your current plan — commission applies to every order.')}
            onPress={() => goTo('BusinessAccountTypeScreen')}
          />
          {isStripeRail ? (
            <UserMenuRow
              icon="credit-card-outline"
              label={t('payments.menuTitle', 'Payments')}
              subtitle={t('payments.menuSubtitle', 'Configure Stripe payouts')}
              onPress={() => goTo('BusinessConfigurePayments')}
            />
          ) : (
            <UserMenuRow
              icon="cellphone-check"
              label={t('mobilePaymentPhone.menuTitle', 'Mobile money numbers')}
              subtitle={t(
                'mobilePaymentPhone.menuSubtitle',
                'Add, verify, and delete payout numbers'
              )}
              onPress={() => goTo('BusinessMobilePaymentPhones')}
            />
          )}
        </UserMenuSection>

        <UserMenuSection title={t('menuTab.sections.support', 'Support')}>
          <UserMenuRow
            icon="robot-outline"
            label={t('assistant.title', 'Rendasua Assistant')}
            onPress={() => goTo('AssistantChat')}
          />
          <UserMenuRow
            icon="message-outline"
            label={t('menuTab.messages', 'Messages')}
            onPress={() => goTo('Messages')}
          />
          <UserMenuRow
            icon="ticket-outline"
            label={t('menuTab.support', 'Support')}
            onPress={() => goTo('SupportTickets')}
          />
          <UserMenuRow
            icon="shield-lock-outline"
            label={t('nav.privacy', 'Privacy Policy')}
            onPress={() => goTo('Privacy')}
          />
          <UserMenuRow
            icon="help-circle-outline"
            label={t('menuTab.faq', 'FAQ')}
            onPress={() => goTo('FAQ')}
          />
        </UserMenuSection>

        {(canManageUsers ||
          canSeeBusinessVerification ||
          canSeeModeration ||
          canBrowseCatalog ||
          canSeePerformance ||
          canRechargeAccount ||
          canSendBroadcasts ||
          canSeeWhatsAppInbox ||
          canSeeOrderOps ||
          canSeeCredits) ? (
          <UserMenuSection title={t('menuTab.sections.admin', 'Admin')}>
            {canSeeOrderOps ? (
              <UserMenuRow
                icon="clipboard-alert-outline"
                label={t('admin.orders.title', 'Order operations')}
                subtitle={t(
                  'admin.orders.menuSubtitle',
                  'Intervene on at-risk orders across businesses'
                )}
                onPress={() => goTo('AdminOrders')}
              />
            ) : null}
            {canSeeCredits ? (
              <UserMenuRow
                icon="trophy-outline"
                label={t('admin.credits.pageTitle', 'Ops follow-ups')}
                subtitle={t(
                  'admin.credits.menuSubtitle',
                  'Escalations, call-backs, and follow-up progress'
                )}
                onPress={() => goTo('AdminCredits')}
              />
            ) : null}
            {canManageUsers ? (
              <UserMenuRow
                icon="account-group-outline"
                label={t('admin.users.title', 'Manage users')}
                subtitle={t('admin.users.menuSubtitle', 'Clients, businesses, agents')}
                onPress={() => goTo('AdminUsers')}
              />
            ) : null}
            {canSendBroadcasts ? (
              <UserMenuRow
                icon="bullhorn-outline"
                label={t('admin.broadcasts.title', 'Global messaging')}
                subtitle={t(
                  'admin.broadcasts.menuSubtitle',
                  'Send targeted notifications to users'
                )}
                onPress={() => goTo('AdminBroadcasts')}
              />
            ) : null}
            {canSeeWhatsAppInbox ? (
              <UserMenuRow
                icon="whatsapp"
                label={t('admin.whatsappInbox.title', 'WhatsApp inbox')}
                subtitle={t(
                  'admin.whatsappInbox.menuSubtitle',
                  'Reply to customer support chats'
                )}
                onPress={() => goTo('AdminWhatsAppInbox')}
              />
            ) : null}
            {canSeeBusinessVerification ? (
              <UserMenuRow
                icon="store-check-outline"
                label={t('admin.businesses.dashboardTitle', 'Business verification')}
                subtitle={t('admin.businesses.subtitle', 'Review merchant contracts and ID')}
                onPress={() => goTo('AdminBusinessesList')}
              />
            ) : null}
            {canSeeModeration ? (
              <UserMenuRow
                icon="shield-search"
                label={t('admin.items.moderation.dashboardTitle', 'Item moderation')}
                subtitle={t('admin.items.moderation.dashboardDescription', 'Approve or reject sale items')}
                onPress={() => goTo('AdminItemModeration')}
              />
            ) : null}
            {canBrowseCatalog ? (
              <UserMenuRow
                icon="package-variant-closed"
                label={t('admin.itemsBrowser.dashboardTitle', 'All items')}
                subtitle={t(
                  'admin.itemsBrowser.menuSubtitle',
                  'Search, edit, and clean up sale items'
                )}
                onPress={() => goTo('AdminItemsBrowser')}
              />
            ) : null}
            {canSeePerformance ? (
              <UserMenuRow
                icon="chart-line"
                label={t('admin.performance.title', 'Platform performance')}
                subtitle={t('admin.performance.subtitle', 'Enrollment and catalog growth')}
                onPress={() => goTo('AdminPerformance')}
              />
            ) : null}
            {canRechargeAccount ? (
              <UserMenuRow
                icon="bank-plus"
                label={t('admin.accountRecharge.screenTitle', 'HQ Account Recharge')}
                subtitle={t('admin.accountRecharge.subtitle', 'Collect from a mobile number to top up the HQ account')}
                onPress={() => goTo('AccountRecharge')}
              />
            ) : null}
          </UserMenuSection>
        ) : null}

        {/* Logout */}
        <Pressable
          onPress={() => logoutSheet.open()}
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

        <Text
          style={[styles.footer, { color: colors.text.disabled }]}
        >
          {formatAppFooterLabel('Rendasua')}
        </Text>
      </ScrollView>

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

export default observer(BusinessMenuTabScreenBase);

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
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
