import React, { forwardRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput as RNTextInput,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';

export interface AppTextInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helper?: string;
  error?: string;
  /** Leading icon */
  leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Trailing icon (e.g. clear button, toggle) */
  trailingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onTrailingIconPress?: () => void;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Standardized text input following the design system.
 */
export const AppTextInput = forwardRef<RNTextInput, AppTextInputProps>(
  (
    {
      label,
      helper,
      error,
      leadingIcon,
      trailingIcon,
      onTrailingIconPress,
      disabled,
      containerStyle,
      ...rest
    },
    ref,
  ) => {
    const { colors, spacing, borderRadius, typography } = useTheme();
    const [focused, setFocused] = React.useState(false);

    const borderColor = error
      ? colors.error.main
      : focused
        ? colors.primary.main
        : colors.border;

    return (
      <View style={[{ gap: spacing.xxs }, containerStyle]}>
        {label ? (
          <Text
            style={[
              typography.caption,
              {
                color: colors.text.secondary,
                marginBottom: spacing.xxs,
                fontWeight: '600',
              },
            ]}
          >
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.inputContainer,
            {
              borderColor,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.input,
              paddingHorizontal: spacing.md,
            },
            disabled && {
              backgroundColor: colors.pageBackground,
              borderColor: colors.disabled,
            },
          ]}
        >
          {leadingIcon ? (
            <MaterialCommunityIcons
              name={leadingIcon}
              size={20}
              color={focused ? colors.primary.main : colors.text.secondary}
              style={{ marginRight: spacing.xs }}
            />
          ) : null}
          <RNTextInput
            ref={ref}
            style={[
              typography.body,
              {
                flex: 1,
                color: colors.text.primary,
                paddingVertical: 0,
              },
              leadingIcon ? { marginLeft: spacing.xs } : null,
            ]}
            placeholderTextColor={colors.text.secondary}
            editable={!disabled}
            onFocus={e => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            {...rest}
          />
          {trailingIcon ? (
            <MaterialCommunityIcons
              name={trailingIcon}
              size={20}
              color={colors.text.secondary}
              style={{ marginLeft: spacing.xs }}
              onPress={onTrailingIconPress}
            />
          ) : null}
        </View>
        {error ? (
          <Text style={[typography.caption, { color: colors.error.main }]}>{error}</Text>
        ) : helper ? (
          <Text style={[typography.caption, { color: colors.text.secondary }]}>{helper}</Text>
        ) : null}
      </View>
    );
  },
);

AppTextInput.displayName = 'AppTextInput';

/**
 * Multiline textarea input.
 */
export function TextareaInput({
  label,
  helper,
  error,
  disabled,
  containerStyle,
  ...rest
}: AppTextInputProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [focused, setFocused] = React.useState(false);

  const borderColor = error
    ? colors.error.main
    : focused
      ? colors.primary.main
      : colors.border;

  return (
    <View style={[{ gap: spacing.xxs }, containerStyle]}>
      {label ? (
        <Text
          style={[
            typography.caption,
            {
              color: colors.text.secondary,
              marginBottom: spacing.xxs,
              fontWeight: '600',
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          styles.textareaContainer,
          {
            borderColor,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.input,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
          disabled && {
            backgroundColor: colors.pageBackground,
            borderColor: colors.disabled,
          },
        ]}
      >
        <RNTextInput
          multiline
          textAlignVertical="top"
          style={[
            typography.body,
            {
              flex: 1,
              color: colors.text.primary,
              minHeight: 80,
              paddingTop: 0,
            },
          ]}
          placeholderTextColor={colors.text.secondary}
          editable={!disabled}
          onFocus={e => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={[typography.caption, { color: colors.error.main }]}>{error}</Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 52,
  },
  textareaContainer: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
});
