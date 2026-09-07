import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Dialog, Menu, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { businessApi } from '../../services/businessApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { BusinessCatalogItem } from '../../types/business/items';
import type { BusinessLocation } from '../../types/business/locations';
import { getItemInventories } from '../../utils/businessItemUtils';
import { useTheme } from '../../contexts/ThemeContext';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export interface AddInventoryLocationDialogProps {
  visible: boolean;
  item: BusinessCatalogItem;
  onDismiss: () => void;
  onCreated: () => void;
}

export function AddInventoryLocationDialog({
  visible,
  item,
  onDismiss,
  onCreated,
}: AddInventoryLocationDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();

  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('1');
  const [active, setActive] = useState(true);

  const stockedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of getItemInventories(item)) {
      if (row.business_location_id) ids.add(row.business_location_id);
    }
    return ids;
  }, [item]);

  const availableLocations = useMemo(
    () => locations.filter((loc) => !stockedIds.has(loc.id)),
    [locations, stockedIds]
  );

  const selected = availableLocations.find((l) => l.id === locationId);

  const loadLocations = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const res = await businessApi.locations.list();
      const list = res.data?.business_locations ?? [];
      setLocations(list);
      const next = list.filter((l) => !stockedIds.has(l.id));
      setLocationId((prev) => (prev && next.some((l) => l.id === prev) ? prev : next[0]?.id ?? ''));
    } catch {
      setLocations([]);
      setLocationId('');
    } finally {
      setLoadingLoc(false);
    }
  }, [stockedIds]);

  useEffect(() => {
    if (!visible) return;
    setQty('1');
    setActive(true);
    setError(null);
    void loadLocations();
  }, [visible, loadLocations]);

  const goNewLocation = () => {
    onDismiss();
    navigation.navigate('BusinessLocationForm', {});
  };

  const handleSave = async () => {
    if (!locationId) return;
    const quantity = Math.max(0, Number.parseInt(qty, 10) || 0);
    const price = item.price ?? 0;
    setSaving(true);
    setError(null);
    try {
      const res = await businessApi.catalog.createInventory({
        business_location_id: locationId,
        item_id: item.id,
        quantity,
        reserved_quantity: 0,
        reorder_point: 0,
        reorder_quantity: 0,
        unit_cost: price,
        selling_price: price,
        is_active: active,
      });
      if (!res.success) {
        setError(res.error ?? t('business.items.addToLocationError', 'Failed to add stock'));
        return;
      }
      onCreated();
      onDismiss();
    } catch {
      setError(t('business.items.addToLocationError', 'Failed to add stock'));
    } finally {
      setSaving(false);
    }
  };

  const noLocationsLeft = !loadingLoc && availableLocations.length === 0;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss}>
        <Dialog.Title>
          {t('business.items.addToLocationTitle', 'Add to a location')}
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scroll}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
              {t(
                'business.items.addToLocationHint',
                'Stock this product at another store or warehouse that does not have it yet.'
              )}
            </Text>
            <Text variant="labelLarge" style={{ marginBottom: spacing.sm, fontWeight: '600' }}>
              {item.name}
            </Text>
            {noLocationsLeft ? (
              <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
                {locations.length === 0
                  ? t('business.locations.empty', 'No locations yet')
                  : t(
                      'business.items.allLocationsStocked',
                      'This product is already stocked at all your locations.'
                    )}
              </Text>
            ) : (
              <>
                <Menu
                  visible={menuOpen}
                  onDismiss={() => setMenuOpen(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="map-marker"
                      onPress={() => setMenuOpen(true)}
                      disabled={loadingLoc || saving}
                      style={styles.field}
                    >
                      {selected?.name ?? t('business.onboarding.firstSale.location.select', 'Location')}
                    </Button>
                  }
                >
                  {availableLocations.map((loc) => (
                    <Menu.Item
                      key={loc.id}
                      title={loc.name}
                      onPress={() => {
                        setLocationId(loc.id);
                        setMenuOpen(false);
                      }}
                    />
                  ))}
                </Menu>
                <TextInput
                  label={t('business.items.quantity', 'Quantity')}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="number-pad"
                  mode="outlined"
                  dense
                  style={styles.field}
                />
                <View style={styles.switchRow}>
                  <Text>{t('business.items.available', 'Available')}</Text>
                  <Switch value={active} onValueChange={setActive} disabled={saving} />
                </View>
              </>
            )}
            <Button mode="text" icon="map-marker-plus" onPress={goNewLocation} disabled={saving}>
              {t('business.onboarding.firstSale.location.addLocation', 'New location')}
            </Button>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            loading={saving}
            disabled={saving || loadingLoc || noLocationsLeft || !locationId}
            onPress={() => void handleSave()}
          >
            {t('business.items.addToLocationConfirm', 'Add stock')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420, paddingHorizontal: 8 },
  field: { marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
