import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Switch,
  Text,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useSupportedCurrencies } from '../../hooks/business/useSupportedCurrencies';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type {
  BusinessRentalItemDetail,
  RentalOperationMode,
} from '../../types/rentals';
import {
  ItemFormOptionDialog,
  type FormOption,
} from '../../components/business/item-form/ItemFormOptionDialog';
import { RentalWeeklyHoursEditor } from '../../components/business/rentals/RentalWeeklyHoursEditor';
import type { RentalWeeklyAvailabilityRow } from '../../types/rentals';
import { defaultWeeklyAvailability } from '../../utils/rentals';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalItemEdit'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

/** Mirrors the backend listing default of 8x the hourly rate. */
const DEFAULT_DEPOSIT_HOURLY_MULTIPLIER = 8;

export default function BusinessRentalItemEditScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const itemId = route.params.itemId;
  const { categories, createCategory } = useRentalCategories();
  const { defaultCurrency } = useSupportedCurrencies();

  const [item, setItem] = useState<BusinessRentalItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [operationMode, setOperationMode] =
    useState<RentalOperationMode>('business_operated');
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [listingEdits, setListingEdits] = useState<
    Record<
      string,
      {
        hourly: string;
        daily: string;
        deposit: string;
        units: string;
        pickup: string;
        dropoff: string;
        active: boolean;
        weeklyHours: RentalWeeklyAvailabilityRow[];
      }
    >
  >({});

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const data = await rentalsApi.getBusinessItem(itemId);
      setItem(data);
      if (data) {
        setName(data.name);
        setDescription(data.description ?? '');
        setCategoryId(data.rental_category_id);
        setTagsText((data.tags ?? []).join(', '));
        setIsActive(data.is_active);
        setOperationMode(
          data.operation_mode === 'take_home' ? 'take_home' : 'business_operated'
        );
        const edits: typeof listingEdits = {};
        for (const l of data.rental_location_listings.filter((x) => !x.deleted_at)) {
          edits[l.id] = {
            hourly: String(l.base_price_per_hour ?? ''),
            daily: String(l.base_price_per_day ?? ''),
            deposit:
              l.security_deposit_amount != null
                ? String(l.security_deposit_amount)
                : '',
            units: String(l.units_available ?? 1),
            pickup: l.pickup_instructions ?? '',
            dropoff: l.dropoff_instructions ?? '',
            active: l.is_active,
            weeklyHours:
              l.weekly_availability?.length > 0
                ? l.weekly_availability
                : defaultWeeklyAvailability(),
          };
        }
        setListingEdits(edits);
      }
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useFocusEffect(
    useCallback(() => {
      void load({ soft: true });
    }, [load])
  );

  const save = useCallback(async () => {
    if (!name.trim() || !categoryId) return;
    setBusy(true);
    try {
      await rentalsApi.updateBusinessItem(itemId, {
        name: name.trim(),
        description: description.trim() || undefined,
        rental_category_id: categoryId,
        currency: defaultCurrency || 'XAF',
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        is_active: isActive,
        operation_mode: operationMode,
      });
      for (const [listingId, edit] of Object.entries(listingEdits)) {
        const hourly = parseFloat(edit.hourly);
        const daily = parseFloat(edit.daily);
        const deposit = edit.deposit.trim() ? parseFloat(edit.deposit) : NaN;
        // A cleared deposit field reverts to the advertised default (8x hourly).
        const depositToSave =
          Number.isFinite(deposit) && deposit >= 0
            ? deposit
            : Number.isFinite(hourly)
              ? Number((hourly * DEFAULT_DEPOSIT_HOURLY_MULTIPLIER).toFixed(2))
              : undefined;
        const units = Math.floor(Number(edit.units));
        await rentalsApi.updateBusinessListing(listingId, {
          base_price_per_hour: Number.isFinite(hourly) ? hourly : undefined,
          base_price_per_day: Number.isFinite(daily) ? daily : undefined,
          security_deposit_amount: depositToSave,
          units_available: Number.isInteger(units) && units >= 1 ? units : undefined,
          pickup_instructions: edit.pickup.trim() || undefined,
          dropoff_instructions: edit.dropoff.trim() || undefined,
          is_active: edit.active,
          weekly_availability: edit.weeklyHours,
        });
      }
      setSnack(t('business.rentals.saved', 'Saved'));
      navigation.goBack();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error ? e.message : t('business.rentals.saveFailed', 'Could not save')
      );
    } finally {
      setBusy(false);
    }
  }, [
    categoryId,
    defaultCurrency,
    description,
    isActive,
    itemId,
    listingEdits,
    name,
    navigation,
    operationMode,
    t,
    tagsText,
  ]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('business.rentals.notFound', 'Rental not found')}</Text>
      </View>
    );
  }

  const categoryOptions: FormOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleCreateCategory = async (nameValue: string) => {
    try {
      const created = await createCategory(nameValue);
      setCategoryId(created.id);
      setCategoryPicker(false);
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('business.rentals.createCategoryFailed', 'Could not create category')
      );
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      avoidingViewStyle={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}
    >
      <TextInput
        label={t('business.rentals.wizard.details.name', 'Name')}
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.field}
      />
      <Button mode="outlined" onPress={() => setCategoryPicker(true)} style={styles.field}>
        {selectedCategory?.name ??
          t('business.rentals.wizard.details.selectCategory', 'Select category')}
      </Button>
      <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>
        {t('business.rentals.wizard.details.mode', 'How does this rental work?')}
      </Text>
      <View style={styles.modeRow}>
        <Button
          mode={operationMode === 'business_operated' ? 'contained' : 'outlined'}
          onPress={() => setOperationMode('business_operated')}
          compact
        >
          {t('business.rentals.modes.operatedShort', 'Operated')}
        </Button>
        <Button
          mode={operationMode === 'take_home' ? 'contained' : 'outlined'}
          onPress={() => setOperationMode('take_home')}
          compact
        >
          {t('business.rentals.modes.takeHomeShort', 'Take-home')}
        </Button>
      </View>
      <TextInput
        label={t('business.rentals.wizard.details.description', 'Description')}
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        multiline
        style={styles.field}
      />
      <TextInput
        label={t('business.rentals.wizard.details.currency', 'Currency')}
        value={defaultCurrency || '—'}
        mode="outlined"
        editable={false}
        disabled
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: -6, marginBottom: 10 }}
      >
        {t(
          'business.items.currencyLockedToCountry',
          'Locked to your business country'
        )}
      </Text>
      <TextInput
        label={t('business.rentals.wizard.details.tags', 'Tags (comma-separated)')}
        value={tagsText}
        onChangeText={setTagsText}
        mode="outlined"
        style={styles.field}
      />
      <View style={styles.switchRow}>
        <Text style={{ color: colors.text.primary }}>
          {t('business.rentals.catalog.active', 'Active')}
        </Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>

      <Text style={{ color: colors.text.primary, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>
        {t('business.rentals.listings', 'Listings')}
      </Text>
      <Button
        mode="outlined"
        icon="map-marker-plus"
        style={{ marginBottom: 12 }}
        onPress={() =>
          navigation.navigate('BusinessRentalAddListing', { itemId })
        }
      >
        {t('business.rentals.addListing', 'Add location listing')}
      </Button>
      {Object.entries(listingEdits).map(([listingId, edit]) => {
        const listing = item.rental_location_listings.find((l) => l.id === listingId);
        return (
          <View key={listingId} style={styles.listingBlock}>
            <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>
              {listing?.business_location?.name ?? listingId}
            </Text>
            <TextInput
              label={t('business.rentals.wizard.location.hourly', 'Hourly rate')}
              value={edit.hourly}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], hourly: v },
                }))
              }
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label={t('business.rentals.wizard.location.daily', 'Daily rate (optional)')}
              value={edit.daily}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], daily: v },
                }))
              }
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label={t(
                'business.rentals.wizard.location.deposit',
                'Security deposit (optional)'
              )}
              value={edit.deposit}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], deposit: v },
                }))
              }
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.field}
            />
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: -6, marginBottom: 10 }}
            >
              {t(
                'business.rentals.wizard.location.depositHelp',
                'Held on card rentals to cover extra hours. Default is 8× the hourly rate.'
              )}
            </Text>
            <TextInput
              label={t('business.rentals.units', 'Units available')}
              value={edit.units}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], units: v },
                }))
              }
              keyboardType="number-pad"
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label={t('business.rentals.wizard.location.pickup', 'Pickup notes')}
              value={edit.pickup}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], pickup: v },
                }))
              }
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label={t('business.rentals.wizard.location.dropoff', 'Return notes')}
              value={edit.dropoff}
              onChangeText={(v) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], dropoff: v },
                }))
              }
              mode="outlined"
              style={styles.field}
            />
            <View style={styles.switchRow}>
              <Text>{t('business.rentals.listingActive', 'Listing active')}</Text>
              <Switch
                value={edit.active}
                onValueChange={(v) =>
                  setListingEdits((prev) => ({
                    ...prev,
                    [listingId]: { ...prev[listingId], active: v },
                  }))
                }
              />
            </View>
            <RentalWeeklyHoursEditor
              value={edit.weeklyHours}
              onChange={(weeklyHours) =>
                setListingEdits((prev) => ({
                  ...prev,
                  [listingId]: { ...prev[listingId], weeklyHours },
                }))
              }
            />
          </View>
        );
      })}

      <Button mode="contained" loading={busy} disabled={busy} onPress={() => void save()}>
        {t('common.save', 'Save')}
      </Button>

      <ItemFormOptionDialog
        visible={categoryPicker}
        title={t('business.rentals.wizard.details.category', 'Category')}
        options={categoryOptions}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setCategoryPicker(false);
        }}
        onDismiss={() => setCategoryPicker(false)}
        onCreateNew={(value) => {
          void handleCreateCategory(value);
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 12 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listingBlock: { marginBottom: 16 },
});
