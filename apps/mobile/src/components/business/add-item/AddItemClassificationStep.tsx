import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import {
  ItemFormOptionDialog,
  type FormOption,
} from '../item-form/ItemFormOptionDialog';
import { useTheme } from '../../../contexts/ThemeContext';
import type { UseAddItemFormResult } from '../../../hooks/business/useAddItemForm';

type PickerKind = 'category' | 'subCategory' | 'brand' | null;

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
    <View style={styles.pickerWrap}>
      <Text variant="labelMedium" style={styles.pickerLabel}>
        {label}
      </Text>
      <Button
        mode="outlined"
        onPress={onPress}
        disabled={disabled}
        contentStyle={styles.pickerBtn}
      >
        {valueLabel}
      </Button>
    </View>
  );
}

export interface AddItemClassificationStepProps {
  form: UseAddItemFormResult;
  busy: boolean;
  onContinue: () => void;
}

export function AddItemClassificationStep({
  form,
  busy,
  onContinue,
}: AddItemClassificationStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [picker, setPicker] = useState<PickerKind>(null);

  const pickerConfig = useMemo<{
    title: string;
    options: FormOption[];
    selectedId: string | null;
    allowClear: boolean;
    onSelect: (value: string) => void;
    onCreateNew?: (value: string) => void;
  } | null>(() => {
    if (picker === 'category') {
      return {
        title: t('business.onboarding.firstSale.create.category', 'Category name'),
        options: form.categoryOptions,
        selectedId: form.categoryName || null,
        allowClear: false,
        onSelect: form.setCategory,
        onCreateNew: form.setCategory,
      };
    }
    if (picker === 'subCategory') {
      return {
        title: t('business.onboarding.firstSale.create.subCategory', 'Subcategory name'),
        options: form.subCategoryOptions,
        selectedId: form.subCategoryName || null,
        allowClear: false,
        onSelect: form.setSubCategoryName,
        onCreateNew: form.setSubCategoryName,
      };
    }
    if (picker === 'brand') {
      return {
        title: t('business.onboarding.firstSale.create.brand', 'Brand'),
        options: form.brandOptions,
        selectedId: form.brandName || null,
        allowClear: true,
        onSelect: form.setBrandName,
        onCreateNew: form.setBrandName,
      };
    }
    return null;
  }, [picker, form, t]);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={styles.content}
      wrapAvoidingView={false}
    >
      <Text
        variant="bodyMedium"
        style={[styles.hint, { color: colors.text.secondary }]}
      >
        {t(
          'business.onboarding.firstSale.create.classificationHint',
          'Help customers find your product by choosing the right category.'
        )}
      </Text>

      <PickerField
        label={`${t('business.onboarding.firstSale.create.category', 'Category name')} *`}
        valueLabel={
          form.categoryName ||
          t('business.items.selectCategory', 'Select category')
        }
        onPress={() => setPicker('category')}
        disabled={busy}
      />

      <PickerField
        label={`${t('business.onboarding.firstSale.create.subCategory', 'Subcategory name')} *`}
        valueLabel={
          form.subCategoryName ||
          t('business.items.selectSubCategory', 'Select sub category')
        }
        onPress={() => setPicker('subCategory')}
        disabled={busy || !form.categoryName.trim()}
      />

      <PickerField
        label={t('business.onboarding.firstSale.create.brand', 'Brand')}
        valueLabel={
          form.brandName ||
          t('business.items.selectBrand', 'Select brand (optional)')
        }
        onPress={() => setPicker('brand')}
        disabled={busy}
      />

      <Button
        mode="contained"
        disabled={busy || !form.classificationComplete}
        onPress={onContinue}
        style={{ marginTop: spacing.sm }}
      >
        {t('business.onboarding.firstSale.upload.continue', 'Continue')}
      </Button>

      {pickerConfig ? (
        <ItemFormOptionDialog
          visible={picker != null}
          title={pickerConfig.title}
          options={pickerConfig.options}
          selectedId={pickerConfig.selectedId}
          allowClear={pickerConfig.allowClear}
          onDismiss={() => setPicker(null)}
          onSelect={(id) => {
            pickerConfig.onSelect(id);
            setPicker(null);
          }}
          onCreateNew={
            pickerConfig.onCreateNew
              ? (value) => {
                  pickerConfig.onCreateNew?.(value);
                  setPicker(null);
                }
              : undefined
          }
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hint: { marginBottom: 16 },
  pickerWrap: { marginBottom: 10 },
  pickerLabel: { marginBottom: 4 },
  pickerBtn: { justifyContent: 'flex-start' },
});
