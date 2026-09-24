import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@/services/apiClient';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '@/theme';
import { isUsablePurchaseCredit } from '@/utils/purchaseCredits';
import { cashAdvanceOwed, drawableRemaining } from '@/utils/cashAdvance';
import { formatCurrency } from '@/utils/formatters';
import type { PurchaseCreditGrant } from '@/types/purchaseCredits';

interface Summary {
  facilities: Array<{
    id: string;
    status: string;
    limit_amount: number;
    currency: string;
    account?: {
      cash_advance_balance?: number;
      available_balance?: number;
    };
    program?: { name?: string };
  }>;
  grants: PurchaseCreditGrant[];
  assignments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    decision?: string;
    schedule?: { name?: string; frequency?: string };
  }>;
}

type DrawResponse = {
  transactionId: string;
  newBalance: {
    available: number;
    withheld: number;
    total: number;
    cashAdvance: number;
  };
};

export default function UserPaymentProgramsScreen() {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [amount, setAmount] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const data = await api.get<Summary>('/payment-programs/me');
    setSummary(data);
  }, []);

  const loadErrorMessage = useCallback(
    (err: any) =>
      err?.message ||
      t('accounts.cashAdvance.loadError', 'Could not load cash advance.'),
    [t]
  );

  const retryLoad = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (err: any) {
      setLoadError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [load, loadErrorMessage]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err: any) => setLoadError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [load, loadErrorMessage]);

  const facility = summary?.facilities.find((row) => row.status === 'active');
  const owed = cashAdvanceOwed(facility?.account?.cash_advance_balance);
  const remaining = facility
    ? drawableRemaining(facility.limit_amount, facility.account?.cash_advance_balance)
    : 0;
  const drawAmount = Number(amount);
  const canDraw =
    !!facility &&
    remaining > 0 &&
    Number.isFinite(drawAmount) &&
    drawAmount > 0 &&
    drawAmount <= remaining &&
    !drawing;

  const usableCredits = (summary?.grants || []).filter(isUsablePurchaseCredit);
  const creditTotal = usableCredits.reduce(
    (sum, g) => sum + Number(g.remaining_amount),
    0
  );
  const creditCurrency = usableCredits[0]?.currency ?? 'XAF';

  const onDraw = async () => {
    if (!facility || !canDraw) return;
    setDrawError(null);
    setDrawing(true);
    try {
      const result = await api.post<DrawResponse>(
        '/payment-programs/cash-advance/draw',
        { amount: drawAmount, currency: facility.currency }
      );
      const remainingCredit = drawableRemaining(
        facility.limit_amount,
        result.newBalance.cashAdvance
      );
      setAmount('');
      navigation.replace('CashAdvanceDrawSuccess', {
        drawnAmount: drawAmount,
        currency: facility.currency,
        availableBalance: result.newBalance.available,
        remainingCredit,
        programName: facility.program?.name,
      });
    } catch (err: any) {
      setDrawError(
        err?.message ||
          t(
            'accounts.cashAdvance.drawError',
            'Could not draw from your credit line. Please try again.'
          )
      );
    } finally {
      setDrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { padding: spacing.md }]}>
        <ActivityIndicator color={colors.primary.main} />
        <Text style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {t('common.loading', 'Loading…')}
        </Text>
      </View>
    );
  }

  if (loadError && !summary) {
    return (
      <View style={[styles.centered, { padding: spacing.md, gap: spacing.sm }]}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.error.main + '14',
              borderColor: colors.error.main,
              borderRadius: borderRadius.md,
              alignSelf: 'stretch',
            },
          ]}
        >
          <Text style={{ color: colors.error.main }}>{loadError}</Text>
        </View>
        <Button mode="outlined" onPress={() => void retryLoad()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Text variant="titleLarge" style={{ fontWeight: '700' }}>
        {t('accounts.cashAdvance.title', 'Cash advance')}
      </Text>

      {!facility ? (
        <Text style={{ color: colors.text.secondary }}>
          {t(
            'accounts.cashAdvance.empty',
            'You do not have an open cash advance.'
          )}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {facility.program?.name ? (
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {facility.program.name}
            </Text>
          ) : null}

          <View
            style={[
              styles.stats,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <StatLine
              label={t('accounts.cashAdvance.limit', 'Limit')}
              value={formatCurrency(facility.limit_amount, facility.currency)}
            />
            <StatLine
              label={t('accounts.cashAdvance.owed', 'Owed')}
              value={formatCurrency(owed, facility.currency)}
            />
            <StatLine
              label={t('accounts.cashAdvance.remaining', 'Available to draw')}
              value={formatCurrency(remaining, facility.currency)}
              emphasize
            />
          </View>

          {drawError ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: colors.error.main + '14',
                  borderColor: colors.error.main,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={{ color: colors.error.main }}>{drawError}</Text>
            </View>
          ) : null}

          <TextInput
            mode="outlined"
            label={t('accounts.cashAdvance.amount', 'Amount')}
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              if (drawError) setDrawError(null);
            }}
            keyboardType="decimal-pad"
            disabled={remaining <= 0 || drawing}
          />
          <Button
            mode="contained"
            onPress={() => void onDraw()}
            disabled={!canDraw}
            loading={drawing}
          >
            {drawing
              ? t('accounts.cashAdvance.drawing', 'Drawing…')
              : t('accounts.cashAdvance.draw', 'Draw')}
          </Button>
          {remaining <= 0 ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t(
                'accounts.cashAdvance.noneRemaining',
                'No credit remaining on this line.'
              )}
            </Text>
          ) : null}
        </View>
      )}

      <Text variant="titleMedium">
        {t('accounts.purchaseCredits.title', 'Store credits')}
      </Text>
      {usableCredits.length === 0 ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('accounts.purchaseCredits.empty', 'No store credits yet.')}
        </Text>
      ) : (
        <Text>
          {formatCurrency(creditTotal, creditCurrency)} · {usableCredits.length}{' '}
          {t('accounts.purchaseCredits.balances', 'balance(s)')}
        </Text>
      )}
      <Button mode="outlined" onPress={() => navigation.navigate('UserPurchaseCredits')}>
        {t('accounts.purchaseCredits.viewDetails', 'View details')}
      </Button>

      <Text variant="titleMedium">
        {t('accounts.schedules.title', 'Payment schedules')}
      </Text>
      {(summary?.assignments || []).length === 0 ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('accounts.schedules.empty', 'No payment schedules.')}
        </Text>
      ) : (
        (summary?.assignments || []).map((row) => (
          <Button
            key={row.id}
            mode={
              ['pending', 'deferred'].includes(row.decision || '')
                ? 'contained'
                : 'outlined'
            }
            onPress={() =>
              navigation.navigate('PaymentScheduleDetail', {
                assignmentId: row.id,
              })
            }
          >
            {row.schedule?.name} · {row.amount} {row.currency} ·{' '}
            {['pending', 'deferred'].includes(row.decision || '')
              ? t('accounts.schedules.needsResponse', 'Needs your response')
              : row.status}
          </Button>
        ))
      )}
    </ScrollView>
  );
}

function StatLine({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.statLine}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {label}
      </Text>
      <Text
        variant={emphasize ? 'titleMedium' : 'bodyLarge'}
        style={{
          fontWeight: emphasize ? '700' : '600',
          color: emphasize ? colors.primary.main : colors.text.primary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stats: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
});
