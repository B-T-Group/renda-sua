import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarketStates } from '../../hooks/useMarketStates';
import type { MarketStatesCatalog } from '../../services/marketStatesApi';
import type { Market } from '../../types/market';

export interface MarketPickerSheetProps {
  visible: boolean;
  markets: Market[];
  selectedCode: string;
  selectedStateCode: string | null;
  /** ISO-2 code of the GPS/locale-detected country, if known. */
  detectedCountryCode?: string | null;
  /** State detected by GPS/locale, if known. */
  detectedStateCode?: string | null;
  /** Which catalog counts to show in state rows. */
  catalogContext?: MarketStatesCatalog;
  onSelect: (countryCode: string, stateCode: string | null) => void;
  onDismiss: () => void;
}

/**
 * Two-level market picker: choose a country, then optionally narrow to a state.
 * Built on a native Modal (no Dialog.ScrollArea/Actions) per the iOS-border rule.
 * When a country has states with inventory, it shows "All of X" plus each state
 * with its live item count. Section-ready for future sub-market grouping.
 */
export function MarketPickerSheet({
  visible,
  markets,
  selectedCode,
  selectedStateCode,
  detectedCountryCode,
  detectedStateCode,
  catalogContext = 'inventory',
  onSelect,
  onDismiss,
}: MarketPickerSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // The country whose states are currently being browsed.
  const [expandedCountry, setExpandedCountry] = useState<string | null>(
    () => selectedCode ?? null
  );

  const { states, totalItemCount, loading: statesLoading } = useMarketStates(
    expandedCountry,
    visible,
    catalogContext
  );

  // Whether the detected location differs from the current selection.
  const detectedDiffers =
    !!detectedCountryCode &&
    (detectedCountryCode !== selectedCode ||
      (detectedStateCode ?? null) !== selectedStateCode);

  // The detected market object (for display in the banner).
  const detectedMarket = detectedCountryCode
    ? markets.find((m) => m.countryCode === detectedCountryCode) ?? null
    : null;

  const handleCountryPress = useCallback((countryCode: string) => {
    setExpandedCountry((prev) => (prev === countryCode ? null : countryCode));
  }, []);

  const handleSelect = useCallback(
    (countryCode: string, stateCode: string | null) => {
      onSelect(countryCode, stateCode);
    },
    [onSelect]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: insets.bottom + spacing.md,
              maxHeight: screenHeight * 0.85,
              width: Math.min(screenWidth - spacing.lg * 2, 400),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.header,
              {
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                paddingBottom: spacing.sm,
              },
            ]}
          >
            <Text variant="titleMedium" style={{ color: colors.text.primary, flex: 1 }}>
              {t('market.picker.title', 'Select Marketplace')}
            </Text>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
          </View>

          {/* Your location banner — shown when detected market differs from selection */}
          {detectedDiffers && detectedMarket && (
            <Pressable
              onPress={() =>
                onSelect(detectedMarket.countryCode, detectedStateCode ?? null)
              }
              style={[
                styles.locationBanner,
                {
                  backgroundColor: colors.warning.main + '18',
                  borderColor: colors.warning.main + '55',
                  marginHorizontal: spacing.md,
                  marginBottom: spacing.sm,
                  borderRadius: borderRadius.md,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  gap: spacing.xs,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={15}
                color={colors.warning.dark}
              />
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={{ color: colors.warning.dark, flex: 1 }}
              >
                {detectedStateCode
                  ? t(
                      'market.picker.detectedLocation',
                      'Your location: {{state}}, {{country}}',
                      {
                        state: detectedStateCode,
                        country: detectedMarket.name,
                      }
                    )
                  : t(
                      'market.picker.detectedCountry',
                      'Your location: {{country}}',
                      { country: detectedMarket.name }
                    )}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: colors.warning.dark, fontWeight: '600' }}
              >
                {t('market.picker.switchHere', 'Switch')}
              </Text>
            </Pressable>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.sm,
            }}
            showsVerticalScrollIndicator={false}
          >
            {markets.length === 0 ? (
              <View style={[styles.loader, { paddingVertical: spacing.lg }]}>
                <ActivityIndicator color={colors.primary.main} />
              </View>
            ) : (
              markets.map((market) => {
                const isExpanded = expandedCountry === market.countryCode;
                const isCountrySelected =
                  market.countryCode === selectedCode && selectedStateCode === null;
                const isDetectedCountry =
                  !!detectedCountryCode &&
                  market.countryCode === detectedCountryCode;

                return (
                  <View key={market.id}>
                    {/* Country row */}
                    <Pressable
                      onPress={() => handleCountryPress(market.countryCode)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.row,
                        {
                          backgroundColor: pressed
                            ? colors.pageBackground
                            : 'transparent',
                          borderRadius: borderRadius.md,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.sm,
                          marginBottom: spacing.xs / 2,
                          gap: spacing.sm,
                        },
                      ]}
                    >
                      <Text style={styles.flag}>{market.flag}</Text>
                      <View style={styles.rowText}>
                        <View style={styles.nameRow}>
                          <Text
                            variant="bodyLarge"
                            style={{
                              color: isCountrySelected
                                ? colors.primary.main
                                : colors.text.primary,
                              fontWeight: isCountrySelected ? '700' : '400',
                            }}
                          >
                            {market.name}
                          </Text>
                          {isDetectedCountry && (
                            <View
                              style={[
                                styles.gpsBadge,
                                {
                                  backgroundColor: colors.warning.main + '22',
                                  borderColor: colors.warning.main + '66',
                                  borderRadius: borderRadius.full,
                                  paddingHorizontal: 5,
                                  paddingVertical: 1,
                                  gap: 3,
                                },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="crosshairs-gps"
                                size={10}
                                color={colors.warning.dark}
                              />
                              <Text
                                variant="labelSmall"
                                style={{
                                  color: colors.warning.dark,
                                  fontSize: 10,
                                }}
                              >
                                {t('market.picker.yourLocation', 'You are here')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          variant="bodySmall"
                          style={{ color: colors.text.secondary }}
                        >
                          {market.currency}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        {isCountrySelected && (
                          <MaterialCommunityIcons
                            name="check"
                            size={18}
                            color={colors.primary.main}
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <MaterialCommunityIcons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.text.secondary}
                        />
                      </View>
                    </Pressable>

                    {/* State sub-rows */}
                    {isExpanded && (
                      <View
                        style={[
                          styles.stateSection,
                          {
                            marginLeft: spacing.lg,
                            marginBottom: spacing.xs,
                            borderLeftColor: colors.divider,
                          },
                        ]}
                      >
                        {statesLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary.main}
                            style={{ marginVertical: spacing.sm }}
                          />
                        ) : (
                          <>
                            {/* "All of X" row */}
                            <StateRow
                              label={t('market.picker.allStates', 'All of {{name}}', {
                                name: market.name,
                              })}
                              itemCount={totalItemCount}
                              isSelected={
                                market.countryCode === selectedCode &&
                                selectedStateCode === null
                              }
                              isDetected={
                                isDetectedCountry &&
                                (detectedStateCode == null || detectedStateCode === '')
                              }
                              onPress={() =>
                                handleSelect(market.countryCode, null)
                              }
                              colors={colors}
                              spacing={spacing}
                              borderRadius={borderRadius}
                            />
                            {states.map((s) => (
                              <StateRow
                                key={s.state}
                                label={s.state}
                                itemCount={s.itemCount}
                                isSelected={
                                  market.countryCode === selectedCode &&
                                  selectedStateCode === s.state
                                }
                                isDetected={
                                  isDetectedCountry &&
                                  detectedStateCode === s.state
                                }
                                onPress={() =>
                                  handleSelect(market.countryCode, s.state)
                                }
                                colors={colors}
                                spacing={spacing}
                                borderRadius={borderRadius}
                              />
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StateRow({
  label,
  itemCount,
  isSelected,
  isDetected,
  onPress,
  colors,
  spacing,
  borderRadius,
}: {
  label: string;
  itemCount: number;
  isSelected: boolean;
  isDetected: boolean;
  onPress: () => void;
  colors: any;
  spacing: any;
  borderRadius: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? colors.pageBackground : 'transparent',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        marginBottom: 2,
        gap: spacing.sm,
      })}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          style={{
            color: isSelected ? colors.primary.main : colors.text.primary,
            fontWeight: isSelected ? '600' : '400',
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {isDetected && (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={13}
            color={colors.warning.dark}
          />
        )}
      </View>
      <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
        {itemCount}
      </Text>
      {isSelected ? (
        <MaterialCommunityIcons
          name="check"
          size={16}
          color={colors.primary.main}
        />
      ) : (
        <View style={{ width: 16 }} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { width: '100%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center' },
  locationBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  list: { flexGrow: 0 },
  loader: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flag: { fontSize: 24, width: 32, textAlign: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  stateSection: { borderLeftWidth: 2, paddingLeft: 8 },
});
