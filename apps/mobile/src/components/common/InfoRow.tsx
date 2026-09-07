import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';

export interface InfoRowProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | React.ReactNode;
  /** If true, label and value are stacked vertically */
  vertical?: boolean;
  /**
   * Max lines for string values. Defaults to 2.
   * Pass `undefined` explicitly via omitting when using `truncate={false}`,
   * or set a higher number for long addresses.
   */
  numberOfLines?: number;
  /** When false, string values are not truncated (full multi-line text). */
  truncate?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Key-value information row used in order details, profile sections, etc.
 * Horizontal by default; pass `vertical` for stacked layout.
 */
export function InfoRow({
  icon,
  label,
  value,
  vertical = false,
  numberOfLines = 2,
  truncate = true,
  style,
}: InfoRowProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        vertical ? styles.vertical : styles.horizontal,
        { paddingVertical: spacing.xs },
        style,
      ]}
    >
      <View style={styles.labelRow}>
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={16}
            color={colors.text.secondary}
            style={{ marginRight: spacing.xs }}
          />
        ) : null}
        <Text style={[typography.caption, { color: colors.text.secondary }]}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text
          style={[
            typography.body,
            {
              color: colors.text.primary,
              fontWeight: '500',
              ...(vertical
                ? { marginTop: spacing.xxs }
                : { textAlign: 'right' as const, flex: 1, marginLeft: spacing.sm }),
            },
          ]}
          numberOfLines={truncate ? numberOfLines : undefined}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vertical: {
    flexDirection: 'column',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
