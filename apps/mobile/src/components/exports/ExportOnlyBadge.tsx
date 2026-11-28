import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/** Brand blue used for every export badge and the primary export CTA. */
export const EXPORT_BRAND_BLUE = '#0A4FB5';

export interface ExportOnlyBadgeProps {
  /** overlay: on the image, bottom-left. inline: under the PDP title. */
  variant?: 'overlay' | 'inline';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Plane icon + "Export only" / "Export uniquement". */
export function ExportOnlyBadge({ variant = 'overlay', compact, style }: ExportOnlyBadgeProps) {
  const { t } = useTranslation();
  const label = t('exportItem.badge', 'Export only');
  return (
    <View
      testID="export-only-badge"
      accessibilityLabel={label}
      style={[
        styles.badge,
        variant === 'overlay' ? styles.overlay : styles.inline,
        compact && styles.compact,
        style,
      ]}
    >
      <MaterialCommunityIcons name="airplane-takeoff" size={compact ? 11 : 13} color="#ffffff" />
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: EXPORT_BRAND_BLUE,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  overlay: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    zIndex: 2,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 10.5,
  },
});
