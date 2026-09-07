import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { isAfricanMarketCountry } from '../../constants/marketCountries';
import { getCountryStateCity } from '../../utils/countryStateCityLoader';
import { resolveDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { SearchablePickerModal, type PickerRow } from './SearchablePickerModal';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { alignGeocodeToCscFields } from '../../utils/addressRegionMatch';
import type { GeocodeApiResult } from '../../types/googleMapsApi';

export interface DeliveryAddressFormValue {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  /** GPS coordinates populated when address was auto-detected. Cleared on manual edits to key fields. */
  latitude?: number;
  longitude?: number;
}

export interface DeliveryAddressFormProps {
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  disabled?: boolean;
  /** Lock the country picker (e.g. country chosen earlier in the flow). */
  disableCountry?: boolean;
  /** Use Google Places autocomplete (biased to `value.country`) for line 1. */
  enableAutocomplete?: boolean;
  /** When true, postal is labeled required (still hidden for CM/GA). */
  postalRequired?: boolean;
}

type PickerKind = 'country' | 'state' | 'city' | null;

export function DeliveryAddressForm({
  value,
  onChange,
  disabled = false,
  disableCountry = false,
  enableAutocomplete = true,
  postalRequired = false,
}: DeliveryAddressFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [csc, setCsc] = useState<typeof import('country-state-city') | null>(null);
  const [picker, setPicker] = useState<PickerKind>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    void getCountryStateCity().then(setCsc);
  }, []);

  useEffect(() => {
    if (value.country.trim()) {
      return;
    }
    let cancelled = false;
    void resolveDeviceDefaultCountryCode().then((code) => {
      if (cancelled || valueRef.current.country.trim()) {
        return;
      }
      onChange({ ...valueRef.current, country: code, state: '', city: '' });
    });
    return () => {
      cancelled = true;
    };
  }, [onChange]);

  const countryRows = useMemo((): PickerRow[] => {
    if (!csc) return [];
    return csc.Country.getAllCountries()
      .map((c) => ({ id: c.isoCode, title: c.name }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [csc]);

  const stateRows = useMemo((): PickerRow[] => {
    if (!csc || !value.country) return [];
    return csc.State.getStatesOfCountry(value.country).map((s) => ({ id: s.isoCode, title: s.name }));
  }, [csc, value.country]);

  const cityRows = useMemo((): PickerRow[] => {
    if (!csc || !value.country || !value.state) return [];
    const stateList = csc.State.getStatesOfCountry(value.country);
    const sc =
      stateList.find((s) => s.name === value.state)?.isoCode ||
      stateList.find((s) => s.isoCode.toLowerCase() === value.state.toLowerCase())?.isoCode;
    if (!sc) return [];
    return csc.City.getCitiesOfState(value.country, sc).map((city, idx) => ({
      id: `${city.name}|${city.latitude ?? idx}|${city.longitude ?? idx}`,
      title: city.name,
    }));
  }, [csc, value.country, value.state]);

  const hidePostal = isAfricanMarketCountry(value.country);

  const countryLabel =
    countryRows.find((r) => r.id === value.country)?.title ||
    value.country ||
    t('addresses.pickCountry', 'Select country');
  const stateLabel = value.state || t('addresses.pickState', 'Select state / region');
  const cityLabel = value.city || t('addresses.pickCity', 'Select city');

  const pickerRows = useMemo(() => {
    if (picker === 'country') return countryRows;
    if (picker === 'state') return stateRows;
    if (picker === 'city') return cityRows;
    return [];
  }, [picker, countryRows, stateRows, cityRows]);

  const pickerTitle =
    picker === 'country'
      ? t('addresses.pickCountry', 'Select country')
      : picker === 'state'
        ? t('addresses.pickState', 'Select state / region')
        : picker === 'city'
          ? t('addresses.pickCity', 'Select city')
          : '';

  const patch = useCallback(
    (partial: Partial<DeliveryAddressFormValue>) => {
      const clearsCoords =
        'address_line_1' in partial || 'country' in partial || 'state' in partial || 'city' in partial;
      onChange({
        ...value,
        ...partial,
        ...(clearsCoords ? { latitude: undefined, longitude: undefined } : {}),
      });
    },
    [onChange, value]
  );

  const onPickerSelect = useCallback(
    (row: PickerRow) => {
      if (picker === 'country') {
        onChange({ ...value, country: row.id, state: '', city: '', latitude: undefined, longitude: undefined });
      } else if (picker === 'state') {
        onChange({ ...value, state: row.title, city: '', latitude: undefined, longitude: undefined });
      } else if (picker === 'city') {
        onChange({ ...value, city: row.title, latitude: undefined, longitude: undefined });
      }
    },
    [onChange, picker, value]
  );

  const onAutocompletePlace = useCallback(
    async (result: GeocodeApiResult) => {
      const aligned = await alignGeocodeToCscFields(result);
      const prev = valueRef.current;
      onChange({
        ...prev,
        address_line_1:
          result.address_line_1 || result.formatted_address || prev.address_line_1,
        country: aligned.country || prev.country,
        state: aligned.state || prev.state,
        city: aligned.city || prev.city,
        postal_code: result.postal_code || prev.postal_code,
      });
    },
    [onChange]
  );

  const inputTheme = {
    colors: { onSurfaceVariant: colors.text.secondary, background: colors.surface },
  };

  return (
    <View style={styles.root}>
      {enableAutocomplete ? (
        <AddressAutocompleteInput
          label={t('addresses.addressLine1', 'Address line 1')}
          value={value.address_line_1}
          country={value.country}
          disabled={disabled}
          onChangeText={(v) => patch({ address_line_1: v })}
          onSelectPlace={onAutocompletePlace}
          theme={inputTheme}
        />
      ) : (
        <TextInput
          mode="outlined"
          label={t('addresses.addressLine1', 'Address line 1')}
          value={value.address_line_1}
          onChangeText={(v) => patch({ address_line_1: v })}
          disabled={disabled}
          theme={inputTheme}
          style={styles.field}
        />
      )}

      <TextInput
        mode="outlined"
        label={t('addresses.instructionsLabel', 'How to find this place (optional)')}
        value={value.address_line_2}
        onChangeText={(v) => patch({ address_line_2: v })}
        disabled={disabled}
        multiline
        numberOfLines={3}
        theme={inputTheme}
        style={styles.field}
        placeholder={t('addresses.instructionsHelper', 'Landmark, building, floor…')}
      />

      {!csc ? (
        <ActivityIndicator style={{ marginVertical: 8 }} color={colors.primary.main} />
      ) : (
        <>
          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: 4 }}>
            {t('addresses.country', 'Country')}
          </Text>
          <Button
            mode="outlined"
            onPress={() => setPicker('country')}
            disabled={disabled || disableCountry}
            style={styles.selectBtn}
            contentStyle={styles.selectBtnContent}
          >
            {countryLabel}
          </Button>

          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginTop: 8, marginBottom: 4 }}>
            {t('addresses.state', 'State / region')}
          </Text>
          <Button
            mode="outlined"
            onPress={() => setPicker('state')}
            disabled={disabled || !value.country}
            style={styles.selectBtn}
            contentStyle={styles.selectBtnContent}
          >
            {stateLabel}
          </Button>

          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginTop: 8, marginBottom: 4 }}>
            {t('addresses.city', 'City')}
          </Text>
          <Button
            mode="outlined"
            onPress={() => setPicker('city')}
            disabled={disabled || !value.country || !value.state}
            style={styles.selectBtn}
            contentStyle={styles.selectBtnContent}
          >
            {cityLabel}
          </Button>
        </>
      )}

      {!hidePostal ? (
        <TextInput
          mode="outlined"
          label={
            postalRequired
              ? t('addresses.postalCode', 'Postal code')
              : t('addresses.postalCodeOptional', 'Postal code (optional)')
          }
          value={value.postal_code}
          onChangeText={(v) => patch({ postal_code: v })}
          disabled={disabled}
          theme={inputTheme}
          style={[styles.field, { marginTop: 8 }]}
        />
      ) : null}

      <SearchablePickerModal
        visible={picker !== null}
        title={pickerTitle}
        rows={pickerRows}
        searchPlaceholder={t('addresses.pickerSearch', 'Search…')}
        onDismiss={() => setPicker(null)}
        onSelect={onPickerSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  field: { marginBottom: 4 },
  selectBtn: { alignSelf: 'stretch' },
  selectBtnContent: { justifyContent: 'flex-start' },
});
