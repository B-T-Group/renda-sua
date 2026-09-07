import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Phone + payments + delivery/pickup — FTUE slide 3. */
export function OnboardingPaymentsIllustration({ size = 140 }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const success = colors.success.main;
  const info = colors.info.main;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Flexible payments, delivery, and pickup"
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={accent} opacity={0.08} />
        <Rect
          x="48"
          y="28"
          width="44"
          height="72"
          rx="8"
          fill={`${accent}14`}
          stroke={accent}
          strokeWidth={2.5}
        />
        <Rect x="56" y="40" width="28" height="40" rx="3" fill={accent} opacity={0.2} />
        <Circle cx="70" cy="90" r="3" fill={accent} />
        <Circle cx="34" cy="56" r="14" fill={`${success}22`} stroke={success} strokeWidth={2} />
        <Path d="M28 56h12M34 50v12" stroke={success} strokeWidth={2} strokeLinecap="round" />
        <Circle cx="106" cy="56" r="14" fill={`${info}22`} stroke={info} strokeWidth={2} />
        <Path
          d="M98 56h16M106 48v16"
          stroke={info}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0}
        />
        <Rect x="98" y="50" width="16" height="12" rx="2" fill={info} opacity={0.45} />
        <Path
          d="M40 112h60"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.4}
        />
        <Path
          d="M52 118c8-8 18-8 26 0s18 8 26 0"
          stroke={success}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
