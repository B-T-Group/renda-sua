import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InspectionBanner, UnitTabs } from '../../components/rentals/inspection/InspectionChrome';
import { InspectionPhotoSlots } from '../../components/rentals/inspection/InspectionPhotoSlots';
import {
  ChecklistTag,
  PickupCameraDenied,
  PickupGuideStart,
  PickupSubmitBlocked,
} from '../../components/rentals/inspection/PickupPhotoChrome';
import { blockedScreenRows, submitLeftCount } from '../../utils/rentals/blockedGuideRows';
import { formatListingDay, formatListingStamp, slotTileLabel } from '../../utils/rentals/pickupPhotoTime';
import { useTheme } from '../../contexts/ThemeContext';
import { useInspectionCapture } from '../../hooks/useInspectionCapture';
import { derivedOvertime } from '../../utils/rentals/rentalInspection';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessInspection'>;

export default function BusinessInspectionScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const stage = route.params.stage;
  const model = useInspectionCapture(route.params.bookingId, stage);
  const [claim, setClaim] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [cameraLabel, setCameraLabel] = useState<string | null>(null);
  const unit = model.current;
  const needsClaim = stage === 'return' && model.units.some((row) => row.returnChoice === 'damage' || row.condition === 'damaged');
  const overtime = model.booking ? derivedOvertime(model.booking) : null;

  const rulesOn = stage === 'pickup' && model.rules?.enabled === true;
  const guideDate = model.rules?.guide
    ? formatListingDay(model.rules.guide.submittedAt, model.rules.timezone, i18n.language)
    : '';

  if (model.cameraDenied && rulesOn) {
    return <PickupCameraDenied onClose={model.dismissCameraDenied} />;
  }

  if (rulesOn && model.rules?.guide && !model.rules.guideMode && !model.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.pageBackground, padding: spacing.md }}>
        <PickupGuideStart rules={model.rules} busy={model.busy} onChoose={(mode) => void model.chooseGuide(mode)} />
      </View>
    );
  }

  if (blocked && rulesOn) {
    const thumbs = model.units.flatMap((row) => row.photos);
    const slots = thumbs.map((photo) => ({ slotKey: photo.slotKey ?? '', url: photo.ghostUri ?? photo.uri ?? null }));
    const rows = blockedScreenRows(model.guideGaps, model.view?.slotSkips ?? [], slots).map((row) => ({
      ...row,
      label: angleLabel(row.slotKey, t),
      thumbUri: row.thumbUrl,
    }));
    return (
      <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
        <PickupSubmitBlocked
          rows={rows}
          date={guideDate}
          left={submitLeftCount(model.guideGaps)}
          onRetake={(row) => openRetake(model, row, setBlocked, setCameraLabel, t)}
          onSkip={(row, reason) => void model.skipAngle(row.slotKey, reason, row.unitId)}
        />
      </View>
    );
  }

  if (model.loading || !unit) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.cta.main} />
      </View>
    );
  }

  const message = messageFor(model.error, model.notice, model.isOffline || model.unsynced, t);
  const pickup = model.pickupView?.units.find((row) => row.unitId === unit.unitId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120, gap: spacing.md }}>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('rentalInspection.stepInspect', 'Step 2 of 4 · Inspect units')}
        </Text>
        <Text style={[typography.h5, { color: colors.text.primary }]}>
          {model.booking?.rental_location_listing?.rental_item?.name} · {unit.displayLabel}
        </Text>
        {stage === 'return' ? (
          <InspectionBanner tone="success">
            {t('rentalInspection.wholeReturn', 'Whole booking return · all units together — no partial returns')}
          </InspectionBanner>
        ) : null}
        {stage === 'return' && model.booking?.return_handed_back_at ? (
          <InspectionBanner tone="info">
            {t('rentalInspection.handbackReadOnly', 'Handback time · {{time}} (server, read-only)', {
              time: model.booking.return_handed_back_at,
            })}
            {overtime
              ? `\n${overtime.adjusted
                ? t('rentalInspection.overtimeAdjusted', 'Overtime · {{amount}} (adjusted by support)', { amount: overtime.amount })
                : t('rentalInspection.overtimeReadOnly', 'Overtime · {{amount}} (from the handback time)', { amount: overtime.amount })}`
              : ''}
          </InspectionBanner>
        ) : null}
        {message ? <InspectionBanner tone={model.error === 'conflict' ? 'warning' : 'info'}>{message}</InspectionBanner> : null}
        {model.view?.versionNo ? (
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {t('rentalInspection.version', 'v{{version}}', { version: model.view.versionNo })}
          </Text>
        ) : null}
        {model.view?.correctionReason ? (
          <InspectionBanner tone="warning">{model.view.correctionReason}</InspectionBanner>
        ) : null}
        <UnitTabs
          labels={model.units.map((row) => row.displayLabel)}
          active={model.index}
          done={model.units.map((row) => !!row.condition || !!row.returnChoice)}
          onSelect={model.setIndex}
        />
        {stage === 'return' && pickup?.photos[0]?.url ? (
          <View style={styles.compare}>
            <ComparePhoto label={t('rentalInspection.pickupColumn', 'Pickup')} uri={pickup.photos[0].url} />
            <ComparePhoto label={t('rentalInspection.returnColumn', 'Return')} uri={unit.photos[0]?.uri} />
          </View>
        ) : null}
        {rulesOn && !model.rules?.pickupDay ? (
          <InspectionBanner tone="info">
            {t('rentalInspection.earlyPrepareBody', 'You can prepare the checklist now; photos are taken on pickup day.')}
          </InspectionBanner>
        ) : (
          <>
            {rulesOn && model.rules?.guideMode === 'guide' ? (
              <Text style={{ color: colors.text.secondary }}>
                {t('rentalInspection.retakenProgress', '{{done}} of {{total}} retaken', {
                  done: unit.photos.filter((photo) => photo.mediaId).length,
                  total: unit.photos.length,
                })}
                {'\n'}
                {t('rentalInspection.guideRetakeNote', 'Old photos are a guide. Every slot must be retaken.')}
              </Text>
            ) : null}
            <InspectionPhotoSlots
              slots={unit.photos.map((photo) => ({
                ...photo,
                tileLabel: slotTileLabel(photo.slotKey ?? photo.role, i18n.language),
                fromLabel: photo.ghostUri && guideDate
                  ? t('rentalInspection.fromDate', 'from {{date}}', { date: guideDate })
                  : undefined,
                stamp: photo.capturedAt && model.rules?.timezone
                  ? formatListingStamp(photo.capturedAt, model.rules.timezone, i18n.language)
                  : undefined,
              }))}
              minPhotos={rulesOn ? null : model.minPhotos}
              onAdd={(role, slot) => {
                const photo = unit.photos[slot];
                if (rulesOn) {
                  setCameraLabel(angleLabel(photo?.slotKey ?? role, t));
                  void model.addPhoto(role, slot, true);
                  return;
                }
                void model.addPhoto(role, slot);
              }}
              onRetry={(slot) => void model.retryPhoto(slot)}
            />
            {cameraLabel ? <Text numberOfLines={1} style={{ color: colors.text.primary }}>{cameraLabel}</Text> : null}
          </>
        )}
        {stage === 'return' ? (
          <View style={styles.row}>
            <Choice
              label={t('rentalInspection.sameCondition', 'Same condition')}
              selected={unit.returnChoice === 'same'}
              onPress={() => model.update({ returnChoice: 'same', condition: 'good' })}
            />
            <Choice
              label={t('rentalInspection.damageFound', 'Damage found')}
              selected={unit.returnChoice === 'damage'}
              onPress={() => model.update({ returnChoice: 'damage', condition: 'damaged', noWear: false })}
            />
          </View>
        ) : (
          <View style={styles.row}>
            {unit.guideUnconfirmed.includes('condition') ? (
              <ChecklistTag
                label={t('rentalInspection.fromDate', 'from {{date}}', { date: guideDate })}
                onConfirm={() => model.confirmField('condition')}
              />
            ) : null}
            <Choice label={t('rentalInspection.overallGood', 'Overall good')} selected={unit.condition === 'good'} onPress={() => model.update({ condition: 'good' })} />
            <Choice label={t('rentalInspection.overallFair', 'Fair condition')} selected={unit.condition === 'fair'} onPress={() => model.update({ condition: 'fair' })} />
            <Choice label={t('rentalInspection.overallDamaged', 'Damaged')} selected={unit.condition === 'damaged'} onPress={() => model.update({ condition: 'damaged' })} />
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => model.update({ noAccessories: !unit.noAccessories })} style={styles.check}>
          <Text style={{ color: colors.text.primary }}>
            {unit.noAccessories ? '☑ ' : '☐ '}
            {t('rentalInspection.noAccessories', 'No accessories')}
          </Text>
        </Pressable>
        {!unit.noAccessories ? (
          <TextInput
            mode="outlined"
            label={t('rentalInspection.accessoryName', 'Accessory')}
            value={unit.accessories[0]?.name ?? ''}
            onChangeText={(name) => model.update({ accessories: [{ name, count: unit.accessories[0]?.count || '1' }] })}
          />
        ) : null}
        {stage === 'return' && unit.returnChoice === 'damage' ? (
          <>
            <TextInput
              mode="outlined"
              multiline
              label={t('rentalInspection.describeDamage', 'Describe damage')}
              value={unit.wear}
              onChangeText={(wear) => model.update({ wear })}
            />
            <TextInput
              mode="outlined"
              keyboardType="decimal-pad"
              label={t('rentalInspection.claimedAmount', 'Amount you are claiming')}
              value={claim}
              onChangeText={setClaim}
            />
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={() => model.update({ noWear: !unit.noWear, wear: '' })} style={styles.check}>
              <Text style={{ color: colors.text.primary }}>
                {unit.noWear ? '☑ ' : '☐ '}
                {t('rentalInspection.noWear', 'No existing wear')}
              </Text>
            </Pressable>
            {!unit.noWear ? (
              <TextInput
                mode="outlined"
                label={t('rentalInspection.wearNote', 'Describe the wear')}
                value={unit.wear}
                onChangeText={(wear) => model.update({ wear })}
              />
            ) : null}
          </>
        )}
        <TextInput
          mode="outlined"
          label={t('rentalInspection.serialLabel', 'Serial or label')}
          value={unit.physicalLabel}
          onChangeText={(physicalLabel) => model.update({ physicalLabel })}
        />
        {unit.guideUnconfirmed.includes('notes') ? (
          <ChecklistTag
            label={t('rentalInspection.fromDate', 'from {{date}}', { date: guideDate })}
            onConfirm={() => model.confirmField('notes')}
          />
        ) : null}
        <TextInput
          mode="outlined"
          label={t('rentalInspection.notesOptional', 'Notes (optional)')}
          value={unit.note}
          onChangeText={(note) => model.update({ note })}
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.pageBackground, gap: spacing.sm }]}>
        <Button mode="contained" buttonColor={colors.cta.main} style={styles.action} disabled={model.busy} loading={model.busy} onPress={() => void model.saveAndNext()}>
          {t('rentalInspection.saveUnitNext', 'Save unit · next')}
        </Button>
        <Button
          mode="contained"
          buttonColor={colors.cta.dark}
          style={styles.action}
          disabled={
            model.busy
            || (needsClaim && !(Number(claim) > 0))
            || (rulesOn && !model.rules?.pickupDay)
            || (!model.canSubmit && model.guideGaps.length === 0)
          }
          onPress={() => {
            if (rulesOn && model.rules?.guideMode === 'guide' && model.guideGaps.length) {
              setBlocked(true);
              return;
            }
            void model.submit(needsClaim ? Number(claim) : undefined);
          }}
        >
          {stage === 'return'
            ? t('rentalInspection.submitReturn', 'Submit return report')
            : rulesOn && submitLeftCount(model.guideGaps) > 0
              ? t('rentalInspection.submitLeft', 'Submit report · {{count}} left', { count: submitLeftCount(model.guideGaps) })
              : t('rentalInspection.submitReport', 'Submit report')}
        </Button>
        {stage === 'return' ? (
          <Button mode="outlined" style={styles.action} disabled={!model.canHandback || model.busy} onPress={() => void model.handback()}>
            {t('rentalInspection.confirmHandback', 'Confirm physical handback')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function angleLabel(slotKey: string, t: (key: string, fallback: string, options?: Record<string, string>) => string): string {
  if (slotKey.startsWith('extra:')) {
    return t('rentalInspection.extraAngle', 'Extra angle {{n}}', { n: slotKey.slice(6) });
  }
  const known: Record<string, [string, string]> = {
    overview: ['rentalInspection.overview', 'Overview'],
    other_side: ['rentalInspection.otherSide', 'Other side'],
    accessories: ['rentalInspection.accessories', 'Accessories'],
  };
  const pair = known[slotKey];
  return pair ? t(pair[0], pair[1]) : slotKey;
}

function openRetake(
  model: ReturnType<typeof useInspectionCapture>,
  row: { unitId: string; slotKey: string; reason?: string | null },
  setBlocked: (value: boolean) => void,
  setCameraLabel: (value: string) => void,
  t: (key: string, fallback: string, options?: Record<string, string>) => string
) {
  const unitIndex = model.units.findIndex((unit) => unit.unitId === row.unitId);
  if (unitIndex >= 0) model.setIndex(unitIndex);
  const photos = model.units[unitIndex]?.photos ?? [];
  const index = Math.max(0, photos.findIndex((photo) => photo.slotKey === row.slotKey));
  const role = photos[index]?.role ?? 'wear';
  setCameraLabel(angleLabel(row.slotKey, t));
  setBlocked(false);
  if (row.reason) void model.clearSkip(row.slotKey, row.unitId);
  void model.addPhoto(role, index, true);
}

function messageFor(
  error: string | null,
  notice: string | null,
  offline: boolean,
  t: (key: string, fallback: string) => string
): string | null {
  if (offline) return t('rentalInspection.photosNotSynced', 'Photos not synced. Connect to submit.');
  if (error === 'conflict') return t('rentalInspection.reportChanged', 'That report changed. Review it again.');
  if (error === 'update_required') {
    return t('rentalInspection.updateRequired', 'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.');
  }
  if (error === 'photo-minimum') return t('rentalInspection.photoRequirementMissing', 'The photo minimum could not be loaded. Connect and try again.');
  if (notice === 'submitted') return t('rentalInspection.reportUpdated', 'Report updated. Please review it again.');
  if (notice === 'handed') return t('rentalInspection.handbackRecorded', 'Physical handback recorded.');
  if (error) return t('rentalInspection.loadFailed', 'Could not load the inspection.');
  return null;
}

function ComparePhoto({ label, uri }: { label: string; uri?: string }) {
  const { colors, borderRadius } = useTheme();
  return (
    <View style={[styles.slot, { borderColor: colors.border, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: uri ? colors.surface : colors.surfaceInput }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <Text style={{ color: colors.text.secondary, backgroundColor: colors.surface, paddingHorizontal: 6 }}>{label}</Text>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? colors.cta.main : colors.border, backgroundColor: selected ? colors.cta.soft : colors.surface, borderRadius: borderRadius.lg }]}
    >
      <Text style={{ color: colors.text.primary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compare: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1, minHeight: 96, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choice: { minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  check: { minHeight: 48, justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  action: { minHeight: 48, justifyContent: 'center' },
});
