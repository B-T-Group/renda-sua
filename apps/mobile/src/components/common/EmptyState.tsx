import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ReactNode;
};

/** Answers what happened and what the person can do next. */
export function EmptyState({ title, body, actionLabel, onAction, illustration }: Props) {
  const { spacing, colors } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl, backgroundColor: colors.appBackground }]}>
      {illustration}
      <AppText role="h2" accessibilityRole="header" style={{ textAlign: 'center', marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText role="body" style={{ textAlign: 'center', marginTop: spacing.xs }}>
        {body}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
