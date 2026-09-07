import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Small teaching visual for a rejected referral payout review. */
export function ReferralRejectionIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Referral review rejected"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={120} height={96} viewBox="0 0 120 96">
        <Circle cx="60" cy="48" r="32" fill={colors.error.main + '18'} />
        <Rect
          x="38"
          y="30"
          width="44"
          height="36"
          rx="8"
          fill={colors.surface}
          stroke={colors.error.main}
          strokeWidth="2.5"
        />
        <Path
          d="M48 48 h24"
          stroke={colors.text.secondary}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <Path
          d="M52 58 h16"
          stroke={colors.text.secondary}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.6}
        />
        <Circle cx="86" cy="30" r="12" fill={colors.error.main} />
        <Path
          d="M81 25 l10 10 M91 25 l-10 10"
          stroke={colors.surface}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
