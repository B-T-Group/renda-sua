import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export type ToolbarIconSpec = {
  key: string;
  icon: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
};

type Props = {
  icons: ToolbarIconSpec[];
  /** Separator above the icon row (e.g. below selling toggles). */
  showTopDivider?: boolean;
};

/** Horizontal icon actions with comfortable touch targets on narrow screens. */
export function BusinessItemIconToolbar({ icons, showTopDivider = false }: Props) {
  const { colors } = useTheme();
  if (!icons.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollContent}
    >
      <View
        style={[
          styles.row,
          showTopDivider && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
          },
        ]}
      >
        {icons.map((spec) => (
          <IconButton
            key={spec.key}
            icon={spec.icon}
            size={22}
            iconColor={spec.color}
            onPress={spec.onPress}
            disabled={spec.disabled}
            accessibilityLabel={spec.accessibilityLabel}
            style={styles.iconBtn}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  iconBtn: {
    margin: 0,
    width: 44,
    height: 44,
  },
});
