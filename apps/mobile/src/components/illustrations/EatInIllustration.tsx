import { View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Set table: the customer wants to eat in. */
export function EatInIllustration({ size = 96 }: { size?: number }) {
  const { colors } = useTheme();
  const height = Math.round(size * 0.72);
  const color = colors.primary.main;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Eat in">
      <Svg width={size} height={height} viewBox="0 0 120 86">
        <Rect x="18" y="58" width="84" height="8" rx="2" fill={color} opacity={0.25} />
        <Rect x="28" y="66" width="6" height="14" rx="1" fill={color} />
        <Rect x="86" y="66" width="6" height="14" rx="1" fill={color} />
        <Ellipse cx="60" cy="40" rx="22" ry="10" stroke={color} strokeWidth={3} fill="none" />
        <Path d="M48 40c2 8 22 8 24 0" stroke={color} strokeWidth={3} fill="none" />
        <Path
          d="M38 28c6-10 14-10 16 0M66 28c2-10 10-10 16 0"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
