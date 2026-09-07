import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Storefront moving from one business to another. */
export function LocationTransferVector({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Transfer a location to another business"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
        <Rect x="18" y="48" width="28" height="28" rx="4" fill={primary} opacity={0.9} />
        <Path d="M18 52 L32 40 L46 52" fill={primary} />
        <Rect x="26" y="58" width="8" height="12" rx="1" fill={colors.surface} />
        <Path
          d="M52 60 H68"
          stroke={secondary}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M62 52 L72 60 L62 68"
          stroke={secondary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect x="74" y="48" width="28" height="28" rx="4" fill={secondary} opacity={0.9} />
        <Path d="M74 52 L88 40 L102 52" fill={secondary} />
        <Rect x="82" y="58" width="8" height="12" rx="1" fill={colors.surface} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
