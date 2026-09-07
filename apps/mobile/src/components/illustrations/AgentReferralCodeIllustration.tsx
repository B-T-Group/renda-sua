import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
  /** When set, the illustration is announced as an image. Omit inside buttons. */
  accessibilityLabel?: string;
};

/** Agent handing a referral ticket to a shop owner. */
export function AgentReferralCodeIllustration({
  size = 56,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const warm = colors.warning.main;
  const decorative = !accessibilityLabel;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 72 56">
        <Circle cx="36" cy="28" r="26" fill={accent} opacity={0.08} />
        <Circle cx="20" cy="16" r="7" fill={`${accent}28`} stroke={accent} strokeWidth={2} />
        <Path
          d="M8 46c2-12 8-18 12-18s10 6 12 18"
          stroke={accent}
          strokeWidth={2}
          fill={`${accent}14`}
          strokeLinejoin="round"
        />
        <Circle cx="52" cy="16" r="7" fill={`${warm}28`} stroke={warm} strokeWidth={2} />
        <Path
          d="M40 46c2-12 8-18 12-18s10 6 12 18"
          stroke={warm}
          strokeWidth={2}
          fill={`${warm}14`}
          strokeLinejoin="round"
        />
        <Rect
          x="28"
          y="22"
          width="16"
          height="12"
          rx="3"
          fill={colors.surface}
          stroke={accent}
          strokeWidth={2}
        />
        <Path
          d="M32 26 h8 M32 30 h5"
          stroke={accent}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
