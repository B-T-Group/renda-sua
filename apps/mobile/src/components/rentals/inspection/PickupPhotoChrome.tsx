import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPickupPhotoRules } from '../../../services/rentalInspectionApi';
import { formatListingDay, formatListingStamp } from '../../../utils/rentals/pickupPhotoTime';
import type { PickupPhotoRules } from '../../../utils/rentals/rentalInspection';

export function CameraLockArt({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" accessibilityLabel={label}>
      <Rect x="14" y="28" width="44" height="30" rx="6" fill={colors.cta.soft} stroke={colors.cta.main} strokeWidth="2" />
      <Circle cx="36" cy="43" r="6" fill={colors.cta.main} />
      <Path d="M28 28v-6a8 8 0 0 1 16 0v6" fill="none" stroke={colors.cta.main} strokeWidth="2" />
    </Svg>
  );
}

export function PickupGuideStart({
  rules,
  busy,
  onChoose,
}: {
  rules: PickupPhotoRules;
  busy: boolean;
  onChoose: (mode: 'guide' | 'blank') => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const guide = rules.guide;
  if (!guide) return null;
  const date = formatListingDay(guide.submittedAt, rules.timezone, i18n.language);
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.h5, { color: colors.text.primary }]}>{t('rentalInspection.pickupPhotosTitle', 'Pickup photos')}</Text>
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
          {t('rentalInspection.guideOnlyNote', 'The last return photos are a guide only. You must retake every photo today, ideally with the renter there.')}
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

export function PickupCameraSheet({ onTake, onClose }: { onTake: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]}>
      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>{t('rentalInspection.photoSource', 'Photo source')}</Text>
      <Text style={{ color: colors.text.primary }}>{t('rentalInspection.inAppCamera', 'In-app camera')}</Text>
      <Text style={{ color: colors.text.secondary }}>{t('rentalInspection.cameraRequired', 'Required for pickup photos.')}</Text>
      <Text style={{ color: colors.text.disabled }}>{t('rentalInspection.photoLibrary', 'Photo library')}</Text>
      <Text style={{ color: colors.text.disabled }}>{t('rentalInspection.libraryDisabled', 'Disabled for this report.')}</Text>
      <Text style={{ color: colors.text.secondary }}>
        {t('rentalInspection.libraryLockedNote', 'Gallery photos stay off for this report. Take the photo in the app.')}
      </Text>
      <Button mode="contained" buttonColor={colors.cta.main} onPress={onTake}>{t('rentalInspection.takePhoto', 'Take photo')}</Button>
      <Button mode="text" onPress={onClose}>{t('common.cancel', 'Cancel')}</Button>
    </View>
  );
}

export function PickupCameraDenied({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: colors.pageBackground, padding: spacing.lg, gap: spacing.md }]}>
      <CameraLockArt label={t('rentalInspection.enableCamera', 'Enable the camera')} />
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
}

export function PickupSubmitBlocked({
  rows,
  date,
  onRetake,
  onSkip,
}: {
  rows: BlockedAngleRow[];
  date: string;
  onRetake: (row: BlockedAngleRow) => void;
  onSkip: (row: BlockedAngleRow, reason: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const [skipKey, setSkipKey] = useState<string | null>(null);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md }}>
      <Text style={[typography.h5, { color: colors.text.primary }]}>{t('rentalInspection.cantSendYet', "Can't send yet")}</Text>
      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
        {t('rentalInspection.retakeBeforeSending', 'Retake all photos before sending')}
      </Text>
      <Text style={{ color: colors.text.secondary }}>
        {t('rentalInspection.missingAngles', '{{count}} angles from the {{date}} guide are still missing. Retake them, or skip an extra angle with a reason.', {
          count: rows.length,
          date,
        })}
      </Text>
      {rows.map((row) => (
        <BlockedAngle
          key={`${row.unitId}-${row.slotKey}`}
          row={row}
          open={skipKey === row.slotKey}
          onRetake={() => onRetake(row)}
          onAskSkip={() => setSkipKey(row.slotKey)}
          onSkip={(reason) => onSkip(row, reason)}
        />
      ))}
      <Button mode="contained" disabled>{t('rentalInspection.submitReport', 'Submit report')}</Button>
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
        <Text style={{ flex: 1, color: colors.text.primary }}>{row.label}</Text>
        {row.action === 'retake' ? (
          <Button mode="outlined" onPress={onRetake}>{t('rentalInspection.retake', 'Retake')}</Button>
        ) : (
          <Button mode="text" onPress={onAskSkip}>{t('rentalInspection.skipAngle', 'Skip this angle')}</Button>
        )}
      </View>
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
  const when = rules.startAt ? formatListingStamp(rules.startAt, rules.timezone, i18n.language) : '';
  const early = !rules.pickupDay;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
        {early
          ? t('rentalInspection.earlyPrepareBody', 'You can prepare the checklist now; photos are taken on pickup day.')
          : t('rentalInspection.pickupTodayBody', 'Pickup today, take the condition photos with the renter.')}
      </Text>
      {when ? <Text style={{ color: colors.text.secondary }}>{when}</Text> : null}
      <Button mode="contained" buttonColor={colors.cta.main} style={{ minHeight: 48 }} onPress={onOpen}>
        {early
          ? t('rentalInspection.prepareChecklist', 'Prepare checklist')
          : t('rentalInspection.takePickupPhotos', 'Take pickup photos')}
      </Button>
    </View>
  );
}

export function SkipReasonField({ onSave }: { onSave: (reason: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <TextInput mode="outlined" label={t('rentalInspection.skipReason', 'Reason')} value={reason} onChangeText={setReason} />
      <Button mode="outlined" disabled={!reason.trim()} buttonColor={colors.surface} onPress={() => onSave(reason.trim())}>
        {t('rentalInspection.skipSave', 'Save reason')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  sheet: { borderTopWidth: 1 },
  fill: { flex: 1 },
  tag: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', gap: 8, alignSelf: 'flex-start' },
});
