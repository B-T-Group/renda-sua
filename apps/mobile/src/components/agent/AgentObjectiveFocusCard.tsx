import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/services/apiClient';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '@/theme';
import { ObjectiveProgressRing } from './ObjectiveProgressRing';
import {
  formatObjectivePair,
  objectiveGapLabel,
  OBJECTIVE_ROWS,
  type ObjectiveProgress,
} from './objectiveProgress';

interface FocusAssignment {
  id: string;
  currency: string;
  schedule: { name: string };
  progress: ObjectiveProgress;
}

interface FocusResponse {
  assignment: FocusAssignment | null;
  otherCount: number;
}

export function AgentObjectiveFocusCard() {
  const focus = useObjectiveFocus();
  if (focus.loading || !focus.assignment) return null;
  return <FocusBody assignment={focus.assignment} otherCount={focus.otherCount} />;
}

function useObjectiveFocus() {
  const [assignment, setAssignment] = useState<FocusAssignment | null>(null);
  const [otherCount, setOtherCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const body = await api.get<FocusResponse>('/payment-programs/schedules/focus');
      setAssignment(body.assignment ?? null);
      setOtherCount(body.otherCount ?? 0);
    } catch {
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { assignment, otherCount, loading };
}

function FocusBody({
  assignment,
  otherCount,
}: {
  assignment: FocusAssignment;
  otherCount: number;
}) {
  const { t } = useTranslation();
  const { colors, shadows, borderRadius } = useTheme();
  const navigation = useNavigation<{
    getParent: () => { navigate: (route: string, params?: object) => void } | undefined;
  }>();
  const nextKey = assignment.progress.nextObjective;
  const next = nextKey ? assignment.progress[nextKey] : null;
  const meta = OBJECTIVE_ROWS.find((row) => row.key === nextKey);
  const overall = assignment.progress.overallPercent ?? 0;
  const open = (route: string, params?: object) => {
    navigation.getParent()?.navigate(route, params);
  };

  return (
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
      <View style={styles.header}>
        <ObjectiveProgressRing
          percent={overall}
          label={t('accounts.schedules.focus.overall', '{{percent}}% overall', {
            percent: overall,
          })}
        />
        <View style={styles.headerText}>
          <Text variant="titleMedium">{assignment.schedule.name}</Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('accounts.schedules.focus.overall', '{{percent}}% overall', { percent: overall })}
          </Text>
        </View>
      </View>
      <Text variant="titleMedium">{headline(assignment, t)}</Text>
      {next && meta && next.percent != null ? (
        <View style={styles.bar}>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {formatObjectivePair(next.actual, next.target ?? 0, meta.money, assignment.currency)}
          </Text>
          <ProgressBar progress={next.percent / 100} color={colors.primary.main} />
        </View>
      ) : null}
      <Button
        mode="text"
        onPress={() => open('PaymentScheduleDetail', { assignmentId: assignment.id })}
      >
        {t('accounts.schedules.focus.seeAll', 'See all objectives')}
      </Button>
      {otherCount > 0 ? (
        <Button mode="text" onPress={() => open('UserPaymentPrograms')}>
          {otherPlansLabel(otherCount, t)}
        </Button>
      ) : null}
    </View>
  );
}

function headline(
  assignment: FocusAssignment,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
) {
  const nextKey = assignment.progress.nextObjective;
  if (!nextKey) {
    return t(
      'accounts.schedules.focus.allMet',
      "You've met every objective on this plan."
    );
  }
  return objectiveGapLabel(nextKey, assignment.progress[nextKey], assignment.currency, t);
}

function otherPlansLabel(
  count: number,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
) {
  if (count === 1) return t('accounts.schedules.focus.otherPlan', 'You have another plan');
  return t('accounts.schedules.focus.otherPlans', 'You have {{count}} other plans', { count });
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  bar: { gap: spacing.xs },
});
