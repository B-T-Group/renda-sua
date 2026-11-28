import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReserveSummary } from '../../utils/rentals/reserveSummary';

const LINE_ICONS = {
  check: 'check',
  refund: 'restore',
  warn: 'alert-outline',
  card: 'credit-card-outline',
} as const;

export interface ReserveDetailsSheetProps {
  visible: boolean;
  summary: ReserveSummary;
  onDismiss: () => void;
}

/** Bottom sheet with the full reservation rules, opened from the sticky footer's Details link. */
export function ReserveDetailsSheet({ visible, summary, onDismiss }: ReserveDetailsSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { box, cancelLine } = summary;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel={t('common.close', 'Close')}>
        <Pressable
          testID="reserve-details-sheet"
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius.xl,
              borderTopRightRadius: borderRadius.xl,
              padding: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              gap: spacing.sm,
            },
          ]}
        >
          <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 18 }}>{box.title}</Text>
          {cancelLine ? <SheetLine icon="check" text={cancelLine} /> : null}
          {box.lines.map((line, i) => (
            <SheetLine key={i} icon={line.icon} text={line.text} warn={line.warn} />
          ))}
          <Button mode="contained" onPress={onDismiss} testID="reserve-details-close" style={{ marginTop: spacing.xs }}>
            {t('common.close', 'Close')}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetLine({ icon, text, warn }: { icon: keyof typeof LINE_ICONS; text: string; warn?: boolean }) {
  const { colors } = useTheme();
  const tone = warn ? colors.warning.dark : colors.text.secondary;
  return (
    <View style={styles.line}>
      <MaterialCommunityIcons name={LINE_ICONS[icon]} size={18} color={tone} style={{ marginTop: 2 }} />
      <Text style={{ color: warn ? colors.warning.dark : colors.text.primary, marginLeft: 10, flex: 1, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {},
  line: { flexDirection: 'row', alignItems: 'flex-start' },
});
