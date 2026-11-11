import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';

export function RentalModifyPriceSheet({
  visible,
  title,
  body,
  rows,
  saveLabel,
  keepLabel,
  onSave,
  onKeep,
}: {
  visible: boolean;
  title: string;
  body: string;
  rows: Array<{ label: string; from: string; to: string }>;
  saveLabel: string;
  keepLabel: string;
  onSave: () => void;
  onKeep: () => void;
}) {
  const { colors } = useTheme();
  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onKeep}>
      <Pressable style={styles.backdrop} onPress={onKeep}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Text style={{ color: colors.text.secondary, marginBottom: 12 }}>{body}</Text>
          {rows.map((row) => (
            <View key={row.label} style={[styles.line, { borderColor: colors.divider }]}>
              <Text style={{ color: colors.text.secondary }}>{row.label}</Text>
              <Text style={{ color: colors.text.secondary }}>{row.from}</Text>
              <Text style={{ color: colors.primary.main, fontWeight: '800' }}>{row.to}</Text>
            </View>
          ))}
          <Button mode="contained" icon="check" onPress={onSave} style={{ marginTop: 12 }} testID="rental-modify-confirm-save">
            {saveLabel}
          </Button>
          <Button mode="text" onPress={onKeep} testID="rental-modify-confirm-keep">{keepLabel}</Button>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

export function RentalModifyBlockedSheet({
  visible,
  title,
  body,
  actionLabel,
  onAction,
}: {
  visible: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { colors } = useTheme();
  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onAction}>
      <View style={[styles.backdrop, styles.center]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary, textAlign: 'center' }]}>{title}</Text>
          <Text style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: 16 }}>{body}</Text>
          <Button mode="contained" onPress={onAction}>{actionLabel}</Button>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  center: { justifyContent: 'center' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  card: { margin: 24, borderRadius: 16, padding: 20, alignSelf: 'center', width: '88%' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingVertical: 10, gap: 8 },
});
