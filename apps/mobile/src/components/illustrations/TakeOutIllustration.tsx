import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Takeout bag: the customer will collect the order. */
export function TakeOutIllustration({
  size = 96,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const height = Math.round(size * 0.72);
  const ink = color ?? colors.primary.main;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Take out">
      <Svg width={size} height={height} viewBox="0 0 120 86">
        <Path
          d="M34 34h52l-4 40H38L34 34z"
          fill={ink}
          opacity={0.15}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Path d="M46 34c0-10 6-16 14-16s14 6 14 16" stroke={ink} strokeWidth={3} fill="none" />
        <Path d="M52 48h16" stroke={ink} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
