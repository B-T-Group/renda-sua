import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Avatar placeholder + camera — encourage adding a profile photo. */
export function ProfilePhotoTipIllustration({ size = 96 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Add a profile picture"
    >
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r="44" fill={primary} opacity={0.08} />
        <Circle cx="48" cy="36" r="14" fill={primary} />
        <Path
          d="M22 78 C22 60 34 52 48 52 C62 52 74 60 74 78"
          fill={primary}
          opacity={0.85}
        />
        <Rect x="58" y="58" width="26" height="20" rx="5" fill={primary} />
        <Circle cx="71" cy="68" r="6" fill={paper} opacity={0.95} />
        <Circle cx="71" cy="68" r="3" fill={primary} />
      </Svg>
    </View>
  );
}
