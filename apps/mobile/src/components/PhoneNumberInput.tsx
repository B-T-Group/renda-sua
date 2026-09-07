import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal } from './common/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import { getCountryCallingCode } from 'libphonenumber-js';
import { useTheme } from '../contexts/ThemeContext';
import { useSupportedCountries } from '../hooks/useSupportedCountries';
import { isoToFlagEmoji } from '../utils/countryFlagEmoji';
import { buildSortedPhoneCountryOptions, type PhoneCountryOption } from '../utils/phoneCountryOptions';
import { formatNationalForDisplay } from '../utils/phoneLoginUsername';

export type PhoneNumberInputProps = {
  countryIso: CountryCode;
  nationalDigits: string;
  onCountryIsoChange: (iso: CountryCode) => void;
  onNationalDigitsChange: (digits: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  /**
   * Lock the country/dial-code picker (keeping the number field editable).
   * Useful when the country is chosen elsewhere in the flow.
   */
  disableCountryPicker?: boolean;
  /**
   * Restrict the selectable countries to these ISO2 codes. When omitted, the
   * platform's supported countries are loaded and used automatically.
   */
  allowedIsos?: CountryCode[];
};

const MAX_NATIONAL_DIGITS = 15;

function PhoneNumberInput({
  countryIso,
  nationalDigits,
  onCountryIsoChange,
  onNationalDigitsChange,
  hasError,
  disabled,
  disableCountryPicker,
  allowedIsos,
}: PhoneNumberInputProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { allowedIsos: supportedIsos } = useSupportedCountries();
  const effectiveAllowed = allowedIsos ?? supportedIsos;

  const allOptions = useMemo(
    () => buildSortedPhoneCountryOptions(i18n.language || 'en', effectiveAllowed),
    [i18n.language, effectiveAllowed]
  );

  // If the selected country isn't in the supported list, snap to a supported one.
  useEffect(() => {
    if (!effectiveAllowed || effectiveAllowed.length === 0) return;
    if (effectiveAllowed.includes(countryIso)) return;
    const fallback = allOptions[0]?.iso;
    if (fallback && fallback !== countryIso) {
      onCountryIsoChange(fallback);
    }
  }, [effectiveAllowed, countryIso, allOptions, onCountryIsoChange]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((row) => {
      const dial = `+${row.callingCode}`;
      return (
        row.name.toLowerCase().includes(q) ||
        row.iso.toLowerCase().includes(q) ||
        dial.includes(q) ||
        row.callingCode.includes(q)
      );
    });
  }, [allOptions, search]);

  const dialCode = useMemo(() => getCountryCallingCode(countryIso), [countryIso]);
  const displayNational = formatNationalForDisplay(countryIso, nationalDigits);

  const borderColor = hasError ? colors.error.main : colors.border;

  const onNationalChangeText = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, MAX_NATIONAL_DIGITS);
      onNationalDigitsChange(digits);
    },
    [onNationalDigitsChange]
  );

  const renderCountryRow = useCallback(
    ({ item }: { item: PhoneCountryOption }) => {
      const selected = item.iso === countryIso;
      return (
        <Pressable
          onPress={() => {
            onCountryIsoChange(item.iso);
            setPickerOpen(false);
            setSearch('');
          }}
          style={[
            styles.listRow,
            {
              backgroundColor: selected ? colors.primaryTint : 'transparent',
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.rowFlag]}>{isoToFlagEmoji(item.iso)}</Text>
          <View style={styles.rowText}>
            <Text style={[typography.body1, { color: colors.text.primary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {item.iso} · +{item.callingCode}
            </Text>
          </View>
          {selected ? (
            <MaterialCommunityIcons name="check" size={22} color={colors.primary.main} />
          ) : null}
        </Pressable>
      );
    },
    [colors, countryIso, onCountryIsoChange, typography.body1, typography.body2]
  );

  const keyExtractor = useCallback((item: PhoneCountryOption) => item.iso, []);

  return (
    <View>
      <View
        style={[
          styles.rowWrap,
          {
            backgroundColor: colors.surface,
            borderColor,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <Pressable
          onPress={() => !disabled && !disableCountryPicker && setPickerOpen(true)}
          disabled={disabled || disableCountryPicker}
          style={({ pressed }) => [
            styles.countryTrigger,
            {
              borderRightColor: colors.border,
              opacity: disabled || disableCountryPicker ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.selectCountryA11y')}
        >
          <Text style={styles.triggerFlag}>{isoToFlagEmoji(countryIso)}</Text>
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>+{dialCode}</Text>
          {!disableCountryPicker ? (
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.text.secondary} />
          ) : null}
        </Pressable>
        <TextInput
          style={[styles.numberInput, { color: colors.text.primary }, typography.body1]}
          placeholder={t('auth.phoneNationalPlaceholder')}
          placeholderTextColor={colors.text.disabled}
          value={displayNational}
          onChangeText={onNationalChangeText}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel-national"
          editable={!disabled}
          accessibilityLabel={t('auth.phone')}
        />
      </View>

      <AppModal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView
            edges={['top', 'bottom']}
            style={[styles.modalSheet, { backgroundColor: colors.pageBackground }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[typography.h6, { color: colors.text.primary }]}>{t('auth.selectCountry')}</Text>
              <Pressable
                onPress={() => {
                  setPickerOpen(false);
                  setSearch('');
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <MaterialCommunityIcons name="close" size={26} color={colors.text.secondary} />
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text.primary,
                  borderRadius: borderRadius.md,
                },
                typography.body1,
              ]}
              placeholder={t('auth.searchCountry')}
              placeholderTextColor={colors.text.disabled}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FlatList
              data={filteredOptions}
              keyExtractor={keyExtractor}
              renderItem={renderCountryRow}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={18}
              windowSize={10}
              style={styles.list}
            />
          </SafeAreaView>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 4,
    minHeight: 52,
    overflow: 'hidden',
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
    maxWidth: '42%',
  },
  triggerFlag: {
    fontSize: 22,
    lineHeight: Platform.OS === 'android' ? 26 : 24,
  },
  numberInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  list: {
    flexGrow: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  rowFlag: {
    fontSize: 26,
    width: 40,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
});

export default React.memo(PhoneNumberInput);
