import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  accessibilityLabel: string;
}

/** Empty business rental schedule: a calendar with a free day marked by a check. */
export function RentalScheduleEmptyIllustration({ accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ alignItems: 'center' }}>
      <Svg width={140} height={112} viewBox="0 0 140 112">
        <Rect x="30" y="22" width="80" height="68" rx="10" fill={colors.surface} stroke={colors.divider} strokeWidth={2} />
        <Rect x="30" y="22" width="80" height="18" rx="10" fill={colors.primary.main} opacity={0.8} />
        <Rect x="48" y="14" width="6" height="14" rx="3" fill={colors.primary.dark} />
        <Rect x="86" y="14" width="6" height="14" rx="3" fill={colors.primary.dark} />
        <Rect x="42" y="50" width="16" height="8" rx="4" fill={colors.text.disabled} opacity={0.35} />
        <Rect x="64" y="50" width="16" height="8" rx="4" fill={colors.text.disabled} opacity={0.35} />
        <Rect x="86" y="50" width="16" height="8" rx="4" fill={colors.text.disabled} opacity={0.35} />
        <Rect x="42" y="66" width="16" height="8" rx="4" fill={colors.text.disabled} opacity={0.35} />
        <Circle cx="98" cy="84" r="16" fill={colors.success.main} />
        <Path d="M90 84l6 6 11-12" fill="none" stroke={colors.surface} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
