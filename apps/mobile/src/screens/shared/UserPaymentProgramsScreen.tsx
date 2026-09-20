import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@/services/apiClient';
import { spacing } from '@/theme';
import { isUsablePurchaseCredit } from '@/utils/purchaseCredits';
import { formatCurrency } from '@/utils/formatters';

interface Summary {
  facilities: Array<{
    id: string;
    status: string;
    limit_amount: number;
    currency: string;
    account?: { cash_advance_balance?: number };
    program?: { name?: string };
  }>;
  grants: Array<{
    id: string;
    remaining_amount: number;
    amount: number;
    currency: string;
    applicability: string;
    revoked_at?: string | null;
    expires_at?: string | null;
  }>;
  assignments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    schedule?: { name?: string; frequency?: string };
  }>;
}

export default function UserPaymentProgramsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<Summary>('/payment-programs/me');
    setSummary(data);
  }, []);

  useEffect(() => {
    void load().catch((err: any) => setError(err?.message || 'Failed'));
  }, [load]);

  const facility = summary?.facilities.find((row) => row.status === 'active');
  const usableCredits = (summary?.grants || []).filter(isUsablePurchaseCredit);
  const creditTotal = usableCredits.reduce(
    (sum, g) => sum + Number(g.remaining_amount),
    0
  );
  const creditCurrency = usableCredits[0]?.currency ?? 'XAF';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Text variant="headlineSmall">{t('accounts.walletHub.title', 'Wallet programs')}</Text>
      {error ? <Text>{error}</Text> : null}
      <Text variant="titleMedium">{t('accounts.cashAdvance.title', 'Cash advance')}</Text>
      {!facility ? (
        <Text>{t('accounts.cashAdvance.empty', 'You do not have an open cash advance.')}</Text>
      ) : (
        <View>
          <Text>
            {facility.program?.name} · {facility.limit_amount} {facility.currency}
          </Text>
          <TextInput
            mode="outlined"
            label={t('accounts.cashAdvance.amount', 'Amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Button
            mode="contained"
            onPress={() =>
              void api
                .post('/payment-programs/cash-advance/draw', {
                  amount: Number(amount),
                  currency: facility.currency,
                })
                .then(load)
            }
          >
            {t('accounts.cashAdvance.draw', 'Draw')}
          </Button>
        </View>
      )}
      <Text variant="titleMedium">{t('accounts.purchaseCredits.title', 'Store credits')}</Text>
      {usableCredits.length === 0 ? (
        <Text>{t('accounts.purchaseCredits.empty', 'No store credits yet.')}</Text>
      ) : (
        <Text>
          {formatCurrency(creditTotal, creditCurrency)} · {usableCredits.length}{' '}
          {t('accounts.purchaseCredits.balances', 'balance(s)')}
        </Text>
      )}
      <Button mode="outlined" onPress={() => navigation.navigate('UserPurchaseCredits')}>
        {t('accounts.purchaseCredits.viewDetails', 'View details')}
      </Button>
      <Text variant="titleMedium">{t('accounts.schedules.title', 'Payment schedules')}</Text>
      {(summary?.assignments || []).map((row) => (
        <Text key={row.id}>
          {row.schedule?.name} · {row.amount} {row.currency} · {row.status}
        </Text>
      ))}
    </ScrollView>
  );
}
