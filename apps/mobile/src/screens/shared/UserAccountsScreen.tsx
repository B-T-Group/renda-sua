import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Snackbar, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useProfileMe } from '../../hooks/useProfileMe';
import { useAgentXafWallet } from '../../hooks/useAgentXafWallet';
import { useUserCurrency } from '../../hooks/useUserCurrency';
import { useWalletAccountActions } from '../../hooks/useWalletAccountActions';
import { AgentAccountTransactionsDialog } from '../../components/dialogs/AgentAccountTransactionsDialog';
import { AgentWithdrawDialog } from '../../components/dialogs/AgentWithdrawDialog';
import { ClientTopUpDialog } from '../../components/dialogs/ClientTopUpDialog';
import { WalletAccountCard } from '../../components/wallet/WalletAccountCard';
import {
  LocationsWalletSectionHeader,
  PersonalWalletSectionHeader,
} from '../../components/wallet/WalletSectionHeader';
import { WalletStripeFooter } from '../../components/wallet/WalletStripeFooter';
import { WalletEmptyIllustration } from '../../components/illustrations/WalletEmptyIllustration';
import type { AccountInfoRow } from '../../types/accountWallet';
import { isLegacyWallet } from '../../utils/walletAccounts';
import { resolveWithdrawDefaultPhone } from '../../utils/resolveWithdrawDefaultPhone';

function accountLabel(account: AccountInfoRow, personalLabel: string): string {
  if (isLegacyWallet(account)) return `${personalLabel} · ${account.currency}`;
  const name = account.business_location?.name;
  return name ? `${name} · ${account.currency}` : account.currency;
}

function UserAccountsScreenBase() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const { auth } = useStore();
  const { me, refetch: refetchMe } = useProfileMe(!!auth.isAuthenticated);
  const { currency: meCurrency } = useUserCurrency(!!auth.isAuthenticated);
  const {
    personalAccounts,
    locationAccounts,
    allAccounts,
    loading,
    error,
    refetch,
    withdrawFromAccount,
    stripeWithdrawFromAccount,
    topUpAccount,
    isStripeRail,
    stripeConnected,
    stripeReady,
    openStripeDashboard,
    startStripeOnboarding,
  } = useAgentXafWallet(!!auth.isAuthenticated, meCurrency);

  const actions = useWalletAccountActions({
    isStripeRail,
    withdrawFromAccount,
    stripeWithdrawFromAccount,
    topUpAccount,
    refetch,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountInfoRow | null>(null);

  const personalLabel = t('accounts.personalWalletLabel', 'Personal wallet');
  const hasAnyAccount = personalAccounts.length > 0 || locationAccounts.length > 0;

  useEffect(() => {
    if (isStripeRail) setTopUpOpen(false);
  }, [isStripeRail]);

  useFocusEffect(
    useCallback(() => {
      void refetchMe({ silent: true });
    }, [refetchMe])
  );

  const handleStripeAccess = useCallback(() => {
    if (stripeConnected) void openStripeDashboard();
    else void startStripeOnboarding();
  }, [stripeConnected, openStripeDashboard, startStripeOnboarding]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchMe({ silent: true })]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMe]);

  const openTransactions = useCallback(
    async (account: AccountInfoRow) => {
      setActiveAccount(account);
      setTxOpen(true);
      setTxLoading(true);
      try {
        await refetch();
      } finally {
        setTxLoading(false);
      }
    },
    [refetch]
  );

  const openWithdraw = useCallback((account: AccountInfoRow) => {
    setActiveAccount(account);
    setWithdrawOpen(true);
  }, []);

  const openTopUp = useCallback((account: AccountInfoRow) => {
    setActiveAccount(account);
    setTopUpOpen(true);
  }, []);

  const withdrawDefaultPhone = resolveWithdrawDefaultPhone({
    isLocationAccount: !!activeAccount && !isLegacyWallet(activeAccount),
    locationPhone: activeAccount?.business_location?.phone,
    userPhone: me?.phone_number,
    authPhone: auth.user?.phoneNumber,
  });

  const txAccount =
    activeAccount &&
    (allAccounts.find((a) => a.id === activeAccount.id) ?? activeAccount);

  const renderCards = (list: AccountInfoRow[]) =>
    list.map((account) => (
      <WalletAccountCard
        key={account.id}
        account={account}
        isStripeRail={isStripeRail}
        stripeReady={stripeReady}
        onViewTransactions={openTransactions}
        onWithdraw={openWithdraw}
        onTopUp={openTopUp}
      />
    ));

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.md }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
          />
        }
      >
        {loading && !hasAnyAccount ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary.main} />
            <Text
              style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.sm }]}
            >
              {t('common.loading', 'Loading…')}
            </Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                gap: spacing.sm,
              },
            ]}
          >
            <Text style={[typography.body1, { color: colors.error.main }]}>{error}</Text>
            <Pressable
              onPress={() => void refetch()}
              style={[
                styles.retry,
                { backgroundColor: colors.primary.main, borderRadius: borderRadius.sm },
              ]}
            >
              <Text style={[typography.button, { color: colors.primary.contrast }]}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        ) : !hasAnyAccount ? (
          <View style={styles.centered}>
            <WalletEmptyIllustration />
            <Text
              style={[
                typography.subtitle1,
                { color: colors.text.primary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              {t('accounts.noAccounts', 'No wallet accounts yet')}
            </Text>
            <Text
              style={[
                typography.body2,
                {
                  color: colors.text.secondary,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                  paddingHorizontal: spacing.lg,
                },
              ]}
            >
              {t(
                'accounts.noAccountsHint',
                'Your wallets will appear here once they are set up. Contact support if you need help.'
              )}
            </Text>
          </View>
        ) : (
          <>
            {personalAccounts.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <PersonalWalletSectionHeader />
                {renderCards(personalAccounts)}
              </View>
            ) : null}
            {locationAccounts.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <LocationsWalletSectionHeader />
                {renderCards(locationAccounts)}
              </View>
            ) : null}
            {isStripeRail ? (
              <WalletStripeFooter
                stripeConnected={stripeConnected}
                onPress={handleStripeAccess}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <AgentAccountTransactionsDialog
        visible={txOpen}
        onDismiss={() => setTxOpen(false)}
        loading={txLoading}
        accounts={txAccount ? [txAccount] : undefined}
        accountLabel={txAccount ? accountLabel(txAccount, personalLabel) : undefined}
      />
      <AgentWithdrawDialog
        visible={withdrawOpen}
        onDismiss={() => setWithdrawOpen(false)}
        defaultPhone={withdrawDefaultPhone}
        currency={activeAccount?.currency ?? 'XAF'}
        availableBalance={activeAccount?.available_balance ?? 0}
        submitting={actions.withdrawSubmitting}
        mode={isStripeRail ? 'stripe' : 'mobile_money'}
        accountId={activeAccount?.id}
        isLocationAccount={!!activeAccount && !isLegacyWallet(activeAccount)}
        onConfirm={async (amount, phoneE164, pin) => {
          if (!activeAccount) {
            return {
              success: false,
              message: t('accounts.withdrawFailed', 'Withdrawal could not be started.'),
            };
          }
          return actions.handleWithdrawConfirm(activeAccount, amount, phoneE164, pin);
        }}
      />
      <ClientTopUpDialog
        visible={!isStripeRail && topUpOpen}
        onDismiss={() => setTopUpOpen(false)}
        defaultPhone={withdrawDefaultPhone}
        currency={activeAccount?.currency ?? 'XAF'}
        submitting={actions.topUpSubmitting}
        onConfirm={async (phoneE164, amount) => {
          if (!activeAccount) {
            return {
              success: false,
              message: t('accounts.topUpFailed', 'Top-up could not be started.'),
            };
          }
          return actions.handleTopUpConfirm(activeAccount, phoneE164, amount);
        }}
      />
      <Snackbar
        visible={!!actions.snack}
        onDismiss={() => actions.setSnack(null)}
        duration={5000}
      >
        {actions.snack}
      </Snackbar>
    </SafeAreaView>
  );
}

export default observer(UserAccountsScreenBase);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 32 },
  centered: { alignItems: 'center', paddingVertical: 48 },
  errorCard: { borderWidth: 1 },
  retry: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16 },
});
