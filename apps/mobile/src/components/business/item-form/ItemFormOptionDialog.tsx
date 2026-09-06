import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

export type FormOption = { id: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  options: FormOption[];
  selectedId?: string | null;
  onDismiss: () => void;
  onSelect: (id: string) => void;
  allowClear?: boolean;
  onCreateNew?: (name: string) => void;
};

export function ItemFormOptionDialog({
  visible,
  title,
  options,
  selectedId,
  onDismiss,
  onSelect,
  allowClear,
  onCreateNew,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const trimmedQuery = query.trim();
  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, trimmedQuery]);

  const canCreate =
    !!onCreateNew &&
    trimmedQuery.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());

  const handleDismiss = () => {
    setQuery('');
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel', 'Cancel')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary }]}
          >
            {title}
          </Text>

          {/* Search + list — no borders */}
          <View style={[styles.body, { paddingHorizontal: spacing.md }]}>
            <Searchbar
              placeholder={t('common.search', 'Search')}
              value={query}
              onChangeText={setQuery}
              style={{ marginBottom: spacing.sm }}
            />
            {canCreate ? (
              <Button
                mode="outlined"
                icon="plus"
                onPress={() => {
                  onCreateNew?.(trimmedQuery);
                  setQuery('');
                  onDismiss();
                }}
                style={{ marginBottom: spacing.sm }}
              >
                {t('common.addNamed', 'Add "{{name}}"', { name: trimmedQuery })}
              </Button>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              bounces={Platform.OS === 'ios'}
              renderItem={({ item }) => (
                <Button
                  mode={item.id === selectedId ? 'contained-tonal' : 'text'}
                  onPress={() => {
                    onSelect(item.id);
                    setQuery('');
                    onDismiss();
                  }}
                  style={styles.optionBtn}
                  contentStyle={styles.optionContent}
                >
                  {item.label}
                </Button>
              )}
              ListEmptyComponent={
                <Text style={{ color: colors.text.secondary, textAlign: 'center', padding: 16 }}>
                  {t('common.noResults', 'No results')}
                </Text>
              }
            />
            {allowClear ? (
              <Button
                mode="outlined"
                onPress={() => {
                  onSelect('');
                  setQuery('');
                  onDismiss();
                }}
                style={{ marginTop: spacing.sm }}
              >
                {t('common.clear', 'Clear')}
              </Button>
            ) : null}
          </View>

          {/* Cancel — plain View row, no Paper Dialog.Actions border */}
          <View style={[styles.footer, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
            <Button
              mode="text"
              onPress={handleDismiss}
              style={styles.cancelBtn}
              contentStyle={styles.cancelContent}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  body: {
    flexShrink: 1,
  },
  list: { maxHeight: 300 },
  optionBtn: { justifyContent: 'flex-start' },
  optionContent: { justifyContent: 'flex-start' },
  footer: {
    alignItems: 'flex-end',
  },
  cancelBtn: { borderRadius: 8 },
  cancelContent: { minHeight: 40 },
});
