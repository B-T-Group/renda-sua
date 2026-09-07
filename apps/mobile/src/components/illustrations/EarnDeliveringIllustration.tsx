import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

export function EarnDeliveringIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const success = colors.success.main;

  return (
    <View accessibilityRole="image" accessibilityLabel="Earn money delivering">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={accent} opacity={0.08} />
        <Ellipse cx="36" cy="86" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}12`} />
        <Ellipse cx="84" cy="86" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}12`} />
        <Path
          d="M28 86h56M46 86V56h22l14 14v16"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx="78" cy="40" r="12" fill={`${success}33`} stroke={success} strokeWidth={2} />
        <Path d="M74 40h8M78 36v8" stroke={success} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
