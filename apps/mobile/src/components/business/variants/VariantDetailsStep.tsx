import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import { ITEM_FORM_WEIGHT_UNITS } from '@/constants/businessItemForm';
import type { BusinessCatalogItem } from '@/types/business/items';
import { packRebate } from '@/types/business/itemVariant';

export interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  weight: string;
  weightUnit: string;
  dimensions: string;
  color: string;
  quantity: string;
  isActive: boolean;
  isDefault: boolean;
}

interface Props {
  item: BusinessCatalogItem;
  value: VariantDraft;
  onChange: (value: VariantDraft) => void;
  aiLoading?: boolean;
  aiFilled?: boolean;
  onFieldLock?: (keys: (keyof VariantDraft)[]) => void;
}

export function VariantDetailsStep({
  item,
  value,
  onChange,
  aiLoading = false,
  aiFilled = false,
  onFieldLock,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const set = (key: keyof VariantDraft, next: string | boolean) => {
    if (aiLoading) onFieldLock?.([key]);
    onChange({ ...value, [key]: next });
  };

  const setColor = (color: string) => {
    if (aiLoading) onFieldLock?.(['color', 'name']);
    const autoName = color.trim() ? `${item.name} — ${color.trim()}` : '';
    const canAutoName =
      !value.name.trim() || value.name.startsWith(`${item.name} — `);
    onChange({ ...value, color, name: canAutoName ? autoName : value.name });
  };

  const copyItemDetails = () => {
    if (aiLoading) {
      onFieldLock?.(['price', 'weight', 'weightUnit', 'dimensions', 'color']);
    }
    onChange({
      ...value,
      price: item.price != null ? String(item.price) : '',
      weight: item.weight != null ? String(item.weight) : '',
      weightUnit: item.weight_unit ?? 'g',
      dimensions: item.dimensions ?? '',
      color: item.color ?? '',
    });
  };

  const weightUnit =
    ITEM_FORM_WEIGHT_UNITS.includes(
      value.weightUnit as (typeof ITEM_FORM_WEIGHT_UNITS)[number]
    )
      ? value.weightUnit
      : 'g';
  const units = Math.max(1, Math.floor(Number(value.quantity) || 1));
  const packPrice = value.price.trim() ? Number(value.price) : null;
  const parentPrice = Number(item.price ?? 0);
  const rebate =
    units > 1 && packPrice != null && Number.isFinite(packPrice)
      ? packRebate({
          packQuantity: units,
          packPrice,
          baseUnitPrice: parentPrice,
        })
      : null;
  const currency = item.currency ?? 'XAF';

  return (
    <View style={{ gap: spacing.sm }}>
      {aiLoading ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('business.variants.aiAnalyzing', 'Analyzing variant photo…')}
        </Text>
      ) : null}
      {aiFilled && !aiLoading ? (
        <Text
          variant="labelMedium"
          style={{
            color: colors.primary.main,
            backgroundColor: colors.primaryTint,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
            overflow: 'hidden',
          }}
        >
          {t(
            'business.variants.aiFilledBanner',
            'Filled from variant photo — edit anything'
          )}
        </Text>
      ) : null}
      <Button mode="outlined" icon="content-copy" onPress={copyItemDetails}>
        {t('business.variants.copyFromItem', 'Copy item details')}
      </Button>
      <TextInput
        mode="outlined"
        label={t('business.variants.name', 'Variant name')}
        placeholder={t('business.variants.namePlaceholder', 'e.g. Red / Large')}
        value={value.name}
        onChangeText={(text) => set('name', text)}
      />
      <TextInput
        mode="outlined"
        label={t('business.variants.color', 'Color')}
        value={value.color}
        onChangeText={setColor}
      />
      <TextInput
        mode="outlined"
        label={t('business.variants.priceWithCurrency', 'Price ({{currency}})', {
          currency: item.currency ?? 'XAF',
        })}
        value={value.price}
        keyboardType="decimal-pad"
        onChangeText={(text) => set('price', text)}
      />
      <TextInput
        mode="outlined"
        label={t('business.variants.quantity', 'Units in this option')}
        value={value.quantity}
        keyboardType="number-pad"
        onChangeText={(text) => set('quantity', text.replace(/[^0-9]/g, ''))}
      />
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'business.variants.quantityHelp',
          'How many of this product are in the pack. Use 1 for a single unit.'
        )}
      </Text>
      {units > 1 && packPrice != null && Number.isFinite(packPrice) ? (
        <Text
          variant="bodySmall"
          style={{ color: rebate ? colors.success.dark : colors.text.secondary }}
        >
          {rebate
            ? t(
                'business.variants.packSavings',
                'Customers pay {{each}} each instead of {{single}} (save {{save}}).',
                {
                  each: `${rebate.perUnit.toFixed(2)} ${currency}`,
                  single: `${parentPrice.toFixed(2)} ${currency}`,
                  save: `${rebate.saveAmount.toFixed(2)} ${currency}`,
                }
              )
            : t('business.variants.packEach', 'Customers pay {{each}} each.', {
                each: `${(packPrice / units).toFixed(2)} ${currency}`,
              })}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        label={t('business.variants.weight', 'Weight')}
        value={value.weight}
        keyboardType="decimal-pad"
        onChangeText={(text) => set('weight', text)}
      />
      <View style={{ gap: spacing.xs }}>
        <Text variant="labelLarge">
          {t('business.variants.weightUnit', 'Unit')}
        </Text>
        <SegmentedButtons
          value={weightUnit}
          onValueChange={(next) => set('weightUnit', next)}
          buttons={ITEM_FORM_WEIGHT_UNITS.map((unit) => ({
            value: unit,
            label: unit.toUpperCase(),
          }))}
        />
      </View>
      <TextInput
        mode="outlined"
        label={t('business.variants.dimensions', 'Dimensions')}
        value={value.dimensions}
        onChangeText={(text) => set('dimensions', text)}
      />
      <TextInput
        mode="outlined"
        label={t('business.variants.sku', 'SKU')}
        value={value.sku}
        onChangeText={(text) => set('sku', text)}
      />
      <View style={styles.toggle}>
        <Text>{t('business.variants.active', 'Active')}</Text>
        <Switch
          value={value.isActive}
          onValueChange={(next) => set('isActive', next)}
        />
      </View>
      <View style={styles.toggle}>
        <Text>{t('business.variants.default', 'Default option')}</Text>
        <Switch
          value={value.isDefault}
          onValueChange={(next) => set('isDefault', next)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
