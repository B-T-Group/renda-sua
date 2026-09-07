import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppModal } from '../common/AppModal';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface PickerRow {
  id: string;
  title: string;
}

interface SearchablePickerModalProps {
  visible: boolean;
  title: string;
  rows: PickerRow[];
  searchPlaceholder: string;
  onDismiss: () => void;
  onSelect: (row: PickerRow) => void;
}

export function SearchablePickerModal({
  visible,
  title,
  rows,
  searchPlaceholder,
  onDismiss,
  onSelect,
}: SearchablePickerModalProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(n));
  }, [rows, q]);

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={[styles.wrap, { backgroundColor: colors.pageBackground, paddingTop: insets.top + 8 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {title}
        </Text>
        <TextInput
          mode="outlined"
          placeholder={searchPlaceholder}
          value={q}
          onChangeText={setQ}
          style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}
        />
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, padding: spacing.md }}>
              {t('addresses.pickerEmpty', 'No matches')}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item);
                onDismiss();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.divider, backgroundColor: pressed ? colors.surface : 'transparent' },
              ]}
            >
              <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
        <Button mode="text" onPress={onDismiss} style={{ margin: spacing.md }}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
