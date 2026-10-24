import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import { businessApi } from '@/services/businessApi';
import type { BusinessRootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessGiftAiTokens'
>;

export default function BusinessGiftAiTokensScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [maskedName, setMaskedName] = useState('');
  const [giftable, setGiftable] = useState(0);
  const [amount, setAmount] = useState('10');
  const [lookingUp, setLookingUp] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idempotencyKey] = useState(
    () => `gift-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const normalized = useMemo(
    () => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    [code]
  );
  const amountNum = Number.parseInt(amount, 10) || 0;

  useEffect(() => {
    void businessApi.tokens.balance().then((res) => {
      setGiftable(res.data?.giftable ?? 0);
    });
  }, []);

  useEffect(() => {
    if (normalized.length !== 6) {
      setMaskedName('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setLookingUp(true);
          setError(null);
          const res = await businessApi.tokens.giftLookup(normalized);
          if (!cancelled) setMaskedName(res.data?.maskedName ?? '');
        } catch (err: unknown) {
          if (!cancelled) {
            setMaskedName('');
            setError(
              err instanceof Error
                ? err.message
                : t(
                    'business.tokens.gift.code_not_found',
                    'No user found with this code.'
                  )
            );
          }
        } finally {
          if (!cancelled) setLookingUp(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, t]);

  const canSend =
    !!maskedName &&
    amountNum >= 10 &&
    amountNum <= 5000 &&
    amountNum <= giftable &&
    !sending;

  const onSend = async () => {
    try {
      setSending(true);
      setError(null);
      const res = await businessApi.tokens.sendGift({
        code: normalized,
        amount: amountNum,
        idempotencyKey,
      });
      setSuccess(
        t('business.tokens.gift.success', '{{n}} tokens sent to {{name}}.', {
          n: amountNum,
          name: res.data?.recipientMaskedName || maskedName,
        })
      );
      setGiftable(res.data?.balance?.giftable ?? giftable - amountNum);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'business.tokens.gift.generic_error',
              'Transfer failed. No tokens were deducted.'
            )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          padding: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          backgroundColor: colors.pageBackground,
          gap: spacing.md,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="titleLarge" style={{ color: colors.text.primary }}>
        {t('business.tokens.gift.title', 'Gift AI tokens')}
      </Text>
      <TextInput
        mode="outlined"
        label={t(
          'business.tokens.gift.code_label',
          "Recipient's referral code"
        )}
        value={normalized}
        onChangeText={setCode}
        maxLength={6}
        autoCapitalize="characters"
        right={lookingUp ? <TextInput.Icon icon={() => <ActivityIndicator />} /> : undefined}
      />
      {maskedName ? (
        <Text style={{ color: colors.success.main }}>
          {t('business.tokens.gift.code_found', 'Sending to {{name}}', {
            name: maskedName,
          })}
        </Text>
      ) : null}
      <Text style={{ color: colors.text.secondary }}>
        {t('business.tokens.gift.transferable', 'Transferable: {{n}} tokens', {
          n: giftable,
        })}
      </Text>
      <TextInput
        mode="outlined"
        label={t('business.tokens.gift.amount_label', 'Amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
      />
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {success ? (
        <Text style={{ color: colors.success.main }}>{success}</Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: colors.warning.dark }}>
        {t(
          'business.tokens.gift.confirm_body',
          "Transfers are final and can't be reversed."
        )}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Button mode="contained" disabled={!canSend} loading={sending} onPress={() => void onSend()}>
          {t('business.tokens.gift.send', 'Send')}
        </Button>
        <Button mode="text" onPress={() => navigation.goBack()}>
          {success
            ? t('common.done', 'Done')
            : t('business.tokens.gift.cancel', 'Cancel')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
