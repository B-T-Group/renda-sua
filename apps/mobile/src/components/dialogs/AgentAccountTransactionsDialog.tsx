import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button, Text, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AppModal } from '../common/AppModal';
import type { AccountInfoRow, AccountTransactionRow } from '../../types/accountWallet';
import { formatCurrency } from '../../utils/formatters';

export interface AgentAccountTransactionsDialogProps {
  visible: boolean;
  onDismiss: () => void;
  /** Single-account legacy path: pass transactions + balance directly. */
  transactions?: AccountTransactionRow[];
  loading: boolean;
  currency?: string;
  availableBalance?: number;
  /** Multi-account path: pass all accounts; the dialog renders a tab per account. */
  accounts?: AccountInfoRow[];
  /** Optional label shown under the title (e.g. "Douala Store · XAF"). */
  accountLabel?: string;
}

function formatMoney(amount: number, currency?: string): string {
  return formatCurrency(Math.abs(amount), currency);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function lineColor(
  type: string,
  amount: number,
  colors: { success: { main: string }; error: { main: string }; text: { secondary: string } }
): string {
  if (type === 'hold' || type === 'release') return colors.text.secondary;
  if (['deposit', 'refund', 'exchange'].includes(type)) return colors.success.main;
  if (['withdrawal', 'payment', 'fee', 'transfer'].includes(type)) return colors.error.main;
  if (type === 'adjustment') return amount > 0 ? colors.success.main : colors.error.main;
  return amount >= 0 ? colors.success.main : colors.error.main;
}

function formatSignedAmount(type: string, amount: number, currency: string): string {
  const abs = formatMoney(amount, currency);
  if (type === 'hold' || type === 'release') return abs;
  if (['deposit', 'refund', 'exchange'].includes(type)) return `+${abs}`;
  if (['withdrawal', 'payment', 'fee', 'transfer'].includes(type)) return `-${abs}`;
  if (type === 'adjustment') return `${amount > 0 ? '+' : '-'}${abs}`;
  return `${amount >= 0 ? '+' : ''}${formatMoney(amount, currency)}`;
}

function sortDesc(rows: AccountTransactionRow[]): AccountTransactionRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function tabLabel(account: AccountInfoRow): string {
  if (account.business_location?.name) return account.business_location.name;
  return account.currency;
}

interface TransactionListProps {
  transactions: AccountTransactionRow[];
  currency: string;
  availableBalance: number;
  colors: ReturnType<typeof useTheme>['colors'];
  t: TFunction;
}

function TransactionList({
  transactions,
  currency,
  availableBalance,
  colors,
  t,
}: TransactionListProps) {
  const sorted = useMemo(() => sortDesc(transactions), [transactions]);
  return (
    <>
      <View style={[styles.balanceBar, { backgroundColor: colors.pageBackground }]}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('accounts.availableBalance', 'Available balance')}
        </Text>
        <Text variant="titleMedium" style={{ color: colors.success.main, fontWeight: '600' }}>
          {formatMoney(availableBalance, currency)}
        </Text>
      </View>
      <Divider style={{ marginBottom: 8 }} />
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        style={{ maxHeight: 320 }}
        scrollEnabled
        ListEmptyComponent={
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, paddingVertical: 16 }}
          >
            {t('accounts.noTransactions', 'No transactions yet.')}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.divider }]}>
            <View style={styles.rowLeft}>
              <Text variant="labelMedium" style={{ color: colors.text.primary }}>
                {item.transaction_type}
              </Text>
              {item.memo ? (
                <Text
                  variant="bodySmall"
                  style={{ color: colors.text.secondary }}
                  numberOfLines={2}
                >
                  {item.memo}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={{ color: colors.text.disabled }}>
                {formatWhen(item.created_at)}
              </Text>
            </View>
            <Text
              variant="titleSmall"
              style={{
                color: lineColor(item.transaction_type, item.amount, colors),
                marginLeft: 8,
              }}
            >
              {formatSignedAmount(item.transaction_type, item.amount, currency)}
            </Text>
          </View>
        )}
      />
    </>
  );
}

export function AgentAccountTransactionsDialog({
  visible,
  onDismiss,
  transactions,
  loading,
  currency,
  availableBalance,
  accounts,
  accountLabel,
}: AgentAccountTransactionsDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const multiMode = accounts && accounts.length > 0;

  const activeAccount = multiMode
    ? accounts[Math.min(selectedIndex, accounts.length - 1)]
    : null;
  const activeCurrency = activeAccount?.currency ?? currency ?? 'XAF';
  const activeBalance = activeAccount?.available_balance ?? availableBalance ?? 0;
  const activeTransactions = activeAccount?.account_transactions ?? transactions ?? [];

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary, paddingHorizontal: spacing.lg }]}
          >
            {t('accounts.viewTransactions', 'Transactions')}
          </Text>
          {accountLabel ? (
            <Text
              variant="bodySmall"
              style={{
                color: colors.text.secondary,
                paddingHorizontal: spacing.lg,
                marginTop: 4,
                marginBottom: spacing.sm,
              }}
              numberOfLines={1}
            >
              {accountLabel}
            </Text>
          ) : (
            <View style={{ height: spacing.sm }} />
          )}

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary.main} />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.text.secondary, marginTop: 8 }}
                >
                  {t('common.loading', 'Loading…')}
                </Text>
              </View>
            ) : (
              <>
                {multiMode && accounts.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tabRow}
                    contentContainerStyle={styles.tabRowContent}
                  >
                    {accounts.map((acc, i) => {
                      const active = i === selectedIndex;
                      return (
                        <Pressable
                          key={acc.id}
                          onPress={() => setSelectedIndex(i)}
                          style={[
                            styles.tab,
                            {
                              borderBottomColor: active
                                ? colors.primary.main
                                : 'transparent',
                              borderBottomWidth: 2,
                            },
                          ]}
                        >
                          <Text
                            variant="labelMedium"
                            style={{
                              color: active
                                ? colors.primary.main
                                : colors.text.secondary,
                              fontWeight: active ? '700' : '400',
                            }}
                          >
                            {tabLabel(acc)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                <TransactionList
                  transactions={activeTransactions}
                  currency={activeCurrency}
                  availableBalance={activeBalance}
                  colors={colors}
                  t={t}
                />
              </>
            )}
          </ScrollView>

          <View
            style={[
              styles.actions,
              {
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
              },
            ]}
          >
            <Button mode="text" onPress={onDismiss}>
              {t('common.close', 'Close')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    overflow: 'hidden',
    paddingTop: 20,
  },
  title: { fontWeight: '700' },
  balanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  centered: { alignItems: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flex: 1, minWidth: 0 },
  tabRow: { marginBottom: 12 },
  tabRowContent: { flexDirection: 'row', gap: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
