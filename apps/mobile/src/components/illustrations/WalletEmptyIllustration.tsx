import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Empty wallet: open purse with no coins. */
export function WalletEmptyIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="No wallet accounts yet"
      style={{ alignItems: 'center' }}
    >
      <Svg width={140} height={112} viewBox="0 0 140 112">
        <Rect
          x="28"
          y="36"
          width="72"
          height="48"
          rx="10"
          fill={colors.primary.light}
          opacity={0.4}
        />
        <Path
          d="M28 52h72"
          stroke={colors.primary.main}
          strokeWidth={2.5}
          opacity={0.55}
        />
        <Circle cx="88" cy="64" r="8" fill={colors.primary.main} opacity={0.35} />
        <Rect
          x="92"
          y="48"
          width="20"
          height="16"
          rx="4"
          fill={colors.info.main}
          opacity={0.55}
        />
        <Path
          d="M48 96c10-8 34-8 44 0"
          stroke={colors.text.secondary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={0.35}
        />
      </Svg>
    </View>
  );
}
