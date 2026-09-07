import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Empty rentals browse: calendar with empty slots. */
export function RentalsEmptyIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="No rental listings found"
      style={{ alignItems: 'center' }}
    >
      <Svg width={140} height={112} viewBox="0 0 140 112">
        <Rect x="32" y="24" width="76" height="64" rx="10" fill={colors.pageBackground} stroke={colors.divider} strokeWidth={2} />
        <Rect x="32" y="24" width="76" height="16" rx="10" fill={colors.primary.main} opacity={0.75} />
        <Circle cx="52" cy="56" r="4" fill={colors.text.disabled} opacity={0.5} />
        <Circle cx="70" cy="56" r="4" fill={colors.text.disabled} opacity={0.5} />
        <Circle cx="88" cy="56" r="4" fill={colors.text.disabled} opacity={0.5} />
        <Circle cx="52" cy="72" r="4" fill={colors.text.disabled} opacity={0.35} />
        <Circle cx="70" cy="72" r="4" fill={colors.text.disabled} opacity={0.35} />
        <Path
          d="M96 88l12 12"
          stroke={colors.info.main}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx="88" cy="80" r="14" fill="none" stroke={colors.info.main} strokeWidth={2.5} opacity={0.7} />
      </Svg>
    </View>
  );
}
