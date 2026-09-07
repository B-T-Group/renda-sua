import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Storefront + map pin — first business location teaching visual. */
export function StorefrontPinIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Store location"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
        <Rect x="30" y="48" width="60" height="42" rx="6" fill={paper} stroke={primary} strokeWidth={2} />
        <Path d="M26 48 L60 28 L94 48" fill={primary} opacity={0.9} />
        <Rect x="52" y="62" width="16" height="28" rx="2" fill={secondary} opacity={0.85} />
        <Rect x="36" y="58" width="12" height="12" rx="2" fill={primary} opacity={0.25} />
        <Rect x="72" y="58" width="12" height="12" rx="2" fill={primary} opacity={0.25} />
        <Path
          d="M88 34 C80 34 74 40 74 47 C74 56 88 68 88 68 C88 68 102 56 102 47 C102 40 96 34 88 34 Z"
          fill={secondary}
        />
        <Circle cx="88" cy="47" r="5" fill={paper} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
