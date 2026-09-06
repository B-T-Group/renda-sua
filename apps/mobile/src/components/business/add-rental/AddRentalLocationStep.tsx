import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Menu, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { businessApi } from '../../../services/businessApi';
import type { BusinessLocation } from '../../../types/business/locations';
import type { CreatedRentalItemSummary } from '../../../types/rentals';
import type { BusinessRootStackParamList } from '../../../navigation/types';
import type { AddRentalLocationForm } from '../../../hooks/business/useBusinessAddRentalFromImage';
import { useTheme } from '../../../contexts/ThemeContext';
import { ListingPreviewSheet } from '../ListingPreviewSheet';
import { RentalWeeklyHoursSummary } from './RentalWeeklyHoursSummary';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export interface AddRentalLocationStepProps {
  item: CreatedRentalItemSummary;
  busy: boolean;
  previewImageUri?: string | null;
  onFinish: (form: AddRentalLocationForm, publish: boolean) => void;
}

export function AddRentalLocationStep({
  item,
  busy,
  previewImageUri,
  onFinish,
}: AddRentalLocationStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [hourly, setHourly] = useState('');
  const [daily, setDaily] = useState('');
  const [deposit, setDeposit] = useState('');
  const [units, setUnits] = useState('1');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const res = await businessApi.locations.list();
      const list = res.data?.business_locations ?? [];
      setLocations(list);
      setLocationId((prev) => prev || list[0]?.id || '');
    } catch {
      setLocations([]);
    } finally {
      setLoadingLoc(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLocations();
    }, [loadLocations])
  );

  const selected = locations.find((l) => l.id === locationId);
  const hourlyNum = parseFloat(hourly);
  const dailyNum = daily.trim() ? parseFloat(daily) : hourlyNum * 12;
  const depositNum = deposit.trim() ? parseFloat(deposit) : undefined;
  const unitsNum = Math.floor(Number(units));
  const canSubmit =
    !busy &&
    !loadingLoc &&
    !!locationId &&
    Number.isFinite(hourlyNum) &&
    hourlyNum >= 0 &&
    (depositNum === undefined ||
      (Number.isFinite(depositNum) && depositNum >= 0)) &&
    Number.isInteger(unitsNum) &&
    unitsNum >= 1;

  const buildForm = (): AddRentalLocationForm => ({
    locationId,
    locationName: selected?.name,
    base_price_per_hour: hourlyNum,
    base_price_per_day: Number.isFinite(dailyNum) ? dailyNum : hourlyNum * 12,
    security_deposit_amount: depositNum,
    units_available: unitsNum,
    pickup_instructions: pickup,
    dropoff_instructions: dropoff,
  });

  const previewModel = useMemo(() => {
    const currency = item.currency || 'XAF';
    const hourLabel = Number.isFinite(hourlyNum)
      ? `${currency} ${hourlyNum}/${t('business.listingPreview.hour', 'hr')}`
      : null;
    const dayRate = Number.isFinite(dailyNum) ? dailyNum : hourlyNum * 12;
    const dayLabel = Number.isFinite(dayRate)
      ? `${currency} ${dayRate}/${t('business.listingPreview.day', 'day')}`
      : null;
    return {
      title: item.name,
      imageUri: previewImageUri,
      priceLine: [hourLabel, dayLabel].filter(Boolean).join(' · ') || null,
      locationLine: selected?.name
        ? t('business.listingPreview.atLocation', 'At {{name}}', {
            name: selected.name,
          })
        : null,
      metaLines: [
        item.operation_mode === 'take_home'
          ? t('business.rentals.modes.takeHomeTitle', 'Take-home')
          : t('business.rentals.modes.operatedTitle', 'Operated at your location'),
        t('business.listingPreview.defaultHours', 'Mon–Sat 08:00–20:00'),
      ],
    };
  }, [
    dailyNum,
    hourlyNum,
    item.currency,
    item.name,
    item.operation_mode,
    previewImageUri,
    selected?.name,
    t,
  ]);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      wrapAvoidingView={false}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 4 }}>
        {item.name}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'business.rentals.wizard.location.hint',
          'Choose a location and set hourly and daily rates. Daily defaults to 12× hourly if left blank.'
        )}
      </Text>

      {locations.length === 0 && !loadingLoc ? (
        <Button
          mode="outlined"
          icon="map-marker-plus"
          onPress={() => navigation.navigate('BusinessLocationForm', {})}
        >
          {t('business.rentals.wizard.location.addLocation', 'New location')}
        </Button>
      ) : (
        <>
          <Text
            variant="labelLarge"
            style={{ color: colors.text.secondary, marginBottom: 6 }}
          >
            {t('business.rentals.wizard.location.select', 'Location')}
          </Text>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                icon="menu-down"
                contentStyle={styles.dropdownContent}
                onPress={() => setMenuOpen(true)}
                disabled={busy || !locations.length}
                accessibilityRole="button"
                accessibilityHint={t(
                  'business.rentals.wizard.location.selectHint',
                  'Opens a list of locations'
                )}
              >
                {selected?.name ??
                  t(
                    'business.rentals.wizard.location.selectPlaceholder',
                    'Select location'
                  )}
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
            style={{ marginTop: 4 }}
          >
            {t('business.rentals.wizard.location.addLocation', 'New location')}
          </Button>
        </>
      )}

      <TextInput
        label={t('business.rentals.wizard.location.hourly', 'Hourly rate')}
        value={hourly}
        onChangeText={setHourly}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />
      <TextInput
        label={t(
          'business.rentals.wizard.location.daily',
          'Daily rate (optional)'
        )}
        value={daily}
        onChangeText={setDaily}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />
      <TextInput
        label={t(
          'business.rentals.wizard.location.deposit',
          'Security deposit (optional)'
        )}
        value={deposit}
        onChangeText={setDeposit}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.wizard.location.depositHelp',
          'Held on card rentals to cover extra hours. Default is 8× the hourly rate.'
        )}
      </Text>
      <TextInput
        label={t('business.rentals.units', 'Units available')}
        value={units}
        onChangeText={setUnits}
        keyboardType="number-pad"
        mode="outlined"
        disabled={busy}
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.unitsHelp',
          'How many identical units can be rented at once?'
        )}
      </Text>
      <TextInput
        label={t('business.rentals.wizard.location.pickup', 'Pickup notes')}
        value={pickup}
        onChangeText={setPickup}
        mode="outlined"
        multiline
        disabled={busy}
        style={styles.field}
      />
      <TextInput
        label={t('business.rentals.wizard.location.dropoff', 'Return notes')}
        value={dropoff}
        onChangeText={setDropoff}
        mode="outlined"
        multiline
        disabled={busy}
        style={styles.field}
      />

      <RentalWeeklyHoursSummary />

      <View style={{ marginTop: spacing.md, gap: 10 }}>
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
          onPress={() => onFinish(buildForm(), true)}
        >
          {t('business.rentals.wizard.location.publish', 'Publish rental')}
        </Button>
        <Button
          mode="outlined"
          disabled={!canSubmit}
          onPress={() => onFinish(buildForm(), false)}
        >
          {t('business.rentals.wizard.location.saveDraft', 'Save as draft')}
        </Button>
      </View>
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
  content: { paddingBottom: 40 },
  field: { marginTop: 12 },
  dropdownContent: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
});
