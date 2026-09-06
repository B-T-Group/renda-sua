import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StripeTaxCodeOption } from '@/hooks/business/useStripeTaxCodes';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  visible: boolean;
  query: string;
  loading: boolean;
  codes: StripeTaxCodeOption[];
  value: string;
  onQueryChange: (text: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function TaxCategoryPickerSheet({
  visible,
  query,
  loading,
  codes,
  value,
  onQueryChange,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const listHeight = Math.min(420, Math.round(screenHeight * 0.48));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.scrim}
          onPress={onClose}
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
            <Text
              variant="titleLarge"
              style={[styles.title, { color: colors.text.primary }]}
            >
              {t('items.taxCategory.label', 'Product tax category')}
            </Text>
            <View style={{ paddingHorizontal: spacing.md }}>
              <Searchbar
                placeholder={t(
                  'items.taxCategory.searchPlaceholder',
                  'Search by product type'
                )}
                value={query}
                onChangeText={onQueryChange}
                style={{ marginBottom: spacing.xs }}
              />
              <Text
                variant="labelSmall"
                style={{
                  color: colors.text.secondary,
                  marginBottom: spacing.sm,
                }}
              >
                {loading
                  ? t('common.loading', 'Loading…')
                  : t(
                      'items.taxCategory.resultCount',
                      '{{count}} matches',
                      { count: codes.length }
                    )}
              </Text>
              <ScrollView
                style={{ height: listHeight }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                keyboardDismissMode="on-drag"
              >
                {codes.map((item) => (
                  <TaxCategoryOption
                    key={item.id}
                    item={item}
                    selected={item.id === value}
                    onPress={() => onSelect(item.id)}
                  />
                ))}
                {!loading && codes.length === 0 ? (
                  <Text
                    style={{
                      color: colors.text.secondary,
                      textAlign: 'center',
                      padding: 16,
                    }}
                  >
                    {t(
                      'items.taxCategory.empty',
                      'No matching tax categories'
                    )}
                  </Text>
                ) : null}
              </ScrollView>
            </View>
            <View
              style={[
                styles.footer,
                { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
              ]}
            >
              <Button mode="text" onPress={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TaxCategoryOption({
  item,
  selected,
  onPress,
}: {
  item: StripeTaxCodeOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        {
          backgroundColor: selected ? colors.primary.main : colors.background.paper,
          borderColor: selected ? colors.primary.main : colors.divider,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <Text
        variant="bodyMedium"
        style={{
          color: selected ? colors.primary.contrast : colors.text.primary,
          fontWeight: '700',
        }}
      >
        {item.name}
      </Text>
      {item.description ? (
        <Text
          variant="bodySmall"
          numberOfLines={2}
          style={{
            color: selected ? colors.primary.contrast : colors.text.secondary,
            marginTop: 2,
          }}
        >
          {item.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 52,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
