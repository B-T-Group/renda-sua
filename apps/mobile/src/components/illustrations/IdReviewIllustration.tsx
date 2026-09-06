import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** ID card with a soft review clock — used while identity is pending. */
export function IdReviewIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Identification under review"
      style={{ alignItems: 'center' }}
    >
      <Svg width={120} height={96} viewBox="0 0 120 96">
        <Rect
          x="18"
          y="22"
          width="70"
          height="48"
          rx="8"
          fill={colors.primary.light}
          opacity={0.4}
        />
        <Rect
          x="24"
          y="28"
          width="58"
          height="36"
          rx="6"
          fill={colors.surface}
          opacity={0.95}
        />
        <Circle cx="40" cy="46" r="8" fill={colors.primary.main} opacity={0.35} />
        <Path
          d="M54 40h20M54 48h16M54 56h12"
          stroke={colors.text.secondary}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.55}
        />
        <Circle cx="92" cy="58" r="18" fill={colors.info.main} opacity={0.2} />
        <Circle
          cx="92"
          cy="58"
          r="12"
          fill={colors.surface}
          stroke={colors.info.main}
          strokeWidth={2}
        />
        <Path
          d="M92 52v7l5 3"
          stroke={colors.info.dark ?? colors.info.main}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
