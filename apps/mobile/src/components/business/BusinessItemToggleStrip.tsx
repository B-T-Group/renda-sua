import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { IconButton, Switch, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type ToggleKey = 'listing' | 'delivery' | 'pickup';

export interface BusinessItemToggleStripProps {
  listingActive: boolean;
  payOnDelivery: boolean;
  payAtPickup: boolean;
  disabled?: boolean;
  /** Hide Active listing toggle until item is moderation-approved. */
  showListingToggle?: boolean;
  /** Hide pay-at-delivery on Stripe rails (not available). */
  showPayOnDelivery?: boolean;
  onToggleListing: (value: boolean) => void;
  onTogglePayOnDelivery: (value: boolean) => void;
  onTogglePayAtPickup: (value: boolean) => void;
  onEdit?: () => void;
  /** Card with section title (list). Inline = full-width stacked rows for mobile. */
  variant?: 'card' | 'inline';
}

type ToggleConfig = {
  key: ToggleKey;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

const TWO_COL_MIN_WIDTH = 400;

export function BusinessItemToggleStrip({
  listingActive,
  payOnDelivery,
  payAtPickup,
  disabled,
  showListingToggle = true,
  showPayOnDelivery = true,
  onToggleListing,
  onTogglePayOnDelivery,
  onTogglePayAtPickup,
  onEdit,
  variant = 'card',
}: BusinessItemToggleStripProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { width } = useWindowDimensions();
  const twoColumn = width >= TWO_COL_MIN_WIDTH;

  const toggles: ToggleConfig[] = [
    ...(showListingToggle
      ? [
          {
            key: 'listing' as const,
            icon: 'store-check' as const,
            label: t('business.items.listingActiveShort', 'Active listing'),
            value: listingActive,
            onChange: onToggleListing,
          },
        ]
      : []),
    ...(showPayOnDelivery
      ? [
          {
            key: 'delivery' as const,
            icon: 'truck-delivery-outline' as const,
            label: t('business.items.payOnDeliveryShort', 'Pay at delivery'),
            value: payOnDelivery,
            onChange: onTogglePayOnDelivery,
          },
        ]
      : []),
    {
      key: 'pickup',
      icon: 'store-marker-outline',
      label: t('business.items.payAtPickupShort', 'Store pickup'),
      value: payAtPickup,
      onChange: onTogglePayAtPickup,
    },
  ];

  if (variant === 'inline') {
    return (
      <View
        style={[
          styles.stackedWrap,
          {
            backgroundColor: `${colors.primary.main}06`,
            borderColor: colors.divider,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        {toggles.map((toggle, index) => (
          <Pressable
            key={toggle.key}
            onPress={() => !disabled && toggle.onChange(!toggle.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.stackedRow,
              index < toggles.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.divider,
              },
              pressed && !disabled && { opacity: 0.7 },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: toggle.value, disabled }}
            accessibilityLabel={toggle.label}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: toggle.value ? `${colors.primary.main}18` : colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={toggle.icon}
                size={18}
                color={toggle.value ? colors.primary.main : colors.text.secondary}
              />
            </View>
            <Text
              variant="bodyMedium"
              style={[styles.stackedLabel, { color: colors.text.primary }]}
              numberOfLines={2}
            >
              {toggle.label}
            </Text>
            <Switch
              value={toggle.value}
              onValueChange={(v) => void toggle.onChange(v)}
              disabled={disabled}
              color={colors.primary.main}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${colors.primary.main}08`,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          marginBottom: spacing.sm,
        },
      ]}
      onStartShouldSetResponder={() => true}
    >
      <View style={styles.titleRow}>
        <Text
          variant="labelSmall"
          style={[styles.sectionTitle, { color: colors.text.secondary, flex: 1 }]}
        >
          {t('business.items.sellingOptions', 'Selling options')}
        </Text>
        {onEdit ? (
          <IconButton
            icon="pencil-outline"
            size={20}
            iconColor={colors.primary.main}
            onPress={onEdit}
            style={styles.editBtn}
            accessibilityLabel={t('business.items.editItem', 'Edit item')}
          />
        ) : null}
      </View>
      <View style={[styles.grid, twoColumn && styles.gridTwoCol]}>
        {toggles.map((toggle, index) => (
          <View
            key={toggle.key}
            style={[
              styles.row,
              twoColumn && toggle.key !== 'pickup' && styles.rowHalf,
              twoColumn && toggle.key === 'pickup' && styles.rowFull,
              index < toggles.length - 1 &&
                !twoColumn && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.divider,
                },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: toggle.value ? `${colors.primary.main}18` : colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={toggle.icon}
                size={18}
                color={toggle.value ? colors.primary.main : colors.text.secondary}
              />
            </View>
            <Text
              variant="bodySmall"
              style={[styles.label, { color: colors.text.primary }]}
              numberOfLines={2}
            >
              {toggle.label}
            </Text>
            <Switch
              value={toggle.value}
              onValueChange={(v) => void toggle.onChange(v)}
              disabled={disabled}
              color={colors.primary.main}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stackedWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stackedLabel: {
    flex: 1,
    marginHorizontal: 10,
    lineHeight: 20,
  },
  container: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  editBtn: { margin: -8 },
  grid: {
    gap: 0,
  },
  gridTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 4,
  },
  rowHalf: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  rowFull: {
    width: '100%',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    marginHorizontal: 8,
    lineHeight: 18,
  },
});
