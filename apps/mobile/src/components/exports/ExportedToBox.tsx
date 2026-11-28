import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { exportCountryName } from '../../utils/exportCountries';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';

export interface ExportedToBoxProps {
  destinations: string[];
  marketCode?: string | null;
}

/** PDP "Exported to" box: export-only sentence + destination chips (viewer market highlighted). */
export function ExportedToBox({ destinations, marketCode }: ExportedToBoxProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const market = marketCode?.trim().toUpperCase() ?? '';
  return (
    <View
      testID="exported-to-box"
      style={[
        styles.box,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="earth" size={18} color={EXPORT_BRAND_BLUE} />
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {t('exportItem.exportedTo', 'Exported to')}
        </Text>
      </View>
      <Text style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 18 }}>
        {t(
          'exportItem.soldForExportOnly',
          'This item is sold for export only. It can’t be bought in the app.'
        )}
      </Text>
      <View style={styles.chips}>
        {destinations.map((code) => {
          const mine = code === market;
          const name = exportCountryName(code, i18n.language);
          const label = mine ? `${name} · ${t('exportItem.yourMarket', 'Your market')}` : name;
          return (
            <View
              key={code}
              accessibilityLabel={label}
              style={[
                styles.chip,
                mine
                  ? { backgroundColor: EXPORT_BRAND_BLUE, borderColor: EXPORT_BRAND_BLUE }
                  : { borderColor: colors.divider, backgroundColor: colors.pageBackground },
              ]}
            >
              {mine ? <MaterialCommunityIcons name="check" size={13} color="#ffffff" /> : null}
              <Text style={[styles.chipCode, { color: mine ? '#ffffff' : colors.text.primary }]}>
                {code}
              </Text>
              <Text
                style={[styles.chipName, { color: mine ? '#ffffff' : colors.text.secondary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipCode: { fontSize: 12, fontWeight: '800' },
  chipName: { fontSize: 12 },
});
