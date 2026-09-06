import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Banner,
  Button,
  Chip,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CreateNameDialog } from '../../components/business/item-form/CreateNameDialog';
import { ItemFormOptionDialog, type FormOption } from '../../components/business/item-form/ItemFormOptionDialog';
import { ItemFormSection } from '../../components/business/item-form/ItemFormSection';
import { ITEM_FORM_WEIGHT_UNITS } from '../../constants/businessItemForm';
import { useTheme } from '../../contexts/ThemeContext';
import { useSupportedCurrencies } from '../../hooks/business/useSupportedCurrencies';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import type { useBusinessItemForm } from '../../hooks/business/useBusinessItemForm';
import type { BusinessRootStackParamList } from '../../navigation/types';

type FormApi = ReturnType<typeof useBusinessItemForm>;

type Props = {
  itemId: string;
  form: FormApi;
  onSaveSuccess: () => void;
};

type PickerKind = 'category' | 'subCategory' | 'brand' | 'weightUnit' | 'tag' | null;
type CreateKind = 'category' | 'subCategory' | 'brand' | 'tag' | null;

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

export function BusinessItemFormView({ itemId, form, onSaveSuccess }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const { colors, spacing } = useTheme();
  const { isStripeRail } = useIsStripeRail();
  const { defaultCurrency } = useSupportedCurrencies();
  const [picker, setPicker] = useState<PickerKind>(null);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const { values, patch, categories, brands, tags, selectedTags, subCategories } = form;
  const lockedCurrency = defaultCurrency || values.currency || '—';

  const categoryLabel =
    categories.find((c) => c.id === values.categoryId)?.name ??
    t('business.items.selectCategory', 'Select category');
  const subLabel =
    subCategories.find((s) => s.id === values.item_sub_category_id)?.name ??
    t('business.items.selectSubCategory', 'Select sub category');
  const brandLabel =
    brands.find((b) => b.id === values.brand_id)?.name ??
    t('business.items.selectBrand', 'Select brand (optional)');

  const pickerConfig = useMemo((): {
    title: string;
    options: FormOption[];
    selectedId: string | null;
    allowClear?: boolean;
    onSelect: (id: string) => void;
  } | null => {
    if (!picker) return null;
    if (picker === 'category') {
      return {
        title: t('business.items.category', 'Category'),
        options: categories.map((c) => ({ id: String(c.id), label: c.name })),
        selectedId: values.categoryId != null ? String(values.categoryId) : null,
        onSelect: (id) => {
          patch('categoryId', Number(id));
          patch('item_sub_category_id', null);
        },
      };
    }
    if (picker === 'subCategory') {
      return {
        title: t('business.items.subCategory', 'Sub Category'),
        options: subCategories.map((s) => ({ id: String(s.id), label: s.name })),
        selectedId:
          values.item_sub_category_id != null ? String(values.item_sub_category_id) : null,
        onSelect: (id) => patch('item_sub_category_id', Number(id)),
      };
    }
    if (picker === 'brand') {
      return {
        title: t('business.items.brand', 'Brand'),
        options: brands.map((b) => ({ id: b.id, label: b.name })),
        selectedId: values.brand_id,
        allowClear: true,
        onSelect: (id) => patch('brand_id', id || null),
      };
    }
    if (picker === 'weightUnit') {
      return {
        title: t('business.items.weightUnit', 'Weight Unit'),
        options: ITEM_FORM_WEIGHT_UNITS.map((u) => ({ id: u, label: u.toUpperCase() })),
        selectedId: values.weight_unit,
        onSelect: (id) => patch('weight_unit', id),
      };
    }
    if (picker === 'tag') {
      const available = tags.filter((tag) => !selectedTags.some((s) => s.id === tag.id));
      return {
        title: t('business.items.addTag', 'Add tag'),
        options: available.map((tag) => ({ id: tag.id, label: tag.name })),
        selectedId: null,
        onSelect: (id) => form.addTagById(id),
      };
    }
    return null;
  }, [brands, categories, form, patch, picker, selectedTags, subCategories, t, tags, values]);

  const handleSave = async () => {
    const ok = await form.save();
    if (ok) onSaveSuccess();
  };

  const handleCreate = async (name: string) => {
    setCreateBusy(true);
    try {
      if (createKind === 'category') await form.createAndSelectCategory(name);
      if (createKind === 'subCategory' && values.categoryId) {
        await form.createAndSelectSubCategory(name, values.categoryId);
      }
      if (createKind === 'brand') await form.createAndSelectBrand(name);
      if (createKind === 'tag') await form.createAndSelectTag(name);
      setCreateKind(null);
    } catch (e: unknown) {
      form.setError(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
    } finally {
      setCreateBusy(false);
    }
  };

  if (form.loading) {
    return <ActivityIndicator style={{ marginTop: 48 }} />;
  }

  return (
    <>
      <KeyboardAwareScrollView
        avoidingViewStyle={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { padding: spacing.md }]}
      >
        {form.error ? (
          <Banner visible icon="alert-circle" style={{ marginBottom: spacing.md }}>
            {form.error}
          </Banner>
        ) : null}

        <ItemFormSection title={t('business.items.essentialInfo', 'Essential Information')}>
          <TextInput
            label={t('business.items.name', 'Item Name')}
            value={values.name}
            onChangeText={(v) => patch('name', v)}
            mode="outlined"
            style={styles.input}
          />
          <PickerField
            label={t('business.items.category', 'Category')}
            valueLabel={categoryLabel}
            onPress={() => setPicker('category')}
          />
          <Button mode="text" icon="plus" onPress={() => setCreateKind('category')} style={styles.createLink}>
            {t('business.items.createCategory', 'Create category')}
          </Button>
          <PickerField
            label={t('business.items.subCategory', 'Sub Category')}
            valueLabel={subLabel}
            onPress={() => setPicker('subCategory')}
            disabled={!values.categoryId}
          />
          <Button
            mode="text"
            icon="plus"
            disabled={!values.categoryId}
            onPress={() => setCreateKind('subCategory')}
            style={styles.createLink}
          >
            {t('business.items.createSubCategory', 'Create sub category')}
          </Button>
          <TextInput
            label={t('business.items.price', 'Price')}
            value={values.price}
            onChangeText={(v) => patch('price', v)}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            right={<TextInput.Affix text={lockedCurrency} />}
          />
          <Text
            variant="bodySmall"
            style={[styles.currencyHint, { color: colors.text.secondary }]}
          >
            {t(
              'business.items.currencyLockedToCountry',
              'Locked to your business country'
            )}
          </Text>
        </ItemFormSection>

        <ItemFormSection title={t('business.items.productDetails', 'Product Details')}>
          <PickerField
            label={t('business.items.brand', 'Brand')}
            valueLabel={brandLabel}
            onPress={() => setPicker('brand')}
          />
          <Button mode="text" icon="plus" onPress={() => setCreateKind('brand')} style={styles.createLink}>
            {t('business.items.createBrand', 'Create brand')}
          </Button>
          <TextInput
            label={t('business.items.model', 'Model')}
            value={values.model}
            onChangeText={(v) => patch('model', v)}
            mode="outlined"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>
            {t('business.items.tags', 'Tags')}
          </Text>
          <View style={styles.chipRow}>
            {selectedTags.map((tag) => (
              <Chip key={tag.id} onClose={() => form.removeTag(tag.id)} style={styles.chip}>
                {tag.name}
              </Chip>
            ))}
          </View>
          <Button mode="outlined" icon="tag-plus" onPress={() => setPicker('tag')} style={styles.input}>
            {t('business.items.addTag', 'Add tag')}
          </Button>
          <View style={styles.tagCreateRow}>
            <TextInput
              label={t('business.items.createNewTag', 'Create new tag')}
              value={newTagName}
              onChangeText={setNewTagName}
              mode="outlined"
              style={[styles.input, styles.flex]}
              dense
            />
            <Button
              mode="contained-tonal"
              disabled={!newTagName.trim()}
              onPress={() => {
                void form.createAndSelectTag(newTagName).then(() => setNewTagName(''));
              }}
            >
              {t('common.add', 'Add')}
            </Button>
          </View>
          <View style={styles.row}>
            <TextInput
              label={t('business.items.weight', 'Weight')}
              value={values.weight}
              onChangeText={(v) => patch('weight', v)}
              keyboardType="decimal-pad"
              mode="outlined"
              style={[styles.input, styles.flex]}
            />
            <View style={styles.currencyCol}>
              <PickerField
                label={t('business.items.weightUnit', 'Weight Unit')}
                valueLabel={values.weight_unit.toUpperCase()}
                onPress={() => setPicker('weightUnit')}
              />
            </View>
          </View>
          <TextInput
            label={t('business.items.dimensions', 'Dimensions')}
            value={values.dimensions}
            onChangeText={(v) => patch('dimensions', v)}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={t('business.items.sku', 'SKU')}
            value={values.sku}
            onChangeText={(v) => patch('sku', v)}
            mode="outlined"
            style={styles.input}
          />
        </ItemFormSection>

        <ItemFormSection
          title={t('business.items.specialProperties', 'Special Properties')}
          contentStyle={styles.specialContent}
        >
          <SwitchRow
            label={t('business.items.fragile', 'Fragile')}
            value={values.is_fragile}
            onChange={(v) => patch('is_fragile', v)}
          />
          <SwitchRow
            label={t('business.items.perishable', 'Perishable')}
            value={values.is_perishable}
            onChange={(v) => patch('is_perishable', v)}
          />
          <SwitchRow
            label={t('business.items.specialHandling', 'Requires special handling')}
            value={values.requires_special_handling}
            onChange={(v) => patch('requires_special_handling', v)}
          />
          {!isStripeRail ? (
            <SwitchRow
              label={t('business.items.payOnDeliveryEnabled', 'Allow pay at delivery')}
              value={values.pay_on_delivery_enabled}
              onChange={(v) => patch('pay_on_delivery_enabled', v)}
            />
          ) : null}
          <Button
            mode="outlined"
            icon="truck-delivery-outline"
            onPress={() => navigation.navigate('BusinessItemFulfillment', { itemId })}
            style={styles.input}
          >
            {t('business.items.fulfillment.editCta', 'Fulfillment methods')}
          </Button>
          <SwitchRow
            label={t('business.items.listingActive', 'Listing active')}
            value={values.is_active}
            onChange={(v) => patch('is_active', v)}
          />
          <TextInput
            label={t('business.items.minOrderQuantity', 'Min order quantity')}
            value={values.min_order_quantity}
            onChangeText={(v) => patch('min_order_quantity', v)}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={t('business.items.maxOrderQuantity', 'Max order quantity')}
            value={values.max_order_quantity}
            onChangeText={(v) => patch('max_order_quantity', v)}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.inputLast}
          />
        </ItemFormSection>

        <ItemFormSection title={t('business.items.description', 'Description')}>
          <TextInput
            label={t('business.items.description', 'Description')}
            value={values.description}
            onChangeText={(v) => patch('description', v)}
            mode="outlined"
            multiline
            numberOfLines={5}
            style={styles.input}
          />
          <Button
            mode="contained-tonal"
            icon="auto-fix"
            loading={form.aiLoading}
            disabled={form.aiLoading || !values.name.trim()}
            onPress={() => void form.runAiDescription()}
          >
            {t('business.items.generate', 'AI Generate')}
          </Button>
        </ItemFormSection>

        <Button
          mode="contained"
          icon="content-save"
          loading={form.saving}
          disabled={form.saving}
          onPress={() => void handleSave()}
          style={{ marginBottom: spacing.xl }}
        >
          {t('business.items.saveChanges', 'Save changes')}
        </Button>
      </KeyboardAwareScrollView>

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
        />
      ) : null}

      <CreateNameDialog
        visible={createKind != null}
        title={
          createKind === 'category'
            ? t('business.items.createCategory', 'Create category')
            : createKind === 'subCategory'
              ? t('business.items.createSubCategory', 'Create sub category')
              : createKind === 'brand'
                ? t('business.items.createBrand', 'Create brand')
                : t('business.items.createNewTag', 'Create new tag')
        }
        label={t('common.name', 'Name')}
        loading={createBusy}
        onDismiss={() => setCreateKind(null)}
        onSubmit={(name) => void handleCreate(name)}
      />
    </>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text variant="bodyMedium" style={styles.flex}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  input: { marginBottom: 10 },
  inputLast: { marginBottom: 0 },
  currencyHint: { marginTop: -6, marginBottom: 10 },
  field: { marginBottom: 8 },
  fieldLabel: { marginBottom: 4 },
  pickerBtn: { justifyContent: 'flex-start' },
  createLink: { alignSelf: 'flex-start', marginTop: -4, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  flex: { flex: 1 },
  currencyCol: { width: 120 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { marginBottom: 4 },
  tagCreateRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  specialContent: {
    paddingTop: 0,
    gap: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 4,
  },
});
