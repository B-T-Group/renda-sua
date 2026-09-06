import React, { forwardRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { spacing, borderRadius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { shadows } from '@/theme/shadows';
import { useTheme } from '@/contexts/ThemeContext';

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Design-system search input.
 * - Translated default placeholder (overrideable)
 * - Rounded pill shape (borderRadius.input)
 * - Light background with subtle shadow
 * - Trailing clear button when value is non-empty
 */
export const SearchInput = forwardRef<TextInput, SearchInputProps>(
  ({ onClear, containerStyle, value, placeholder, placeholderTextColor, onFocus, onBlur, ...rest }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const [focused, setFocused] = React.useState(false);

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.primary.main : colors.border,
          },
          containerStyle,
        ]}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={focused ? colors.primary.main : colors.text.secondary}
          style={styles.leadingIcon}
        />
        <TextInput
          ref={ref}
          value={value}
          style={[styles.input, { color: colors.text.primary }]}
          placeholder={placeholder ?? t('common.searchPlaceholder', 'Search products, stores...')}
          placeholderTextColor={placeholderTextColor ?? colors.text.secondary}
          returnKeyType="search"
          clearButtonMode="never"
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {value ? (
          <Pressable
            onPress={onClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.clearSearch', 'Clear search')}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
    );
  },
);

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.input,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    height: 48,
    ...shadows.sm,
  },
  leadingIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  clearButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
});
