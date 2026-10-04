import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '@/theme';
import {
  formatObjectivePair,
  OBJECTIVE_ROWS,
  type ObjectiveMetric,
  type ObjectiveProgress,
} from './objectiveProgress';

export function ObjectiveProgressList({
  progress,
  currency,
  showPercent,
}: {
  progress: ObjectiveProgress;
  currency: string;
  showPercent: boolean;
}) {
  const { t } = useTranslation();
  const rows = OBJECTIVE_ROWS.filter((row) => progress[row.key].target != null);
  if (!rows.length) {
    return (
      <Text>
        {t('accounts.schedules.noObjectives', 'This plan has no attached objectives.')}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <ObjectiveRow
          key={row.key}
          label={t(row.labelKey, row.fallback)}
          metric={progress[row.key]}
          currency={currency}
          money={row.money}
          showPercent={showPercent}
        />
      ))}
    </View>
  );
}

function ObjectiveRow({
  label,
  metric,
  currency,
  money,
  showPercent,
}: {
  label: string;
  metric: ObjectiveMetric;
  currency: string;
  money: boolean;
  showPercent: boolean;
}) {
  const { colors } = useTheme();
  const pair = formatObjectivePair(metric.actual, metric.target ?? 0, money, currency);
  const percent = showPercent ? metric.percent : null;
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text variant="bodyMedium" style={styles.label}>
          {label}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {percent != null ? `${percent}% · ${pair}` : pair}
        </Text>
      </View>
      {percent != null ? (
        <ProgressBar progress={percent / 100} color={colors.primary.main} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  label: { flex: 1 },
});
