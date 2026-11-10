import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InspectionBanner, UnitTabs } from '../../components/rentals/inspection/InspectionChrome';
import { InspectionPhotoSlots } from '../../components/rentals/inspection/InspectionPhotoSlots';
import { useTheme } from '../../contexts/ThemeContext';
import { useInspectionCapture } from '../../hooks/useInspectionCapture';
import type { BusinessRootStackParamList } from '../../navigation/types';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessInspection'>;

export default function BusinessInspectionScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const stage = route.params.stage;
  const model = useInspectionCapture(route.params.bookingId, stage);
  const unit = model.current;

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
        <InspectionPhotoSlots
          slots={unit.photos}
          minPhotos={model.minPhotos}
          onAdd={(role, slot) => void model.addPhoto(role, slot)}
          onRetry={(slot) => void model.retryPhoto(slot)}
        />
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
          <TextInput
            mode="outlined"
            multiline
            label={t('rentalInspection.describeDamage', 'Describe damage')}
            value={unit.wear}
            onChangeText={(wear) => model.update({ wear })}
          />
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
        <Button mode="contained" buttonColor={colors.cta.dark} style={styles.action} disabled={!model.canSubmit || model.busy} onPress={() => void model.submit()}>
          {stage === 'return'
            ? t('rentalInspection.submitReturn', 'Submit return report')
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
