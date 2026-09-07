import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

export function FavoritesIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const warm = colors.warning.main;

  return (
    <View accessibilityRole="image" accessibilityLabel="Save items for later">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={accent} opacity={0.08} />
        <Rect x="30" y="34" width="60" height="56" rx="8" fill={`${accent}14`} stroke={accent} strokeWidth={2} />
        <Path
          d="M60 48c-6-8-18-2-14 10 2 6 14 14 14 14s12-8 14-14c4-12-8-18-14-10z"
          fill={warm}
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}
