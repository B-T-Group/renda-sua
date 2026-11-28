import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { CatalogEmptyIllustration } from '../illustrations/CatalogEmptyIllustration';
import { exportCountryPlace } from '../../utils/exportCountries';

/** Exports lane, From mode: the chosen origin has no live export items. */
export function ExportsFromEmptyState({ originCode }: { originCode: string | null | undefined }) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const place = exportCountryPlace(originCode ?? '', i18n.language);
  return (
    <View style={styles.centerPad} testID="exports-from-empty">
      <CatalogEmptyIllustration />
      <Text style={[typography.subtitle2, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.md }]}>
        {t('exportsOrigin.emptyTitle', 'No exports from {{place}} yet', { place })}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }]}>
        {t(
          'exportsOrigin.emptyFromMarket',
          'No business in {{place}} exports on Rendasua yet. Pick another country.',
          { place }
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerPad: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
});
