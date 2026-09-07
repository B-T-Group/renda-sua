import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra bottom padding so content below can sit flush. */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Brand-tinted band for screen tops (home / dashboard).
 * Uses `primaryTint` so white cards below read with more depth.
 */
export const TintedHeaderBlock = memo(function TintedHeaderBlock({
  children,
  style,
  contentStyle,
}: Props) {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.primaryTint,
          borderBottomLeftRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
          marginBottom: spacing.md,
          paddingBottom: spacing.md,
        },
        style,
      ]}
    >
      <View
        style={[styles.sheen, { backgroundColor: colors.primary.main, opacity: 0.06 }]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.blob,
          {
            backgroundColor: colors.primary.light,
            opacity: 0.14,
            right: -48,
            top: -56,
          },
        ]}
        pointerEvents="none"
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
