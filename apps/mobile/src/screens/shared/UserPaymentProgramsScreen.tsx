import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/apiClient';
import { spacing } from '@/theme';

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
      <Text variant="titleMedium">{t('accounts.purchaseCredits.title', 'Purchase credits')}</Text>
      {(summary?.grants || []).map((grant) => (
        <Text key={grant.id}>
          {grant.remaining_amount} {grant.currency} · {grant.applicability}
        </Text>
      ))}
      <Text variant="titleMedium">{t('accounts.schedules.title', 'Payment schedules')}</Text>
      {(summary?.assignments || []).map((row) => (
        <Text key={row.id}>
          {row.schedule?.name} · {row.amount} {row.currency} · {row.status}
        </Text>
      ))}
    </ScrollView>
  );
}
