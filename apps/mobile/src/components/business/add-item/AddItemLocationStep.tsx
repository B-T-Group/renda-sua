import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Menu, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { businessApi } from '../../../services/businessApi';
import type { BusinessLocation } from '../../../types/business/locations';
import type { CreatedSaleItemSummary } from '../../../types/business/items';
import type { BusinessRootStackParamList } from '../../../navigation/types';
import { useTheme } from '../../../contexts/ThemeContext';
import { ListingPreviewSheet } from '../ListingPreviewSheet';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export interface AddItemLocationStepProps {
  item: CreatedSaleItemSummary;
  busy: boolean;
  previewImageUri?: string | null;
  /** Prefer this location when present in the loaded list. */
  initialLocationId?: string;
  onFinish: (
    locationId: string,
    quantity: number,
    publish: boolean,
    locationName?: string
  ) => void;
}

export function AddItemLocationStep({
  item,
  busy,
  previewImageUri,
  initialLocationId,
  onFinish,
}: AddItemLocationStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const res = await businessApi.locations.list();
      const list = res.data?.business_locations ?? [];
      setLocations(list);
      setLocationId((prev) => {
        if (prev) return prev;
        if (initialLocationId && list.some((l) => l.id === initialLocationId)) {
          return initialLocationId;
        }
        return list[0]?.id || '';
      });
    } catch {
      setLocations([]);
    } finally {
      setLoadingLoc(false);
    }
  }, [initialLocationId]);

  useFocusEffect(
    useCallback(() => {
      void loadLocations();
    }, [loadLocations])
  );

  const selected = locations.find((l) => l.id === locationId);
  const canSubmit = !busy && !loadingLoc && !!locationId;
  const quantity = Math.max(0, Number.parseInt(qty, 10) || 0);
  const previewModel = useMemo(
    () => ({
      title: item.name,
      imageUri: previewImageUri,
      priceLine:
        item.price != null
          ? `${item.currency ?? 'XAF'} ${item.price}`
          : null,
      locationLine: selected?.name
        ? t('business.listingPreview.atLocation', 'At {{name}}', {
            name: selected.name,
          })
        : null,
      metaLines: [
        t('business.listingPreview.qty', 'Stock: {{count}}', { count: quantity }),
      ],
    }),
    [item.currency, item.name, item.price, previewImageUri, quantity, selected?.name, t]
  );

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={styles.content}
      wrapAvoidingView={false}
    >
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t(
          'business.onboarding.firstSale.location.hint',
          'Choose where this product is stocked. You can add a new location if needed.'
        )}
      </Text>
      {locations.length === 0 && !loadingLoc ? (
        <Button
          mode="outlined"
          icon="map-marker-plus"
          onPress={() => navigation.navigate('BusinessLocationForm', {})}
          style={styles.addLocBtn}
        >
          {t('business.onboarding.firstSale.location.addLocation', 'New location')}
        </Button>
      ) : (
        <>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setMenuOpen(true)}
                disabled={busy || !locations.length}
              >
                {selected?.name ??
                  t('business.onboarding.firstSale.location.select', 'Location')}
              </Button>
            }
          >
            {locations.map((loc) => (
              <Menu.Item
                key={loc.id}
                onPress={() => {
                  setLocationId(loc.id);
                  setMenuOpen(false);
                }}
                title={loc.name}
              />
            ))}
          </Menu>
          <Button
            mode="text"
            icon="plus"
            onPress={() => navigation.navigate('BusinessLocationForm', {})}
            style={styles.addLocBtn}
          >
            {t('business.onboarding.firstSale.location.addLocation', 'New location')}
          </Button>
        </>
      )}
      <TextInput
        label={t('business.onboarding.firstSale.location.quantity', 'Quantity')}
        value={qty}
        onChangeText={setQty}
        keyboardType="number-pad"
        mode="outlined"
        disabled={busy}
        style={styles.qtyField}
      />
      <View style={{ gap: 10 }}>
        <Button
          mode="outlined"
          icon="eye-outline"
          disabled={busy}
          onPress={() => setPreviewOpen(true)}
        >
          {t('business.listingPreview.cta', 'Preview listing')}
        </Button>
        <Button
          mode="contained"
          loading={busy}
          disabled={!canSubmit}
          onPress={() => onFinish(locationId, quantity, true, selected?.name)}
        >
          {t('business.onboarding.firstSale.location.publish', 'Publish product')}
        </Button>
        <Button
          mode="outlined"
          disabled={!canSubmit}
          onPress={() => onFinish(locationId, quantity, false, selected?.name)}
        >
          {t('business.onboarding.firstSale.location.saveDraft', 'Save as draft')}
        </Button>
      </View>
      <Text variant="bodySmall" style={{ marginTop: spacing.sm, color: colors.text.secondary }}>
        {item.name}
        {item.price != null ? ` · ${item.price} ${item.currency ?? 'XAF'}` : ''}
      </Text>
      <ListingPreviewSheet
        visible={previewOpen}
        onDismiss={() => setPreviewOpen(false)}
        model={previewModel}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  addLocBtn: { marginVertical: 12, alignSelf: 'flex-start' },
  qtyField: { marginBottom: 16 },
});
