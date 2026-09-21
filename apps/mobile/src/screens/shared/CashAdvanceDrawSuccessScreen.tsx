import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { formatCurrency } from '../../utils/formatters';
import type { CashAdvanceDrawSuccessParams } from '../../navigation/types';
import type { PersonaSlug } from '../../types/persona';

const ACCOUNTS_ROUTE: Record<PersonaSlug, string> = {
  client: 'ClientAccounts',
  agent: 'AgentAccounts',
  business: 'BusinessAccounts',
};

const MAIN_TABS_ROUTE: Record<PersonaSlug, string> = {
  client: 'ClientMainTabs',
  agent: 'MainTabs',
  business: 'BusinessMainTabs',
};

export default function CashAdvanceDrawSuccessScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { persona } = useStore();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const route =
    useRoute<RouteProp<{ CashAdvanceDrawSuccess: CashAdvanceDrawSuccessParams }, 'CashAdvanceDrawSuccess'>>();
  const {
    drawnAmount,
    currency,
    availableBalance,
    remainingCredit,
    programName,
  } = route.params;

  const goToWallet = useCallback(() => {
    const active = persona.activePersona;
    const accountsRoute = ACCOUNTS_ROUTE[active] ?? 'ClientAccounts';
    const tabsRoute = MAIN_TABS_ROUTE[active] ?? 'ClientMainTabs';
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: tabsRoute }, { name: accountsRoute }],
      })
    );
  }, [navigation, persona.activePersona]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: spacing.lg, gap: spacing.md },
        ]}
      >
        <View style={styles.hero}>
          <MaterialCommunityIcons
            name="check-circle"
            size={56}
            color={colors.success.main}
            accessibilityLabel={t(
              'accounts.cashAdvance.successTitle',
              'Cash advance credited'
            )}
          />
          <Text
            variant="headlineSmall"
            style={{
              color: colors.text.primary,
              fontWeight: '700',
              textAlign: 'center',
              marginTop: spacing.sm,
            }}
          >
            {t('accounts.cashAdvance.successTitle', 'Cash advance credited')}
          </Text>
          {programName ? (
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.secondary, textAlign: 'center' }}
            >
              {programName}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.statBlock,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          <StatRow
            label={t('accounts.cashAdvance.drawnLabel', 'Amount drawn')}
            value={formatCurrency(drawnAmount, currency)}
            valueColor={colors.text.primary}
          />
          <StatRow
            label={t('accounts.cashAdvance.walletBalance', 'Wallet available balance')}
            value={formatCurrency(availableBalance, currency)}
            valueColor={colors.success.main}
          />
          <StatRow
            label={t('accounts.cashAdvance.creditRemaining', 'Credit line remaining')}
            value={formatCurrency(remainingCredit, currency)}
            valueColor={colors.primary.main}
          />
        </View>

        <Text
          variant="bodyMedium"
          style={[
            typography.body2,
            {
              color: colors.text.secondary,
              lineHeight: 22,
              textAlign: 'center',
            },
          ]}
        >
          {t(
            'accounts.cashAdvance.repaymentNote',
            'Repayment happens automatically through commissions you earn and account top-ups. There is no separate repay button.'
          )}
        </Text>

        <Button mode="contained" onPress={goToWallet} style={{ marginTop: spacing.sm }}>
          {t('accounts.cashAdvance.backToWallet', 'Back to wallet')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.statRow}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1 }}>
        {label}
      </Text>
      <Text
        variant="titleMedium"
        style={{ color: valueColor, fontWeight: '700' }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 4 },
  statBlock: { borderWidth: StyleSheet.hairlineWidth },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
