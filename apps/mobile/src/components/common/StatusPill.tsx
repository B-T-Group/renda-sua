import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';

export interface StatusPillProps {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Smaller padding/font for dense rows. */
  compact?: boolean;
  /** Renders a small leading dot to imply a live/real-time signal. */
  leadingDot?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Self-sizing status badge that renders reliably on iOS.
 * Uses a View + Text pill instead of react-native-paper `Chip`, whose
 * fixed height and single-line text container clip short labels on iOS.
 */
export function StatusPill({
  label,
  backgroundColor,
  textColor,
  borderColor,
  icon,
  compact,
  leadingDot,
  style,
}: StatusPillProps) {
  return (
    <View
      style={[
        styles.pill,
        compact ? styles.compact : styles.regular,
        {
          backgroundColor,
          borderColor: borderColor ?? 'transparent',
          borderWidth: borderColor ? 1 : 0,
        },
        style,
      ]}
    >
      {leadingDot ? (
        <View
          style={[
            styles.dot,
            compact ? styles.dotCompact : styles.dotRegular,
            { backgroundColor: textColor },
          ]}
        />
      ) : null}
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={compact ? 12 : 14}
          color={textColor}
          style={styles.icon}
        />
      ) : null}
      <Text style={[styles.label, { color: textColor, fontSize: compact ? 11 : 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
  },
  regular: { paddingHorizontal: 12, paddingVertical: 5 },
  compact: { paddingHorizontal: 10, paddingVertical: 3 },
  icon: { marginRight: 4 },
  label: {
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dot: { borderRadius: 999, marginRight: 6 },
  dotRegular: { width: 7, height: 7 },
  dotCompact: { width: 6, height: 6 },
});
