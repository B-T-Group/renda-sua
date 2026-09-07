import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import { useItemCategoryEditor } from '@/hooks/business/useItemCategoryEditor';
import type { BusinessCatalogItem } from '@/types/business/items';
import {
  ItemFormOptionDialog,
  type FormOption,
} from '../item-form/ItemFormOptionDialog';

type Props = {
  item: BusinessCatalogItem;
  onChanged: () => void;
  onMessage: (text: string) => void;
  /** When nested inside ItemIdentitySection, skip outer top margin. */
  embedded?: boolean;
};

function PickerField({
  label,
  valueLabel,
  onPress,
  disabled,
}: {
  label: string;
  valueLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text variant="labelMedium" style={styles.fieldLabel}>
        {label}
      </Text>
      <Button mode="outlined" onPress={onPress} disabled={disabled} contentStyle={styles.pickerBtn}>
        {valueLabel}
      </Button>
    </View>
  );
}

export function ItemCategorySection({
  item,
  onChanged,
  onMessage,
  embedded = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const editor = useItemCategoryEditor(item, onChanged, onMessage);
  const busy = editor.loading || editor.saving;

  const categoryLabel =
    editor.categories.find((c) => c.id === editor.categoryId)?.name ??
    item.item_sub_category?.item_category?.name ??
    t('business.items.selectCategory', 'Select category');
  const subLabel =
    editor.subCategories.find((s) => s.id === editor.subCategoryId)?.name ??
    (editor.subCategoryId != null ? item.item_sub_category?.name : undefined) ??
    t('business.items.selectSubCategory', 'Select sub category');

  const pickerConfig = useMemo((): {
    title: string;
    options: FormOption[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } | null => {
    if (editor.picker === 'category') {
      return {
        title: t('business.items.category', 'Category'),
        options: editor.categories.map((c) => ({ id: String(c.id), label: c.name })),
        selectedId: editor.categoryId != null ? String(editor.categoryId) : null,
        onSelect: (id) => editor.selectCategory(Number(id)),
      };
    }
    if (editor.picker === 'subCategory') {
      return {
        title: t('business.items.subCategory', 'Sub Category'),
        options: editor.subCategories.map((s) => ({ id: String(s.id), label: s.name })),
        selectedId: editor.subCategoryId != null ? String(editor.subCategoryId) : null,
        onSelect: (id) => editor.selectSubCategory(Number(id)),
      };
    }
    return null;
  }, [editor, t]);

  return (
    <View style={{ marginTop: embedded ? spacing.sm : spacing.md }}>
      <PickerField
        label={t('business.items.category', 'Category')}
        valueLabel={categoryLabel}
        onPress={() => editor.setPicker('category')}
        disabled={busy}
      />
      <PickerField
        label={t('business.items.subCategory', 'Sub Category')}
        valueLabel={subLabel}
        onPress={() => editor.setPicker('subCategory')}
        disabled={busy || editor.categoryId == null}
      />
      {editor.needsSubcategory ? (
        <Text variant="bodySmall" style={[styles.hint, { color: colors.text.secondary }]}>
          {t(
            'business.items.selectSubCategoryToSave',
            'Choose a subcategory to save'
          )}
        </Text>
      ) : null}

      <ItemFormOptionDialog
        visible={pickerConfig != null}
        title={pickerConfig?.title ?? ''}
        options={pickerConfig?.options ?? []}
        selectedId={pickerConfig?.selectedId}
        onDismiss={() => editor.setPicker(null)}
        onSelect={(id) => pickerConfig?.onSelect(id)}
        onCreateNew={(name) => void editor.createFromPicker(editor.picker, name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 8 },
  fieldLabel: { marginBottom: 4 },
  pickerBtn: { justifyContent: 'flex-start' },
  hint: { marginTop: 4 },
});
