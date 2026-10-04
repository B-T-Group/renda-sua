import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from './AppText';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const { spacing, colors } = useTheme();
  return (
    <View style={[styles.row, { paddingHorizontal: spacing.md, marginBottom: spacing.sm }]}>
      <AppText role="h3" accessibilityRole="header" style={{ flex: 1, marginRight: spacing.sm }} numberOfLines={1}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <AppText role="label" color={colors.primary.main}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
