import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Phone with a coin — confirms the number can receive Mobile Money. */
export function MobileMoneyConfirmIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Confirm mobile money number"
      style={{ alignItems: 'center' }}
    >
      <Svg width={140} height={120} viewBox="0 0 140 120">
        <Rect
          x="42"
          y="12"
          width="44"
          height="78"
          rx="8"
          fill={colors.primary.light}
          opacity={0.45}
        />
        <Rect
          x="48"
          y="24"
          width="32"
          height="48"
          rx="4"
          fill={colors.surface}
          opacity={0.9}
        />
        <Circle cx="64" cy="82" r="3.5" fill={colors.primary.main} opacity={0.7} />
        <Circle
          cx="98"
          cy="58"
          r="22"
          fill={colors.success.main}
          opacity={0.22}
        />
        <Circle
          cx="98"
          cy="58"
          r="16"
          fill={colors.success.main}
          opacity={0.55}
        />
        <Path
          d="M92 58h12M98 52v12"
          stroke={colors.surface}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Path
          d="M36 100c14-10 54-10 68 0"
          stroke={colors.text.secondary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
        />
      </Svg>
    </View>
  );
}
