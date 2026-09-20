import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
  accessibilityLabel: string;
};

/** Gift / coin at a storefront — purchase (store) credits metaphor. */
export function StoreCreditsIllustration({
  size = 96,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const store = colors.primary.main;
  const gift = colors.success.main;
  const coin = colors.warning.main;
  const muted = colors.text.disabled;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Rect x="18" y="40" width="44" height="36" rx="4" fill={store} opacity={0.9} />
        <Path d="M14 40 L40 22 L66 40 Z" fill={store} />
        <Rect x="34" y="54" width="12" height="22" rx="2" fill={colors.background.paper} />
        <Circle cx="68" cy="58" r="16" fill={gift} opacity={0.95} />
        <Path
          d="M60 58 h16 M68 50 v16"
          stroke={colors.background.paper}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx="78" cy="34" r="10" fill={coin} />
        <Circle cx="78" cy="34" r="6" fill={muted} opacity={0.25} />
      </Svg>
    </View>
  );
}
