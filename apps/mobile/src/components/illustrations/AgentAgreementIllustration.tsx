import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number; label: string };

/** Document and pen — the agent agreement to sign. */
export function AgentAgreementIllustration({ size = 96, label }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Rect x="22" y="14" width="44" height="58" rx="6" fill={colors.surface} stroke={colors.primary.main} strokeWidth="2" />
        <Path d="M32 30h24M32 40h24M32 50h16" stroke={colors.text.secondary} strokeWidth="2" strokeLinecap="round" />
        <Path d="M58 52l16 16-8 2-10-18z" fill={colors.primary.main} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
