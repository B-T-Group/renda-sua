import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPickupPhotoRules } from '../../../services/rentalInspectionApi';
import { groupBlockedRows, otherReasonReady } from '../../../utils/rentals/blockedGuideRows';
import { formatListingDay, listingCity } from '../../../utils/rentals/pickupPhotoTime';
import type { PickupPhotoRules } from '../../../utils/rentals/rentalInspection';

export function CalendarArt() {
  const { colors } = useTheme();
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke={colors.cta.main} strokeWidth="2" />
      <Path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke={colors.cta.main} strokeWidth="2" />
    </Svg>
  );
}

export function CameraArt({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="13" r="3" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function CameraOffArt({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" accessibilityLabel={label}>
      <Rect x="16" y="26" width="34" height="24" rx="4" fill={colors.cta.soft} stroke={colors.cta.main} strokeWidth="2" />
      <Circle cx="33" cy="38" r="6" fill="none" stroke={colors.cta.main} strokeWidth="2" />
      <Path d="M50 32l8-5v18l-8-5z" fill={colors.cta.main} />
      <Path d="M18 54L54 18" stroke={colors.warning.dark} strokeWidth="3" />
    </Svg>
  );
}

export function PickupGuideStart({
  rules,
  busy,
  onChoose,
  showTitle = true,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  onChoose: (mode: 'guide' | 'blank') => void;
  showTitle?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const guide = rules.guide;
  if (!guide) return null;
  const date = formatListingDay(guide.submittedAt, rules.timezone, i18n.language);
  return (
    <View style={{ gap: spacing.md }}>
      {showTitle ? <Text style={[typography.h5, { color: colors.text.primary }]}>{t('rentalInspection.pickupPhotosTitle', 'Pickup photos')}</Text> : null}
      <View style={[styles.card, { borderColor: colors.cta.main, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm }]}>
        <Text style={[typography.subtitle1, { color: colors.text.primary }]}>{t('rentalInspection.startFromLast', 'Start from last report')}</Text>
        <Text style={{ color: colors.text.secondary }}>
          {t('rentalInspection.lastReturnSummary', 'Last return · {{date}} · {{photos}} photos · {{checks}} checks', {
            date,
            photos: guide.photoCount,
            checks: guide.checkCount,
          })}
        </Text>
        <Text style={{ color: colors.text.primary }}>
          {rules.pickupDay
            ? t('rentalInspection.guideOnlyNote', 'The last return photos are a guide only. You must retake every photo today, ideally with the renter there.')
            : t('rentalInspection.guideOnlyNoteLater', 'The last return photos are a guide only. You must retake every photo on pickup day, ideally with the renter there.')}
        </Text>
        <Button mode="contained" buttonColor={colors.cta.main} disabled={busy} onPress={() => onChoose('guide')}>
          {t('rentalInspection.useAsGuide', 'Use as guide')}
        </Button>
        <Button mode="outlined" disabled={busy} onPress={() => onChoose('blank')}>
          {t('rentalInspection.startBlank', 'Start blank')}
        </Button>
      </View>
    </View>
  );
}

export function PickupCameraDenied({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: colors.pageBackground, padding: spacing.lg, gap: spacing.md }]}>
      <CameraOffArt label={t('rentalInspection.enableCamera', 'Enable the camera')} />
      <Text style={[typography.h5, { color: colors.text.primary }]}>{t('rentalInspection.enableCamera', 'Enable the camera')}</Text>
      <Text style={{ color: colors.text.primary }}>
        {t('rentalInspection.cameraDeniedBody', 'Pickup photos have to be taken in the app. Turn on the camera in Settings. The photo library stays off.')}
      </Text>
      <Button mode="contained" buttonColor={colors.cta.main} onPress={() => void Linking.openSettings()}>
        {t('rentalInspection.openSettings', 'Open Settings')}
      </Button>
      <Button mode="text" onPress={onClose}>{t('common.cancel', 'Cancel')}</Button>
    </View>
  );
}

export interface BlockedAngleRow {
  unitId: string;
  slotKey: string;
  label: string;
  thumbUri?: string | null;
  action: 'retake' | 'skip';
  reason?: string | null;
}

export function PickupSubmitBlocked({
  rows,
  date,
  left,
  onRetake,
  onSkip,
}: {
  rows: BlockedAngleRow[];
  date: string;
  left: number;
  onRetake: (row: BlockedAngleRow) => void;
  onSkip: (row: BlockedAngleRow, reason: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const [skipKey, setSkipKey] = useState<string | null>(null);
  const grouped = groupBlockedRows(rows);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md }}>
      <Text style={[typography.h5, { color: colors.text.primary }]}>{t('rentalInspection.cantSendYet', "Can't send yet")}</Text>
      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
        {t('rentalInspection.retakeOrSkip', 'Retake or skip the missing angles')}
      </Text>
      <Text style={{ color: colors.text.secondary }}>
        {t('rentalInspection.missingAngles', '{{count}} angles from the {{date}} guide are still missing.', {
          count: grouped.open.length,
          date,
        })}
      </Text>
      {grouped.open.map((row) => (
        <BlockedAngle
          key={`${row.unitId}-${row.slotKey}`}
          row={row}
          open={skipKey === row.slotKey}
          onRetake={() => onRetake(row)}
          onAskSkip={() => setSkipKey(row.slotKey)}
          onSkip={(reason) => onSkip(row, reason)}
        />
      ))}
      {grouped.skipped.length ? (
        <Text style={[typography.subtitle1, { color: colors.text.primary }]}>{t('rentalInspection.skippedHeading', 'Skipped')}</Text>
      ) : null}
      {grouped.skipped.map((row) => (
        <BlockedAngle
          key={`${row.unitId}-${row.slotKey}`}
          row={row}
          open={skipKey === row.slotKey}
          onRetake={() => onRetake(row)}
          onAskSkip={() => setSkipKey(row.slotKey)}
          onSkip={(reason) => onSkip(row, reason)}
        />
      ))}
      <Button mode="contained" disabled>
        {t('rentalInspection.submitLeft', 'Submit report · {{count}} left', { count: left })}
      </Button>
    </View>
  );
}

function BlockedAngle({
  row,
  open,
  onRetake,
  onAskSkip,
  onSkip,
}: {
  row: BlockedAngleRow;
  open: boolean;
  onRetake: () => void;
  onAskSkip: () => void;
  onSkip: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border ?? '#E6E1D8' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {row.thumbUri ? (
          <Image source={{ uri: row.thumbUri }} style={{ width: 48, height: 48, borderRadius: borderRadius.md, opacity: 0.35 }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.surface }} />
        )}
        <Text numberOfLines={2} style={{ flex: 1, color: colors.text.primary }}>{row.label}</Text>
        {row.reason ? (
          <Pressable accessibilityRole="button" onPress={onAskSkip}>
            <Text numberOfLines={1} style={{ color: colors.cta.main, fontWeight: '700' }}>{t('rentalInspection.changeSkip', 'Change')}</Text>
          </Pressable>
        ) : row.action === 'skip' ? (
          <Pressable accessibilityRole="button" onPress={onAskSkip}>
            <Text numberOfLines={1} style={{ color: colors.cta.main, fontWeight: '700' }}>{t('rentalInspection.skipShort', 'Skip')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={row.label} onPress={onRetake} style={[styles.cam, { backgroundColor: colors.cta.main }]}>
          <CameraArt />
        </Pressable>
      </View>
      {row.reason ? <Text style={{ color: colors.text.secondary }}>{row.reason}</Text> : null}
      {open ? <SkipReasonField onSave={onSkip} /> : null}
    </View>
  );
}

export function ChecklistTag({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onConfirm} style={[styles.tag, { borderColor: colors.warning.main, borderRadius: borderRadius.lg }]}>
      <Text style={{ color: colors.warning.dark }}>{label}</Text>
      <Text style={{ color: colors.cta.main }}>{t('rentalInspection.confirmField', 'Confirm')}</Text>
    </Pressable>
  );
}

export function PickupDayCallout({ bookingId, onOpen }: { bookingId: string; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const [rules, setRules] = useState<PickupPhotoRules | null>(null);
  useEffect(() => {
    let live = true;
    void getPickupPhotoRules(bookingId).then((row) => {
      if (live) setRules(row);
    }).catch(() => {
      if (live) setRules(null);
    });
    return () => {
      live = false;
    };
  }, [bookingId]);
  if (!rules?.enabled) {
    return (
      <Button mode="contained" buttonColor={colors.cta.main} style={{ minHeight: 48 }} onPress={onOpen}>
        {t('rentalInspection.pickupTitle', 'Pickup condition')}
      </Button>
    );
  }
  const day = rules.startAt ? formatListingDay(rules.startAt, rules.timezone, i18n.language) : '';
  const city = listingCity(rules.timezone);
  const early = !rules.pickupDay;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        {early ? <CalendarArt /> : <CameraArt color={colors.cta.main} />}
        <Text style={[typography.subtitle1, { color: colors.text.primary, flex: 1 }]}>
          {early
            ? t('rentalInspection.earlyPrepareBody', 'Photos are taken on pickup day, {{date}} ({{city}} time). You can prepare the checklist now.', { date: day, city })
            : t('rentalInspection.pickupTodayBody', 'Pickup today: take the condition photos, ideally with the renter.')}
        </Text>
      </View>
      {!early && rules.guide && !rules.guideMode ? <PickupGuideStart rules={rules} busy={false} showTitle={false} onChoose={() => onOpen()} /> : null}
      <Button mode="contained" buttonColor={colors.cta.main} style={{ minHeight: 48 }} onPress={onOpen}>
        {early
          ? t('rentalInspection.prepareChecklist', 'Prepare checklist')
          : t('rentalInspection.takePickupPhotos', 'Take pickup photos')}
      </Button>
    </View>
  );
}

const SKIP_PRESETS = [
  ['rentalInspection.skipNotOnUnit', 'Not on this unit'],
  ['rentalInspection.skipAccessory', 'Accessory not included'],
  ['rentalInspection.skipCantReach', "Can't reach this angle"],
] as const;

export function SkipReasonField({ onSave }: { onSave: (reason: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [other, setOther] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <View style={{ gap: 8 }}>
      {SKIP_PRESETS.map(([key, fallback]) => (
        <Button key={key} mode="outlined" onPress={() => onSave(t(key, fallback))}>{t(key, fallback)}</Button>
      ))}
      <Button mode="text" onPress={() => setOther(true)}>{t('rentalInspection.skipOther', 'Other')}</Button>
      {other ? (
        <>
          <TextInput mode="outlined" label={t('rentalInspection.skipReason', 'Reason')} value={reason} onChangeText={setReason} maxLength={280} />
          <Button mode="outlined" disabled={!otherReasonReady(reason)} buttonColor={colors.surface} onPress={() => onSave(reason.trim())}>
            {t('rentalInspection.skipSave', 'Save reason')}
          </Button>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  fill: { flex: 1 },
  tag: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', gap: 8, alignSelf: 'flex-start' },
  cam: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
