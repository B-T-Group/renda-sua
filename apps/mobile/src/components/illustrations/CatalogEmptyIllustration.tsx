import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Empty catalog: open storefront with magnifying glass. */
export function CatalogEmptyIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="No products found in catalog"
      style={{ alignItems: 'center' }}
    >
      <Svg width={140} height={112} viewBox="0 0 140 112">
        <Rect x="20" y="32" width="56" height="56" rx="10" fill={colors.primary.light} opacity={0.35} />
        <Rect x="28" y="44" width="40" height="8" rx="2" fill={colors.primary.main} opacity={0.65} />
        <Rect x="28" y="58" width="28" height="6" rx={2} fill={colors.text.secondary} opacity={0.3} />
        <Circle cx="96" cy="52" r="22" fill="none" stroke={colors.info.main} strokeWidth={3} opacity={0.8} />
        <Path
          d="M112 68l14 14"
          stroke={colors.info.main}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M48 88c8-6 18-6 26 0"
          stroke={colors.warning.main}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          opacity={0.6}
        />
      </Svg>
    </View>
  );
}
