import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { isNotAllowedCategory } from '@/utils/itemRejectionRecovery';
import type { RejectionCategory } from '@/types/itemRejectionRecovery';

type Props = {
  category?: RejectionCategory | null;
  size?: number;
};

export function NeedsChangesIllustration({ category, size = 64 }: Props) {
  const { colors } = useTheme();
  const blocked = isNotAllowedCategory(category);
  const accent = blocked ? colors.error.main : colors.warning.main;
  const paper = colors.background.paper;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={blocked ? 'This item is not allowed' : 'This item needs changes'}
    >
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle cx="36" cy="36" r="32" fill={accent} opacity={0.12} />
        <Rect x="18" y="16" width="36" height="42" rx="6" fill={paper} stroke={accent} strokeWidth={2.5} />
        {blocked ? (
          <Path
            d="M28 36 L44 36"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            transform="rotate(45 36 36)"
          />
        ) : (
          <Path
            d="M26 34 L33 41 L48 26"
            fill="none"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}
