import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number; label: string };

/** Purchase order document with a check, ready to ship. */
export function ExportOrderIllustration({ size = 140, label }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const ok = colors.success.main;

  return (
    <View accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={accent} opacity={0.08} />
        <Rect x="38" y="26" width="64" height="84" rx="8" fill={`${accent}14`} stroke={accent} strokeWidth={2.5} />
        <Path d="M50 46h40M50 58h40M50 70h24" stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        <Circle cx="94" cy="98" r="18" fill={ok} />
        <Path d="M85 98l7 7 12-14" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
