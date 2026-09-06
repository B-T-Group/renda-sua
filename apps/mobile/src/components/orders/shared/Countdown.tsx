import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { useCountdown } from '../../../hooks/useCountdown';
import { StatusPill } from '../../common/StatusPill';

export interface CountdownProps {
  deadlineAt: string | Date | null | undefined;
  label?: string;
  overdueLabel?: string;
  compact?: boolean;
}

function formatRemaining(
  secondsLeft: number,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
): string {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return t('orders.countdown.hoursMinutes', '{{hours}}h {{mins}}m', {
      hours,
      mins: remMins,
    });
  }
  if (mins > 0) {
    return t('orders.countdown.minutesSeconds', '{{mins}}m {{secs}}s', {
      mins,
      secs,
    });
  }
  return t('orders.countdown.seconds', '{{secs}}s', { secs });
}

export function Countdown({
  deadlineAt,
  label,
  overdueLabel,
  compact = false,
}: CountdownProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const iso =
    deadlineAt == null
      ? null
      : typeof deadlineAt === 'string'
        ? deadlineAt
        : deadlineAt.toISOString();
  const secondsLeft = useCountdown(iso);

  if (!deadlineAt) return null;
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;

  const overdue = secondsLeft <= 0;
  const text = overdue
    ? overdueLabel ?? t('orders.countdown.overdue', 'Overdue')
    : formatRemaining(secondsLeft, t as never);
  const display = label ? `${label}: ${text}` : text;
  const tone = overdue ? colors.error.main : colors.warning.main;

  if (compact) {
    return (
      <StatusPill
        compact
        label={display}
        backgroundColor={tone + '22'}
        textColor={tone}
        borderColor={tone + '55'}
        icon={overdue ? 'alert' : 'clock-outline'}
      />
    );
  }

  return (
    <View style={[styles.row, { gap: spacing.xs }]}>
      <MaterialCommunityIcons
        name={overdue ? 'alert' : 'clock-outline'}
        size={16}
        color={tone}
      />
      <Text variant="bodyMedium" style={{ color: tone, fontWeight: '600' }}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
