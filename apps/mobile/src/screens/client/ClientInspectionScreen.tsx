import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InspectionBanner, UnitTabs } from '../../components/rentals/inspection/InspectionChrome';
import { InspectionPhotoSlots } from '../../components/rentals/inspection/InspectionPhotoSlots';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientInspection } from '../../hooks/useClientInspection';
import type { ClientRootStackParamList } from '../../navigation/types';
import { CORRECTION_REASON_CODES, allUnitsReviewed, damageRail, returnHasDamage } from '../../utils/rentals/rentalInspection';

type Route = RouteProp<ClientRootStackParamList, 'ClientInspection'>;

export default function ClientInspectionScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { bookingId, stage } = useRoute<Route>().params;
  const model = useClientInspection(bookingId, stage);
  const [panel, setPanel] = useState<'review' | 'correction' | 'dispute'>('review');
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const ids = model.view?.units.map((unit) => unit.unitId) ?? [];
  const reviewed = allUnitsReviewed(ids, model.seen);
  const unit = model.view?.units[model.index];
  const damaged = stage === 'return' && returnHasDamage(model.view);
  const rail = model.booking ? damageRail(model.booking) : 'recorded';

  const reasonLabels = useMemo(() => ({
    missing_accessory: t('rentalInspection.reasonMissingAccessory', 'Missing accessory'),
    photo_mismatch: t('rentalInspection.reasonPhotoMismatch', "Photo doesn't match item"),
    wear_hidden: t('rentalInspection.reasonWearHidden', 'Wear not shown'),
    wrong_unit: t('rentalInspection.reasonWrongUnit', 'Wrong unit / serial'),
  }), [t]);

  if (model.loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!unit) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.md }]}>
        <Text style={[typography.body1, { color: colors.text.primary, textAlign: 'center' }]}>
          {t('rentalInspection.businessRecording', 'The business is recording the condition report.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 140, gap: spacing.md }}>
        <Text style={[typography.h5, { color: colors.text.primary }]}>
          {stage === 'return'
            ? t('rentalInspection.reviewReturn', 'Review the return against pickup photos')
            : t('rentalInspection.reviewTitle', 'Review item condition')}
        </Text>
        <InspectionBanner tone="info">
          {t('rentalInspection.mustReviewAll', 'Review every unit before accepting. This locks the pickup baseline.')}
        </InspectionBanner>
        {model.error === 'conflict' ? (
          <InspectionBanner tone="warning">{t('rentalInspection.reportChanged', 'That report changed. Review it again.')}</InspectionBanner>
        ) : null}
        {model.error === 'update_required' ? (
          <InspectionBanner tone="warning">
            {t('rentalInspection.updateRequired', 'This rental uses condition inspections. Review the report here, or update the app if this screen is missing.')}
          </InspectionBanner>
        ) : null}
        <UnitTabs
          labels={model.view?.units.map((row) => row.displayLabel) ?? []}
          active={model.index}
          done={model.view?.units.map((row) => model.seen.has(row.unitId)) ?? []}
          onSelect={model.setIndex}
        />
        <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
          {model.booking?.rental_location_listing?.rental_item?.name} · {unit.displayLabel}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('rentalInspection.reviewedProgress', '{{done}} of {{total}} reviewed', {
            done: model.seen.size,
            total: ids.length,
          })}
        </Text>
        <View style={styles.photos}>
          {unit.photos.map((photo) => (
            <View key={photo.id} style={[styles.photo, { backgroundColor: colors.surfaceInput }]}>
              {photo.url ? <Image source={{ uri: photo.url }} style={styles.image} /> : null}
              <Text style={{ color: colors.text.secondary }}>{photo.role}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: colors.text.primary }}>{conditionLine(unit.condition, t)}</Text>
        <Text style={{ color: colors.text.primary }}>{wearLine(unit.wear, t)}</Text>
        {unit.accessories.map((row) => (
          <Text key={row.name} style={{ color: colors.text.primary }}>{row.name} · {row.count}</Text>
        ))}
        {damaged ? (
          <InspectionBanner tone="warning">
            {rail === 'card'
              ? t('rentalInspection.cardDamage', 'Damage can only come from the card deposit, after a person reviews it. The rental amount and overtime settle as usual.')
              : t('rentalInspection.recordedDamage', 'This damage claim is recorded for review. It is not charged automatically. The rental amount and overtime settle as usual.')}
            {' '}
            {t('rentalInspection.respondSoon', 'Respond soon. Reminder in 24 hours. A person reviews it after 48 hours if you do not reply. A damage claim is never accepted automatically.')}
          </InspectionBanner>
        ) : null}
        {panel !== 'review' ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
              {panel === 'dispute'
                ? t('rentalInspection.reportDisagreement', 'Report a disagreement')
                : t('rentalInspection.correctionTitle', 'Request a correction')}
            </Text>
            {CORRECTION_REASON_CODES.map((code) => (
              <Pressable key={code} accessibilityRole="checkbox" accessibilityState={{ checked: reasons.includes(code) }} onPress={() => setReasons((prev) => prev.includes(code) ? prev.filter((row) => row !== code) : [...prev, code])} style={styles.check}>
                <Text style={{ color: colors.text.primary }}>{reasons.includes(code) ? '☑ ' : '☐ '}{reasonLabels[code]}</Text>
              </Pressable>
            ))}
            <TextInput mode="outlined" multiline label={t('rentalInspection.details', 'Details')} value={details} onChangeText={setDetails} />
            {panel === 'dispute' ? (
              <InspectionPhotoSlots
                slots={model.counterPhotos}
                minPhotos={null}
                onAdd={(_role, slot) => void model.addCounter(slot)}
                onRetry={(slot) => void model.retryCounter(slot)}
              />
            ) : null}
          </View>
        ) : null}
        {stage === 'return' && model.baselineMissing ? (
          <InspectionBanner tone="warning">
            {t('rentalInspection.pickupBaselineMissing', 'Pickup baseline unavailable for this rental')}
          </InspectionBanner>
        ) : null}
        {model.notice ? <InspectionBanner tone="success">{noticeText(model.notice, t)}</InspectionBanner> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm }]}>
        {panel === 'review' ? (
          <>
            <Button mode="contained" buttonColor={colors.primary.main} style={styles.action} disabled={!reviewed || model.busy || !model.view?.versionId} onPress={() => void model.accept()}>
              {damaged
                ? t('rentalInspection.agreeReport', 'I agree with this report')
                : stage === 'return'
                  ? t('rentalInspection.confirmNoDisagreement', 'Confirm · no disagreement')
                  : t('rentalInspection.acceptReport', 'Accept this condition report')}
            </Button>
            <Button mode="outlined" textColor={colors.error.main} style={styles.action} onPress={() => setPanel(damaged ? 'dispute' : 'correction')}>
              {damaged
                ? t('rentalInspection.disputeClaim', 'Dispute this claim')
                : t('rentalInspection.requestCorrection', 'Request a correction')}
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            buttonColor={colors.primary.main}
            style={styles.action}
            disabled={model.busy || model.isOffline}
            onPress={() => void model.sendReason(panel === 'dispute' ? 'dispute' : 'correction', reasons, details, reasonLabels)}
          >
            {panel === 'dispute'
              ? t('rentalInspection.reportDisagreement', 'Report a disagreement')
              : t('rentalInspection.sendToBusiness', 'Send to business')}
          </Button>
        )}
      </View>
    </View>
  );
}

function conditionLine(condition: string, t: (key: string, fallback: string) => string): string {
  if (condition === 'good') return t('rentalInspection.overallGood', 'Overall good');
  if (condition === 'fair') return t('rentalInspection.overallFair', 'Fair condition');
  if (condition === 'damaged') return t('rentalInspection.damageFound', 'Damage found');
  return condition;
}

function wearLine(wear: string, t: (key: string, fallback: string) => string): string {
  if (!wear || wear === 'none') return t('rentalInspection.noWear', 'No existing wear');
  return wear;
}

function noticeText(notice: string, t: (key: string, fallback: string) => string): string {
  if (notice === 'accepted') return t('rentalInspection.accepted', 'You accepted this report.');
  if (notice === 'correction') return t('rentalInspection.correctionSent', 'Correction sent. The business will update the report.');
  if (notice === 'disputed') return t('rentalInspection.returnRecorded', 'Return recorded. Financial review pending.');
  return notice;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '31%', minHeight: 96, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { ...StyleSheet.absoluteFillObject },
  check: { minHeight: 48, justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  action: { minHeight: 48, justifyContent: 'center' },
});
