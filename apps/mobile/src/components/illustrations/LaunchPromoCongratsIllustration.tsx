import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Gift-style 0% launch promo celebration. */
export function LaunchPromoCongratsIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;
  const warning = colors.warning.main;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Launch promo celebration"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={success} opacity={0.12} />
        <Rect x="34" y="52" width="52" height="36" rx="6" fill={primary} />
        <Rect x="34" y="44" width="52" height="14" rx="4" fill={warning} />
        <Rect x="54" y="44" width="12" height="44" fill={paper} opacity={0.9} />
        <SvgText
          x="60"
          y="78"
          textAnchor="middle"
          fill={paper}
          fontSize="14"
          fontWeight="700"
        >
          0%
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
