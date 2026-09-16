import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
  accessibilityLabel: string;
};

/** Phone reel plus review clock — generation started, not live yet. */
export function ReelAiSubmittedIllustration({
  size = 128,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const accent = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ alignItems: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Rect x="28" y="12" width="52" height="80" rx="12" fill={accent} opacity={0.14} />
        <Rect
          x="34"
          y="18"
          width="40"
          height="68"
          rx="8"
          fill={paper}
          stroke={accent}
          strokeWidth={2}
        />
        <Circle cx="54" cy="46" r="12" fill={accent} opacity={0.22} />
        <Path d="M50 40 L62 46 L50 52 Z" fill={accent} />
        <Rect x="42" y="70" width="24" height="6" rx="3" fill={accent} opacity={0.45} />
        <Circle cx="88" cy="78" r="22" fill={success} opacity={0.18} />
        <Circle cx="88" cy="78" r="15" fill={paper} stroke={success} strokeWidth={2.5} />
        <Path
          d="M88 70 v9 l6 4"
          stroke={success}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
