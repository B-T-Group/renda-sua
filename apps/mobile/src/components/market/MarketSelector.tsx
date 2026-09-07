import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarket } from '../../hooks/useMarket';
import type { MarketStatesCatalog } from '../../services/marketStatesApi';
import { MarketPickerSheet } from './MarketPickerSheet';

/**
 * Compact tappable pill that shows the active market flag + name · state (or All).
 * A small accent dot appears when the device's detected location differs from the
 * current selection (different country or different state within the same country),
 * nudging the user to tap and review without interrupting them.
 */
export const MarketSelector = observer(function MarketSelector({
  catalogContext = 'inventory',
}: {
  catalogContext?: MarketStatesCatalog;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const {
    selectedMarket,
    markets,
    setMarket,
    detectedCountryCode,
    detectedStateCode,
  } = useMarket();  const [pickerVisible, setPickerVisible] = useState(false);

  const handleSelect = useCallback(
    async (countryCode: string, stateCode: string | null) => {
      setPickerVisible(false);
      await setMarket(countryCode, stateCode);
    },
    [setMarket]
  );

  if (!selectedMarket) return null;

  const stateLabel = selectedMarket.stateCode
    ? selectedMarket.stateName ?? selectedMarket.stateCode
    : t('market.selector.allStates', 'All');

  // Show dot when detection has run and something differs from current selection.
  const countryMismatch =
    !!detectedCountryCode &&
    detectedCountryCode !== selectedMarket.countryCode;
  const stateMismatch =
    !countryMismatch &&
    !!detectedCountryCode &&
    detectedCountryCode === selectedMarket.countryCode &&
    detectedStateCode !== selectedMarket.stateCode;
  const showDot = countryMismatch || stateMismatch;

  return (
    <>
      <Pressable
        onPress={() => setPickerVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('market.selector.label', 'Selected market: {{name}}', {
          name: selectedMarket.name,
        })}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: pressed
              ? colors.surface
              : colors.surface + 'CC',
            borderColor: showDot ? colors.warning.main : colors.divider,
            borderRadius: borderRadius.full,
            paddingVertical: spacing.xs / 2,
            paddingHorizontal: spacing.sm,
            gap: spacing.xs,
          },
        ]}
      >
        <Text style={styles.flag}>{selectedMarket.flag}</Text>
        <Text
          variant="labelMedium"
          numberOfLines={1}
          style={{ color: colors.text.primary, flexShrink: 1 }}
        >
          {selectedMarket.name}
          <Text style={{ color: colors.text.secondary }}>{' · '}{stateLabel}</Text>
        </Text>
        {showDot && (
          <View
            style={[styles.dot, { backgroundColor: colors.warning.main }]}
            accessibilityLabel={t(
              'market.selector.locationMismatch',
              'Detected location differs from selected market'
            )}
          />
        )}
        <View style={styles.chevronWrap}>
          <Text style={{ color: colors.text.secondary, fontSize: 10 }}>▾</Text>
        </View>
      </Pressable>

      <MarketPickerSheet
        visible={pickerVisible}
        markets={markets}
        selectedCode={selectedMarket.countryCode}
        selectedStateCode={selectedMarket.stateCode}
        detectedCountryCode={detectedCountryCode}
        detectedStateCode={detectedStateCode}
        catalogContext={catalogContext}
        onSelect={handleSelect}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  flag: { fontSize: 16 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chevronWrap: { alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
});
