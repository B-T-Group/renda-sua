import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Sparkle over a photo — async AI cleanup metaphor. */
export function AiImageCleanupVector({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="AI photo cleanup"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
        <Rect x="28" y="34" width="48" height="52" rx="6" fill={primary} opacity={0.85} />
        <Circle cx="44" cy="50" r="6" fill={colors.surface} opacity={0.9} />
        <Path
          d="M34 74 L48 62 L58 70 L72 52 L76 78 L34 78 Z"
          fill={colors.surface}
          opacity={0.85}
        />
        <Path
          d="M88 28 L92 40 L104 44 L92 48 L88 60 L84 48 L72 44 L84 40 Z"
          fill={secondary}
        />
        <Path
          d="M98 62 L100 70 L108 72 L100 74 L98 82 L96 74 L88 72 L96 70 Z"
          fill={primary}
          opacity={0.7}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
