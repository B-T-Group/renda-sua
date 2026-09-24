import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, ProgressBar, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '@/services/apiClient';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/AgentRootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentScheduleDetail'>;

const REJECT_REASONS = [
  'too_aggressive',
  'not_ready_now',
  'targets_unclear',
  'other',
] as const;

type RejectReason = (typeof REJECT_REASONS)[number];

interface Detail {
  id: string;
  status: string;
  decision: string;
  amount: number;
  currency: string;
  schedule: { name: string; frequency: string };
  targets: {
    agentRecruitments: number | null;
    clientSignups: number | null;
    merchantRecruitments: number | null;
    itemSalesAmount: number | null;
    rentalAmount: number | null;
  };
  progress: {
    agentRecruitments: { actual: number };
    clientSignups: { actual: number };
    merchantRecruitments: { actual: number };
    itemSales: { actual: number };
    rentals: { actual: number };
    completionPercent: number | null;
  };
}

export default function PaymentScheduleDetailScreen({ route }: Props) {
  const { assignmentId } = route.params;
  const { t } = useTranslation();
  const { colors, shadows, borderRadius } = useTheme();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<RejectReason>('not_ready_now');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Detail>(`/payment-programs/schedules/${assignmentId}`);
      setDetail(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(path: string, body?: Record<string, unknown>, ok?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const data = await api.post<Detail>(
        `/payment-programs/schedules/${assignmentId}/${path}`,
        body ?? {}
      );
      setDetail(data);
      if (ok) setMessage(ok);
    } catch (err: any) {
      setMessage(err?.message || t('accounts.schedules.actionFailed', 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centered}>
        <Text>{error || t('accounts.schedules.empty', 'No payment schedules.')}</Text>
      </View>
    );
  }

  const awaiting = ['pending', 'deferred'].includes(detail.decision);
  const percent = detail.progress.completionPercent;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.background.paper,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        <Text variant="titleLarge">{detail.schedule.name}</Text>
        <Text>
          {detail.amount} {detail.currency} · {detail.schedule.frequency}
        </Text>
        <Text variant="bodySmall">
          {detail.status} · {detail.decision}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.background.paper,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        <Text variant="titleMedium">
          {t('accounts.schedules.objectives', 'Objectives')}
        </Text>
        {percent != null && detail.decision === 'accepted' ? (
          <View style={{ gap: spacing.xs }}>
            <Text>
              {t('accounts.schedules.salesCompletion', 'Sales completion')}: {percent}%
            </Text>
            <ProgressBar progress={percent / 100} color={colors.primary.main} />
          </View>
        ) : null}
        <ObjectiveLines detail={detail} />
        {detail.decision !== 'accepted' ? (
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'accounts.schedules.progressAfterAccept',
              'Live progress starts after you accept.'
            )}
          </Text>
        ) : null}
      </View>

      {awaiting ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            mode="contained"
            disabled={busy}
            onPress={() =>
              void act('accept', {}, t('accounts.schedules.accepted', 'Payment plan accepted'))
            }
          >
            {t('accounts.schedules.accept', 'Accept')}
          </Button>
          <Button
            mode="outlined"
            disabled={busy}
            onPress={() =>
              void act('defer', {}, t('accounts.schedules.deferred', 'You can decide later'))
            }
          >
            {t('accounts.schedules.defer', 'Decide later')}
          </Button>
          <Text variant="labelLarge">
            {t('accounts.schedules.rejectReason', 'Reject reason')}
          </Text>
          {REJECT_REASONS.map((code) => (
            <Pressable key={code} onPress={() => setReason(code)}>
              <Text style={{ fontWeight: reason === code ? '700' : '400' }}>
                {t(`accounts.schedules.reasons.${code}`, reasonLabel(code))}
              </Text>
            </Pressable>
          ))}
          {reason === 'other' ? (
            <TextInput
              mode="outlined"
              label={t('accounts.schedules.rejectNote', 'Tell us more')}
              value={note}
              onChangeText={setNote}
              multiline
            />
          ) : null}
          <Button
            mode="contained-tonal"
            disabled={busy || (reason === 'other' && !note.trim())}
            onPress={() =>
              void act(
                'reject',
                { reason, note: note || undefined },
                t('accounts.schedules.rejected', 'Payment plan rejected')
              )
            }
          >
            {t('accounts.schedules.reject', 'Reject')}
          </Button>
        </View>
      ) : null}

      {message ? <Text>{message}</Text> : null}
    </ScrollView>
  );
}

function reasonLabel(code: string) {
  switch (code) {
    case 'too_aggressive':
      return 'Too aggressive';
    case 'not_ready_now':
      return 'Not ready to accept now';
    case 'targets_unclear':
      return 'Targets are unclear';
    default:
      return 'Other';
  }
}

function ObjectiveLines({ detail }: { detail: Detail }) {
  const { t } = useTranslation();
  const lines: string[] = [];
  if (detail.targets.agentRecruitments != null) {
    lines.push(
      `${t('accounts.schedules.agentRecruitments', 'Agent recruitments')}: ${detail.progress.agentRecruitments.actual} / ${detail.targets.agentRecruitments}`
    );
  }
  if (detail.targets.clientSignups != null) {
    lines.push(
      `${t('accounts.schedules.clientSignups', 'Client signups')}: ${detail.progress.clientSignups.actual} / ${detail.targets.clientSignups}`
    );
  }
  if (detail.targets.merchantRecruitments != null) {
    lines.push(
      `${t('accounts.schedules.merchantRecruitments', 'Merchant recruitments')}: ${detail.progress.merchantRecruitments.actual} / ${detail.targets.merchantRecruitments}`
    );
  }
  if (detail.targets.itemSalesAmount != null) {
    lines.push(
      `${t('accounts.schedules.itemSales', 'Item sales')}: ${detail.progress.itemSales.actual} / ${detail.targets.itemSalesAmount} ${detail.currency}`
    );
  }
  if (detail.targets.rentalAmount != null) {
    lines.push(
      `${t('accounts.schedules.rentals', 'Rentals')}: ${detail.progress.rentals.actual} / ${detail.targets.rentalAmount} ${detail.currency}`
    );
  }
  if (!lines.length) {
    return (
      <Text>
        {t('accounts.schedules.noObjectives', 'This plan has no attached objectives.')}
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.xs }}>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
