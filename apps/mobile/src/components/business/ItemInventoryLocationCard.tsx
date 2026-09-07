import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';
import { businessApi } from '../../services/businessApi';
import type { BusinessInventoryRow } from '../../types/business/items';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import type { ItemVariant } from '../../types/business/itemVariant';
import { FoodAvailabilitySection } from './food/FoodAvailabilitySection';

export interface ItemInventoryLocationCardProps {
  row: BusinessInventoryRow;
  itemId?: string;
  showFoodHours?: boolean;
  /** ISO currency code from the parent item (display only). */
  currency: string;
  /** Fallback when the inventory row has no selling_price yet. */
  defaultPrice?: number;
  variants?: ItemVariant[];
  onSaved: () => void;
}

export function ItemInventoryLocationCard({
  row,
  itemId,
  showFoodHours = false,
  currency,
  defaultPrice = 0,
  variants = [],
  onSaved,
}: ItemInventoryLocationCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [qty, setQty] = useState(String(row.quantity ?? 0));
  const [price, setPrice] = useState(
    String(row.selling_price ?? defaultPrice)
  );
  const [active, setActive] = useState(row.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});
  const [dirtyOverrideIds, setDirtyOverrideIds] = useState<Set<string>>(
    () => new Set()
  );

  const locationName =
    row.business_location?.name ??
    t('business.items.restockLocation', 'Location');
  const foodLocationId = row.business_location_id ?? row.business_location?.id;

  const variantIdsKey = useMemo(
    () => variants.map((variant) => variant.id).join(','),
    [variants]
  );

  useEffect(() => {
    setQty(String(row.quantity ?? 0));
    setPrice(String(row.selling_price ?? defaultPrice));
    setActive(row.is_active !== false);
    setDirtyOverrideIds(new Set());
    setVariantPrices(
      Object.fromEntries(
        variants.map((variant) => [
          variant.id,
          String(
            row.variant_price_overrides?.find(
              (override) => override.item_variant_id === variant.id
            )?.selling_price ?? ''
          ),
        ])
      )
    );
    // variantIdsKey stands in for variants identity; avoid resetting on new [] each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row.id,
    row.quantity,
    row.selling_price,
    row.is_active,
    row.variant_price_overrides,
    defaultPrice,
    variantIdsKey,
  ]);

  const available =
    row.computed_available_quantity ??
    Math.max(0, (row.quantity ?? 0) - (row.reserved_quantity ?? 0));

  const currencyCode = currency.trim().toUpperCase() || 'XAF';
  const priceLabel = t(
    'business.items.sellingPriceWithCurrency',
    'Selling price ({{currency}})',
    { currency: currencyCode }
  );

  const markOverrideDirty = (variantId: string, value: string) => {
    setVariantPrices((current) => ({ ...current, [variantId]: value }));
    setDirtyOverrideIds((current) => {
      const next = new Set(current);
      next.add(variantId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const selling_price = Number.parseFloat(price);
      const hasPrice = !Number.isNaN(selling_price) && selling_price >= 0;
      await businessApi.catalog.updateInventory(row.id, {
        quantity: Number.parseInt(qty, 10) || 0,
        is_active: active,
        ...(hasPrice
          ? { selling_price, unit_cost: selling_price }
          : {}),
      });
      const dirtyOverrides = variants
        .filter((variant) => dirtyOverrideIds.has(variant.id))
        .map((variant) => {
          const parsed = Number.parseFloat(variantPrices[variant.id] ?? '');
          return {
            item_variant_id: variant.id,
            selling_price:
              Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
          };
        });
      if (dirtyOverrides.length) {
        await businessApi.catalog.updateVariantPriceOverrides(
          row.id,
          dirtyOverrides
        );
      }
      onSaved();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t('business.items.saveInventoryFailed', 'Failed to save inventory');
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const removeFromLocation = async () => {
    setRemoving(true);
    setSaveError(null);
    try {
      await businessApi.catalog.deleteInventory(row.id);
      setConfirmRemove(false);
      onSaved();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t(
              'business.items.removeFromLocationFailed',
              'Failed to remove from location'
            );
      setSaveError(message);
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card
      style={[
        styles.card,
        {
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleSmall" style={{ fontWeight: '600', flex: 1 }}>
            {locationName}
          </Text>
          <StatusPill
            compact
            label={
              active
                ? t('business.items.available', 'Available')
                : t('business.items.unavailable', 'Unavailable')
            }
            backgroundColor={
              active ? colors.success.main + '18' : colors.text.disabled + '22'
            }
            textColor={active ? colors.success.dark : colors.text.secondary}
            icon={active ? 'check-circle-outline' : 'pause-circle-outline'}
          />
        </View>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
        >
          {t('business.items.availableQty', 'Available: {{count}}', {
            count: available,
          })}
        </Text>
        <TextInput
          label={t('business.items.quantity', 'Quantity')}
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          mode="outlined"
          dense
          style={styles.input}
        />
        <TextInput
          label={priceLabel}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          mode="outlined"
          dense
          style={styles.input}
        />
        <View style={styles.switchRow}>
          <Text variant="bodyMedium">
            {t('business.items.available', 'Available')}
          </Text>
          <Switch
            value={active}
            onValueChange={setActive}
            color={colors.primary.main}
          />
        </View>
        {variants.length ? (
          <>
            <Button
              mode="text"
              icon={overridesOpen ? 'chevron-up' : 'chevron-down'}
              onPress={() => setOverridesOpen((open) => !open)}
              contentStyle={styles.overrideToggle}
            >
              {t('business.variants.locationOverrides', 'Variant price overrides')}
            </Button>
            {overridesOpen ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
                  {t('business.variants.overrideHint', 'Leave blank to inherit the variant or inventory price. Quantity is shared.')}
                </Text>
                {variants.map((variant) => (
                  <TextInput
                    key={variant.id}
                    mode="outlined"
                    dense
                    keyboardType="decimal-pad"
                    label={`${variant.name} (${currencyCode})`}
                    placeholder={String(variant.price ?? row.selling_price ?? defaultPrice)}
                    value={variantPrices[variant.id] ?? ''}
                    onChangeText={(value) => markOverrideDirty(variant.id, value)}
                    style={styles.input}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {showFoodHours && itemId && foodLocationId ? (
          <View style={{ marginBottom: spacing.md }}>
            <FoodAvailabilitySection
              key={`${itemId}-${foodLocationId}`}
              itemId={itemId}
              businessLocationId={foodLocationId}
            />
          </View>
        ) : null}
        {saveError ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.error.main, marginBottom: spacing.sm }}
          >
            {saveError}
          </Text>
        ) : null}
        <View style={[styles.actions, { marginBottom: spacing.sm }]}>
          <Button
            mode="contained"
            loading={saving}
            disabled={removing}
            onPress={() => void save()}
            style={styles.actionBtn}
          >
            {t('common.save', 'Save')}
          </Button>
          <Button
            mode="outlined"
            textColor={colors.error.main}
            disabled={saving || removing}
            onPress={() => setConfirmRemove(true)}
            icon="map-marker-off"
            style={styles.actionBtn}
          >
            {t('business.items.removeFromLocation', 'Remove from location')}
          </Button>
        </View>
      </Card.Content>
      <ConfirmActionDialog
        visible={confirmRemove}
        title={t(
          'business.items.removeFromLocationTitle',
          'Remove from location?'
        )}
        message={t(
          'business.items.removeFromLocationConfirm',
          'This product will no longer be stocked at {{location}}. You can add it again later.',
          { location: locationName }
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('business.items.removeFromLocation', 'Remove from location')}
        destructive
        loading={removing}
        onDismiss={() => {
          if (!removing) setConfirmRemove(false);
        }}
        onConfirm={() => void removeFromLocation()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  input: { marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actions: { gap: 8 },
  actionBtn: { alignSelf: 'stretch' },
  overrideToggle: { flexDirection: 'row-reverse', justifyContent: 'flex-end' },
});
