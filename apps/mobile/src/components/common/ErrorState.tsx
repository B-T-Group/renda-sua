import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type Props = {
  title: string;
  body?: string;
  actionLabel: string;
  onRetry: () => void;
};

export function ErrorState({ title, body, actionLabel, onRetry }: Props) {
  const { spacing, colors } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl }]}>
      <AppText role="h3" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText role="bodySmall" color={colors.text.muted} style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {body}
        </AppText>
      ) : null}
      <AppButton label={actionLabel} onPress={onRetry} variant="outline" style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
