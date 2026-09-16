import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

export function ReelComposerIllustration({ size = 120 }: { size?: number }) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="">
      <Rect x="24" y="16" width="72" height="88" rx="12" fill={accent} opacity={0.15} />
      <Circle cx="60" cy="52" r="18" fill={accent} opacity={0.35} />
      <Path d="M52 52 L68 60 L52 68 Z" fill={accent} />
      <Rect x="36" y="84" width="48" height="8" rx="4" fill={accent} opacity={0.5} />
    </Svg>
  );
}
