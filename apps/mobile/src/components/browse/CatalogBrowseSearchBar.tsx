import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../theme';

export interface CatalogBrowseSearchBarProps {
  theme: Theme;
  value: string;
  onChangeText: (text: string) => void;
  /** True while waiting for debounce or catalog fetch for the current query. */
  loading?: boolean;
  placeholder?: string;
}

export const CatalogBrowseSearchBar = memo(function CatalogBrowseSearchBar({
  theme,
  value,
  onChangeText,
  loading = false,
  placeholder,
}: CatalogBrowseSearchBarProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = theme;

  return (
    <Searchbar
      placeholder={
        placeholder ??
        t('public.items.searchPlaceholder', 'Search products, stores...')
      }
      value={value}
      onChangeText={onChangeText}
      onClearIconPress={() => onChangeText('')}
      icon="magnify"
      loading={loading}
      style={[
        styles.search,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.full,
        },
      ]}
      inputStyle={[typography.body1, styles.input]}
      elevation={1}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      enablesReturnKeyAutomatically
    />
  );
});

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
  },
  input: {
    minHeight: 44,
    paddingVertical: 0,
  },
});
