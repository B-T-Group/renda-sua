import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Small teaching visual: pin with a courier route crossed out, i.e. "no courier found nearby". */
export function NoCourierFoundIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="No delivery courier available nearby"
      style={{ alignItems: 'center' }}
    >
      <Svg width={120} height={96} viewBox="0 0 120 96">
        <Circle cx="60" cy="44" r="30" fill={colors.warning.light} opacity={0.3} />
        <Path
          d="M60 26c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14z"
          fill={colors.warning.main}
          opacity={0.85}
        />
        <Circle cx="60" cy="40" r="5" fill={colors.surface} />
        <Path
          d="M34 68l52-40"
          stroke={colors.error.main}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
