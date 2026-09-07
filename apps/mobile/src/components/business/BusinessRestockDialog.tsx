import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Portal, RadioButton, Switch, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessCatalogItem, BusinessInventoryRow } from '../../types/business/items';
import { isCookedFoodItem } from '../../utils/businessFood';
import { getItemInventories } from '../../utils/businessItemUtils';
import { FoodAvailabilitySheet } from './food/FoodAvailabilitySheet';

interface Props {
  visible: boolean;
  item: BusinessCatalogItem | null;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (
    inventoryId: string,
    body: {
      quantity: number;
      selling_price?: number;
      unit_cost?: number;
      is_active: boolean;
    }
  ) => Promise<void>;
}

export function BusinessRestockDialog({ visible, item, loading, onDismiss, onSubmit }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const inventories = useMemo(() => (item ? getItemInventories(item) : []), [item]);

  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const [hoursOpen, setHoursOpen] = useState(false);

  const selectedRow: BusinessInventoryRow | undefined = inventories.find((r) => r.id === selectedId);
  const foodLocationId =
    selectedRow?.business_location_id ?? selectedRow?.business_location?.id ?? '';
  const showServingHours = !!item && isCookedFoodItem(item) && !!foodLocationId;

  useEffect(() => {
    if (!visible) setHoursOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !item) return;
    const first = inventories[0];
    if (!first) return;
    setSelectedId(first.id);
    setQty(String(first.quantity ?? 0));
    setPrice(String(first.selling_price ?? item.price ?? 0));
    setActive(first.is_active !== false);
  }, [visible, item?.id, inventories]);

  const onSelectInventory = useCallback(
    (id: string) => {
      setSelectedId(id);
      const row = inventories.find((r) => r.id === id);
      if (row) {
        setQty(String(row.quantity ?? 0));
        setPrice(String(row.selling_price ?? item?.price ?? 0));
        setActive(row.is_active !== false);
      }
    },
    [inventories, item?.price]
  );

  const handleSubmit = async () => {
    if (!selectedId) return;
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(quantity) || quantity < 0) return;
    const selling_price = parseFloat(price);
    await onSubmit(selectedId, {
      quantity,
      is_active: active,
      ...(Number.isNaN(selling_price)
        ? {}
        : { selling_price, unit_cost: selling_price }),
    });
    onDismiss();
  };

  if (!item) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('business.inventory.restock', 'Restock')}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scroll}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium" style={{ marginBottom: spacing.md, color: colors.text.secondary }}>
              {item.name}
            </Text>
            {inventories.length > 1 ? (
              <>
                <Text variant="labelSmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
                  {t('business.items.restockLocation', 'Location')}
                </Text>
                <RadioButton.Group value={selectedId} onValueChange={onSelectInventory}>
                  {inventories.map((r) => (
                    <RadioButton.Item
                      key={r.id}
                      label={r.business_location?.name ?? r.id}
                      value={r.id}
                    />
                  ))}
                </RadioButton.Group>
              </>
            ) : selectedRow ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
                {selectedRow.business_location?.name}
              </Text>
            ) : null}
            <TextInput
              label={t('business.items.quantity', 'Quantity')}
              value={qty}
              onChangeText={setQty}
              keyboardType="number-pad"
              mode="outlined"
              dense
              style={{ marginBottom: spacing.sm }}
            />
            <TextInput
              label={t('business.items.sellingPrice', 'Selling price')}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              style={{ marginBottom: spacing.sm }}
            />
            <View
              style={[
                styles.switchRow,
                {
                  borderRadius: borderRadius.sm,
                  paddingVertical: spacing.xs,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <Text>{t('business.items.available', 'Available')}</Text>
              <Switch value={active} onValueChange={setActive} />
            </View>
            {showServingHours ? (
              <Button
                mode="outlined"
                icon="clock-outline"
                onPress={() => setHoursOpen(true)}
                style={{ marginTop: spacing.xs }}
              >
                {t('business.food.servingHours', 'Serving hours')}
              </Button>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button mode="contained" loading={loading} onPress={() => void handleSubmit()}>
            {t('common.save', 'Save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      {item && foodLocationId ? (
        <FoodAvailabilitySheet
          visible={hoursOpen}
          itemId={item.id}
          businessLocationId={foodLocationId}
          onDismiss={() => setHoursOpen(false)}
        />
      ) : null}
    </Portal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 400, paddingHorizontal: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
