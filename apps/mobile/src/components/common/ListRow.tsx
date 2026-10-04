import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
};

/** A single tappable row. Use this instead of wrapping every line in a card. */
export function ListRow({ title, subtitle, leading, trailing, onPress, showChevron = true }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: pressed ? colors.surfaceInput : colors.surface,
        },
      ]}
    >
      {leading}
      <View style={[styles.body, { marginLeft: leading ? spacing.sm : 0 }]}>
        <AppText role="body" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText role="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {showChevron && onPress ? (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.muted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  body: { flex: 1, minWidth: 0 },
});
