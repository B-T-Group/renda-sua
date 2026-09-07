import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Marketplace + local shops + delivery metaphor for FTUE slide 1. */
export function OnboardingMarketplaceIllustration({ size = 140 }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const secondary = colors.secondary.main;
  const success = colors.success.main;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Local marketplace with shops and delivery"
    >
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r="64" fill={accent} opacity={0.08} />
        <Rect x="28" y="48" width="36" height="44" rx="6" fill={`${accent}22`} stroke={accent} strokeWidth={2} />
        <Path d="M28 56h36" stroke={accent} strokeWidth={2} />
        <Rect x="36" y="64" width="10" height="10" rx="2" fill={accent} opacity={0.35} />
        <Rect x="50" y="64" width="10" height="10" rx="2" fill={accent} opacity={0.35} />
        <Rect x="76" y="42" width="40" height="50" rx="6" fill={`${secondary}18`} stroke={secondary} strokeWidth={2} />
        <Circle cx="96" cy="62" r="8" fill={secondary} opacity={0.35} />
        <Path
          d="M30 110c12-14 28-14 40 0 12-14 28-14 40 0"
          stroke={success}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M98 96l14 6-4 12"
          stroke={success}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="108" cy="118" r="5" fill={success} opacity={0.4} />
      </Svg>
    </View>
  );
}
