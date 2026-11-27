import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePageShare } from '../../hooks/usePageShare';
import type { ExportOriginSummary } from '../../services/inventoryItemsApi';
import { exportCountryName, exportCountryOfPlace, exportCountryPlace } from '../../utils/exportCountries';
import { exportsShareUrl } from '../../utils/exportsPublicLink';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';

export type ExportsDirection = 'into' | 'from';

export interface ExportsDirectionSwitchProps {
  direction: ExportsDirection;
  /** Viewer (shopping) market. Never changed by this control. */
  marketCode: string | null;
  /** Origin shown in the From view. */
  originCode: string | null;
  origins: ExportOriginSummary[];
  originsLoading?: boolean;
  /** Items listed for the current origin (From view summary line). */
  total?: number;
  onChangeDirection: (next: ExportsDirection) => void;
  onPickOrigin: (code: string) => void;
}

/**
 * Exports lane: Into [my market] / From [country] switch, origin chip,
 * origin picker sheet (only countries with live exports, with counts) and
 * the public-link share. Picking an origin never changes the shopping market.
 */
export function ExportsDirectionSwitch({
  direction,
  marketCode,
  originCode,
  origins,
  originsLoading,
  total,
  onChangeDirection,
  onPickOrigin,
}: ExportsDirectionSwitchProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { canUseNativeShare, shareNative, copyToClipboard } = usePageShare();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const lang = i18n.language;
  const market = marketCode?.trim().toUpperCase() || null;
  const origin = originCode?.trim().toUpperCase() || market;
  const activeOrigin = origins.find((o) => o.country_code === origin);

  const intoLabel = market
    ? t('exportsOrigin.into', 'Into {{place}}', { place: exportCountryPlace(market, lang) })
    : t('exportsOrigin.intoMyMarket', 'Into my market');
  const fromLabel = origin
    ? t('exportsOrigin.from', 'From {{place}}', { place: exportCountryPlace(origin, lang) })
    : t('exportsOrigin.fromCountry', 'From a country');

  const copyLink = async () => {
    if (!origin) return;
    const ok = await copyToClipboard(exportsShareUrl(origin));
    setSnack(
      ok ? t('exportsOrigin.linkCopied', 'Link copied') : t('common.share.copyError', 'Could not copy link')
    );
  };

  const share = async () => {
    if (!origin) return;
    const url = exportsShareUrl(origin);
    if (canUseNativeShare) {
      const title = t('exportsOrigin.pageTitle', 'Exports from {{place}}', {
        place: exportCountryName(origin, lang),
        ofPlace: exportCountryOfPlace(origin, lang),
      });
      const shared = await shareNative({ url, title });
      if (shared) return;
    }
    await copyLink();
  };

  const segment = (key: ExportsDirection, label: string, icon: string) => {
    const selected = direction === key;
    return (
      <Pressable
        key={key}
        testID={`exports-direction-${key}`}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => onChangeDirection(key)}
        style={[
          styles.segment,
          { borderRadius: 999 },
          selected && { backgroundColor: EXPORT_BRAND_BLUE },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as never}
          size={16}
          color={selected ? '#ffffff' : colors.text.secondary}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.segmentLabel,
            { color: selected ? '#ffffff' : colors.text.primary, fontWeight: selected ? '700' : '500' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const destinationCount = activeOrigin?.destination_codes.length ?? 0;
  const count = typeof total === 'number' ? total : activeOrigin?.item_count ?? 0;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t('exportsOrigin.switchLabel', 'Export direction')}
        style={[styles.switch, { borderColor: colors.divider, backgroundColor: colors.surface }]}
      >
        {segment('into', intoLabel, 'airplane-landing')}
        {segment('from', fromLabel, 'airplane-takeoff')}
      </View>

      {direction === 'from' ? (
        <View style={{ gap: 4 }}>
          <View style={styles.originRow}>
            <Pressable
              testID="exports-origin-chip"
              accessibilityRole="button"
              accessibilityLabel={t('exportsOrigin.pickCountry', 'Choose a country')}
              onPress={() => setPickerOpen(true)}
              style={[styles.originChip, { borderColor: EXPORT_BRAND_BLUE, backgroundColor: colors.primaryTint }]}
            >
              <MaterialCommunityIcons name="airplane-takeoff" size={16} color={EXPORT_BRAND_BLUE} />
              {origin ? (
                <View style={[styles.codeTag, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
                  <Text style={[styles.codeTagText, { color: colors.text.secondary }]}>{origin}</Text>
                </View>
              ) : null}
              <Text style={{ color: EXPORT_BRAND_BLUE, fontWeight: '700', fontSize: 15 }}>
                {origin ? exportCountryName(origin, lang) : t('exportsOrigin.pickCountry', 'Choose a country')}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={EXPORT_BRAND_BLUE} />
            </Pressable>
            <IconButton
              testID="exports-origin-share"
              icon="share-variant-outline"
              mode="outlined"
              size={18}
              disabled={!origin}
              onPress={() => void share()}
              accessibilityLabel={t('exportsOrigin.share', 'Share')}
            />
          </View>
          {origin && activeOrigin ? (
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('exportsOrigin.summary', '{{count}} products · ships to {{markets}} markets', {
                count,
                markets: destinationCount,
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)}>
          <Pressable
            testID="exports-origin-picker"
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: borderRadius.xl,
                borderTopRightRadius: borderRadius.xl,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.divider }]} />
            <Text style={[typography.h4, { color: colors.text.primary }]}>
              {t('exportsOrigin.pickerTitle', 'Exported from')}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 2, marginBottom: spacing.sm }]}>
              {market
                ? t('exportsOrigin.pickerHelp', 'See what each market exports. Your market stays {{place}}.', {
                    place: exportCountryPlace(market, lang),
                  })
                : t('exportsOrigin.pickerHelpNoMarket', 'See what each market exports.')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {originsLoading ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null}
              {!originsLoading && origins.length === 0 ? (
                <Text style={{ color: colors.text.secondary, paddingVertical: spacing.md }}>
                  {t('exportsOrigin.noOrigins', 'No exports yet')}
                </Text>
              ) : null}
              {origins.map((o) => {
                const selected = o.country_code === origin;
                return (
                  <Pressable
                    key={o.country_code}
                    testID={`exports-origin-option-${o.country_code}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      onPickOrigin(o.country_code);
                      setPickerOpen(false);
                    }}
                    style={[styles.option, { borderBottomColor: colors.divider }]}
                  >
                    <View style={[styles.codeTag, { borderColor: colors.divider }]}>
                      <Text style={[styles.codeTagText, { color: colors.text.secondary }]}>{o.country_code}</Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: selected ? '700' : '500',
                        color: selected ? EXPORT_BRAND_BLUE : colors.text.primary,
                      }}
                    >
                      {exportCountryName(o.country_code, lang)}
                    </Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                      {t('exportsOrigin.itemsCount', '{{count}} items', { count: o.item_count })}
                    </Text>
                    <View style={{ width: 24, alignItems: 'flex-end' }}>
                      {selected ? (
                        <MaterialCommunityIcons name="check" size={18} color={EXPORT_BRAND_BLUE} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              testID="exports-copy-public-link"
              accessibilityRole="button"
              disabled={!origin}
              onPress={() => void copyLink()}
              style={[styles.copyBtn, { borderColor: EXPORT_BRAND_BLUE, borderRadius: borderRadius.button }]}
            >
              <MaterialCommunityIcons name="link-variant" size={18} color={EXPORT_BRAND_BLUE} />
              <Text style={{ color: EXPORT_BRAND_BLUE, fontWeight: '700', fontSize: 15 }}>
                {t('exportsOrigin.copyPublicLink', 'Copy public link')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  switch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 8,
  },
  segmentLabel: { fontSize: 14, flexShrink: 1 },
  originRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  originChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  codeTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  codeTagText: { fontSize: 11, fontWeight: '800' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { paddingTop: 10, paddingHorizontal: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copyBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
