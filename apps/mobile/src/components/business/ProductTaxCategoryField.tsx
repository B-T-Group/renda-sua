import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  STRIPE_TAX_CODE_GENERAL_TANGIBLE,
  useStripeTaxCodes,
} from '@/hooks/business/useStripeTaxCodes';
import { useTheme } from '@/contexts/ThemeContext';
import { TaxCategoryPickerSheet } from './TaxCategoryPickerSheet';

const GENERAL_NAME = 'General - Tangible Goods';
const SEARCH_DEBOUNCE_MS = 250;

export interface ProductTaxCategoryFieldProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Known name from the item so we don’t flash the tax-code id. */
  selectedLabel?: string | null;
}

export function ProductTaxCategoryField({
  value,
  onChange,
  disabled,
  selectedLabel,
}: ProductTaxCategoryFieldProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { codes, loading, search } = useStripeTaxCodes();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedName =
    (picked?.id === value ? picked.name : null) ??
    selectedLabel ??
    codes.find((o) => o.id === value)?.name ??
    (value === STRIPE_TAX_CODE_GENERAL_TANGIBLE ? GENERAL_NAME : value);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const close = () => {
    setVisible(false);
    setQuery('');
    void search();
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(text), SEARCH_DEBOUNCE_MS);
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        variant="labelLarge"
        style={{ color: colors.text.primary, marginBottom: spacing.xxs }}
      >
        {t('items.taxCategory.label', 'Product tax category')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.primary, marginBottom: spacing.xxs }}
      >
        {selectedName}
      </Text>
      <Text
        variant="bodySmall"
        style={{
          color: colors.text.secondary,
          marginBottom: spacing.sm,
        }}
      >
        {t(
          'items.taxCategory.help',
          'Used to calculate sales tax at checkout. Does not affect past orders.'
        )}
      </Text>
      <Button mode="outlined" onPress={() => setVisible(true)} disabled={disabled} compact>
        {t('items.taxCategory.change', 'Change tax category')}
      </Button>
      <TaxCategoryPickerSheet
        visible={visible}
        query={query}
        loading={loading}
        codes={codes}
        value={value}
        onQueryChange={onQueryChange}
        onSelect={(id) => {
          const name = codes.find((o) => o.id === id)?.name;
          if (name) setPicked({ id, name });
          onChange(id);
          close();
        }}
        onClose={close}
      />
    </View>
  );
}
