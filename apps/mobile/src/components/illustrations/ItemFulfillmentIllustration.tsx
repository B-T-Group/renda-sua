import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Package, store, and truck — how customers can receive a product. */
export function ItemFulfillmentIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Delivery, pickup, and shipping"
      style={{ alignItems: 'center' }}
    >
      <Svg width={160} height={112} viewBox="0 0 160 112">
        <Rect
          x="12"
          y="38"
          width="40"
          height="40"
          rx="8"
          fill={colors.primary.light}
          opacity={0.45}
        />
        <Path
          d="M20 54h24M32 46v24"
          stroke={colors.primary.main}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Rect
          x="62"
          y="32"
          width="36"
          height="48"
          rx="8"
          fill={colors.info.main}
          opacity={0.18}
        />
        <Rect x="72" y="52" width="16" height="28" rx="3" fill={colors.info.main} opacity={0.55} />
        <Circle cx="80" cy="44" r="5" fill={colors.info.main} opacity={0.7} />
        <Rect
          x="108"
          y="48"
          width="40"
          height="22"
          rx="6"
          fill={colors.warning.main}
          opacity={0.28}
        />
        <Circle cx="118" cy="78" r="7" fill={colors.text.secondary} opacity={0.35} />
        <Circle cx="140" cy="78" r="7" fill={colors.text.secondary} opacity={0.35} />
        <Path
          d="M108 58h18l10 12h12"
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
