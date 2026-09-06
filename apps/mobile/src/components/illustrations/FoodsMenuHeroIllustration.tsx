import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number; accessibilityLabel?: string };

/** Covered dish plus a notification bell — order, kitchen prep, ready alert. */
export function FoodsMenuHeroIllustration({
  size = 120,
  accessibilityLabel = 'Order food, restaurant prepares it, you get notified',
}: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary?.main ?? colors.info.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.12} />
        <Path d="M22 78 H78" stroke={primary} strokeWidth={4} strokeLinecap="round" />
        <Path d="M28 76 A26 26 0 0 1 72 76 Z" fill={primary} opacity={0.88} />
        <Circle cx="50" cy="48" r="4" fill={paper} />
        <Path
          d="M36 86 H64"
          stroke={primary}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.4}
        />
        <Circle cx="88" cy="38" r="18" fill={secondary} />
        <Path
          d="M80 38 a8 8 0 0 1 16 0 c0 7-4 9-4 9 H84 s-4-2-4-9"
          fill={paper}
        />
        <Rect x="86" y="26" width="4" height="5" rx="2" fill={paper} />
        <Circle cx="98" cy="30" r="5" fill={colors.error.main} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
