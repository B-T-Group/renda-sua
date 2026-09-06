import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';

export interface SelectionCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  leadingElement?: React.ReactNode;
  trailingElement?: React.ReactNode;
  /** Renders a radio indicator instead of a check indicator */
  radioMode?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Tappable card for selecting one item from a list: address, delivery slot,
 * payment method, etc.
 */
export function SelectionCard({
  title,
  subtitle,
  description,
  isSelected = false,
  isDisabled = false,
  onPress,
  leadingIcon,
  leadingElement,
  trailingElement,
  radioMode = false,
  style,
  accessibilityLabel,
}: SelectionCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          borderColor: colors.border,
          padding: spacing.md,
          gap: spacing.sm,
        },
        isSelected && {
          borderColor: colors.primary.main,
          backgroundColor: colors.primary.hover,
        },
        isDisabled && {
          borderColor: colors.disabled,
          backgroundColor: colors.pageBackground,
        },
        pressed && !isDisabled && styles.cardPressed,
        style,
      ]}
    >
      {leadingElement ??
        (leadingIcon ? (
          <View
            style={[
              styles.leadingIcon,
              {
                borderRadius: borderRadius.icon,
                backgroundColor: colors.pageBackground,
              },
              isSelected && { backgroundColor: colors.primaryTint },
              isDisabled && { backgroundColor: colors.disabled },
            ]}
          >
            <MaterialCommunityIcons
              name={leadingIcon}
              size={20}
              color={
                isDisabled
                  ? colors.disabledText
                  : isSelected
                    ? colors.primary.main
                    : colors.text.secondary
              }
            />
          </View>
        ) : null)}

      <View style={styles.body}>
        <Text
          style={[
            typography.subheading,
            {
              color: isDisabled
                ? colors.disabledText
                : isSelected
                  ? colors.primary.dark
                  : colors.text.primary,
              fontWeight: isSelected ? '600' : '500',
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              typography.caption,
              { color: isDisabled ? colors.disabledText : colors.text.secondary },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text
            style={[
              typography.caption,
              {
                color: isDisabled ? colors.disabledText : colors.text.secondary,
                marginTop: 2,
              },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {trailingElement ?? (
        <View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 1.5,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            },
            isSelected &&
              (radioMode
                ? { borderColor: colors.primary.main }
                : {
                    backgroundColor: colors.primary.main,
                    borderColor: colors.primary.main,
                  }),
            isDisabled && {
              borderColor: colors.disabled,
              backgroundColor: colors.disabled,
            },
          ]}
        >
          {isSelected && !radioMode ? (
            <MaterialCommunityIcons name="check" size={14} color={colors.primary.contrast} />
          ) : null}
          {isSelected && radioMode ? (
            <View
              style={{
                width: 11,
                height: 11,
                borderRadius: 6,
                backgroundColor: colors.primary.main,
              }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 64,
  },
  cardPressed: {
    opacity: 0.85,
  },
  leadingIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
