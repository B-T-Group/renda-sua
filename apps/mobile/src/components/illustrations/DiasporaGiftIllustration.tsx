import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
  label: string;
};

/** Gift and gold stars — sending care to someone. */
export function DiasporaGiftIllustration({ size = 56, label }: Props) {
  const { colors } = useTheme();

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r="44" fill={colors.warningTint} />
        <GoldStar cx={70} cy={22} fill={colors.warning.main} />
        <GoldStar cx={22} cy={28} fill={colors.warning.light} scale={0.55} />
        <Rect x="30" y="40" width="36" height="28" rx="4" fill={colors.primary.main} />
        <Rect x="30" y="34" width="36" height="10" rx="3" fill={colors.warning.main} />
        <Rect x="44" y="34" width="8" height="34" fill={colors.background.paper} />
        <Rect x="30" y="44" width="36" height="6" fill={colors.background.paper} opacity={0.9} />
      </Svg>
    </View>
  );
}

function GoldStar({
  cx,
  cy,
  fill,
  scale = 1,
}: {
  cx: number;
  cy: number;
  fill: string;
  scale?: number;
}) {
  const d =
    'M12 2.2 14.7 8.6 21.6 9.2 16.4 13.6 18 20.3 12 16.8 6 20.3 7.6 13.6 2.4 9.2 9.3 8.6 Z';
  return (
    <G transform={`translate(${cx} ${cy}) scale(${scale}) translate(-12 -12)`}>
      <Path d={d} fill={fill} />
    </G>
  );
}
