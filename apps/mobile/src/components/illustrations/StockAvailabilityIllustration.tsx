import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Small teaching visual: shopper asking a store about stock. */
export function StockAvailabilityIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Shopper checking item availability with store"
      style={{ alignItems: 'center' }}
    >
      <Svg width={120} height={96} viewBox="0 0 120 96">
        <Rect x="8" y="28" width="40" height="48" rx="8" fill={colors.primary.light} opacity={0.35} />
        <Rect x="14" y="36" width="28" height="8" rx="2" fill={colors.primary.main} opacity={0.7} />
        <Rect x="14" y="50" width="20" height="6" rx="2" fill={colors.text.secondary} opacity={0.35} />
        <Circle cx="88" cy="40" r="18" fill={colors.info.light} opacity={0.45} />
        <Circle cx="88" cy="36" r="7" fill={colors.info.main} opacity={0.85} />
        <Path
          d="M72 58c4-8 12-12 16-12s12 4 16 12"
          stroke={colors.info.main}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M52 48h12"
          stroke={colors.warning.main}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Path
          d="M60 44l6 4-6 4"
          stroke={colors.warning.main}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
