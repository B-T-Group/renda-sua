import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Merchant holding a phone — FTUE slide 2. */
export function OnboardingMerchantIllustration({ size = 140 }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const warm = colors.warning.main;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Merchant managing a store from a phone"
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={accent} opacity={0.08} />
        <Circle cx="70" cy="42" r="16" fill={`${accent}33`} stroke={accent} strokeWidth={2} />
        <Path
          d="M42 118c4-28 16-40 28-40s24 12 28 40"
          stroke={accent}
          strokeWidth={2.5}
          fill={`${accent}14`}
          strokeLinejoin="round"
        />
        <Rect
          x="78"
          y="58"
          width="28"
          height="44"
          rx="5"
          fill={`${warm}22`}
          stroke={warm}
          strokeWidth={2}
        />
        <Rect x="84" y="66" width="16" height="22" rx="2" fill={warm} opacity={0.35} />
        <Circle cx="92" cy="94" r="2" fill={warm} />
      </Svg>
    </View>
  );
}
