import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Agent accompanying a business through onboarding. */
export function BusinessReferralSupportVector({ size = 140 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Help businesses onboard"
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={primary} opacity={0.08} />
        <Circle cx="48" cy="52" r="14" fill={primary} />
        <Path
          d="M28 88 C28 72 68 72 68 88"
          fill={primary}
          opacity={0.85}
        />
        <Circle cx="92" cy="56" r="12" fill={secondary} />
        <Path
          d="M76 90 C76 76 108 76 108 90"
          fill={secondary}
          opacity={0.9}
        />
        <Rect x="54" y="96" width="32" height="8" rx="4" fill={primary} opacity={0.25} />
        <Circle cx="70" cy="28" r="6" fill={colors.success.main} />
        <Path
          d="M67 28 L69 30 L74 25"
          stroke={paper}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
