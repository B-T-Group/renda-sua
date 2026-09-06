import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Commission from referred business sales — store + coin flow. */
export function BusinessReferralCommissionVector({ size = 140 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Commission from business sales"
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={primary} opacity={0.08} />
        <Rect x="28" y="48" width="52" height="44" rx="8" fill={primary} />
        <Path d="M28 60 H80" stroke={paper} strokeWidth={2} opacity={0.35} />
        <Rect x="36" y="68" width="20" height="16" rx="3" fill={paper} opacity={0.9} />
        <Path
          d="M80 70 H96"
          stroke={success}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M90 64 L98 70 L90 76"
          stroke={success}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx="112" cy="70" r="18" fill={success} />
        <Path
          d="M112 60 V80 M104 68 H120"
          stroke={paper}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
