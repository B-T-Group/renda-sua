import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, HelperText, Text } from 'react-native-paper';
import {
  SearchablePickerModal,
  type PickerRow,
} from '../../forms/SearchablePickerModal';
import { useTheme } from '../../../contexts/ThemeContext';
import { isoToFlagEmoji } from '../../../utils/countryFlagEmoji';

export interface CountryStepProps {
  country: string;
  countryLabel: string;
  countryRows: PickerRow[];
  pickerOpen: boolean;
  disabled?: boolean;
  phoneRequiredHint?: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectCountry: (code: string) => void;
}

export function CountryStep({
  country,
  countryLabel,
  countryRows,
  pickerOpen,
  disabled,
  phoneRequiredHint,
  onOpenPicker,
  onClosePicker,
  onSelectCountry,
}: CountryStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <View>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t(
          'auth.signupFlow.countryHint',
          'Choose where you operate. This sets payments, verification, and local options.'
        )}
      </Text>
      <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: 4 }}>
        {t('addresses.country', 'Country')}
      </Text>
      <Button
        mode="outlined"
        onPress={onOpenPicker}
        disabled={disabled}
        icon={() => <Text style={styles.countryFlag}>{isoToFlagEmoji(country)}</Text>}
        style={[styles.field, styles.countryBtn]}
        contentStyle={styles.countryBtnContent}
      >
        {countryLabel}
      </Button>
      {phoneRequiredHint ? (
        <HelperText type="info" visible>
          {t(
            'auth.signupFlow.phonePaymentsNote',
            'Payments and payouts for your account will be sent to this phone number.'
          )}
        </HelperText>
      ) : null}
      <SearchablePickerModal
        visible={pickerOpen}
        title={t('addresses.pickCountry', 'Select country')}
        rows={countryRows}
        searchPlaceholder={t('addresses.pickerSearch', 'Search…')}
        onDismiss={onClosePicker}
        onSelect={(row) => onSelectCountry(row.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 8 },
  countryBtn: { alignSelf: 'stretch' },
  countryBtnContent: { justifyContent: 'flex-start' },
  countryFlag: { fontSize: 20 },
});
