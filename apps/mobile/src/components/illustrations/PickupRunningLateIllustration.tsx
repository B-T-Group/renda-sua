import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Small teaching visual for the agent "running late / pickup SLA" moment. */
export function PickupRunningLateIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Courier heading to pickup with a clock"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={120} height={96} viewBox="0 0 120 96">
        <Circle cx="36" cy="48" r="28" fill={colors.primary.main + '22'} />
        <Circle
          cx="36"
          cy="48"
          r="18"
          stroke={colors.primary.main}
          strokeWidth="3"
          fill={colors.surface}
        />
        <Path
          d="M36 38 v10 l7 5"
          stroke={colors.warning.main}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <Rect
          x="68"
          y="34"
          width="36"
          height="28"
          rx="6"
          fill={colors.primaryTint}
          stroke={colors.primary.main}
          strokeWidth="2"
        />
        <Path
          d="M74 48 h24"
          stroke={colors.text.secondary}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Circle cx="86" cy="70" r="6" fill={colors.primary.main} />
        <Circle cx="102" cy="70" r="6" fill={colors.primary.main} />
      </Svg>
    </View>
  );
}
