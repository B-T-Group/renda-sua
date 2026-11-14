import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { shadows, type Theme } from '../../theme';

export interface CatalogBrowseSearchBarProps {
  theme: Theme;
  value: string;
  onChangeText: (text: string) => void;
  /** True while waiting for debounce or catalog fetch for the current query. */
  loading?: boolean;
  placeholder?: string;
  /** When set, the bar opens full search instead of filtering the catalog in place. */
  onPress?: () => void;
}

export const CatalogBrowseSearchBar = memo(function CatalogBrowseSearchBar({
  theme,
  value,
  onChangeText,
  loading = false,
  placeholder,
  onPress,
}: CatalogBrowseSearchBarProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = theme;
  const hasValue = value.length > 0;
  const placeholderText =
    placeholder ?? t('public.items.searchPlaceholder', 'Search products, stores...');

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={placeholderText}
        testID="catalog-search-open"
        style={[
          styles.search,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <MaterialCommunityIcons name="magnify" size={22} color={colors.text.secondary} style={styles.leading} />
        <Text numberOfLines={1} style={[typography.body1, styles.input, { color: colors.text.secondary }]}>
          {placeholderText}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.search,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.full,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="magnify"
        size={22}
        color={colors.text.secondary}
        style={styles.leading}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholderText}
        placeholderTextColor={colors.text.secondary}
        style={[typography.body1, styles.input, { color: colors.text.primary }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        enablesReturnKeyAutomatically
        clearButtonMode="never"
        accessibilityRole="search"
      />
      {loading && hasValue ? (
        <ActivityIndicator
          size="small"
          color={colors.text.secondary}
          style={styles.spinner}
        />
      ) : null}
      {hasValue ? (
        <Pressable
          onPress={() => onChangeText('')}
          onPressIn={() => onChangeText('')}
          style={styles.clear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch', 'Clear search')}
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={20}
            color={colors.text.secondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 12,
    ...shadows.sm,
  },
  leading: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    minHeight: 44,
  },
  spinner: {
    marginLeft: 8,
  },
  clear: {
    marginLeft: 8,
    padding: 2,
  },
});
