import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiRequest } from '../../../services/apiClient';

const SLOTS = ['overview', 'other_side', 'accessories'] as const;
type Slot = (typeof SLOTS)[number];

interface BaselinePhoto {
  id: string;
  slotKey: string;
  status: string;
}

interface InspectionSummary {
  enabled: boolean;
  rail: 'card' | 'momo';
  baselineComplete: boolean;
  photos: BaselinePhoto[];
}

export function InspectionOptInCard({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { flags, loading } = useClientFlags();
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [sheet, setSheet] = useState<'explainer' | 'baseline' | null>(null);
  const on = !loading && flags.rentals_inspection_optin_enabled;
  const load = useCallback(async () => {
    const data = await apiRequest<{ success: boolean; data: { item: { inspection?: InspectionSummary } } }>(
      `/rentals/business/items/${itemId}`
    );
    setSummary(data.data.item.inspection ?? null);
  }, [itemId]);
  useEffect(() => {
    if (on) void load().catch(() => setSummary(null));
  }, [load, on]);
  if (!on || !summary) return null;
  return (
    <OptInBody itemId={itemId} itemName={itemName} summary={summary} sheet={sheet} onSheet={setSheet} onReload={load} />
  );
}

function OptInBody({
  itemId,
  itemName,
  summary,
  sheet,
  onSheet,
  onReload,
}: {
  itemId: string;
  itemName: string;
  summary: InspectionSummary;
  sheet: 'explainer' | 'baseline' | null;
  onSheet: (sheet: 'explainer' | 'baseline' | null) => void;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const setOff = () => void apiRequest(`/rentals/business/items/${itemId}/inspection`, {
    method: 'POST',
    body: JSON.stringify({ enabled: false }),
  }).then(onReload);
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="shield-outline" size={22} color={colors.primary.main} />
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('rentalInspection.optInTitle', 'Inspection')}</Text>
        <Pressable accessibilityLabel={t('rentalInspection.optInInfo', 'Info')} onPress={() => onSheet('explainer')}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.text.secondary} />
        </Pressable>
        <Switch value={summary.enabled} onValueChange={(checked) => (checked ? onSheet('explainer') : setOff())} />
      </View>
      <Text style={{ color: colors.text.secondary }}>
        {summary.enabled
          ? t('rentalInspection.optInOn', 'On. You take condition photos at each pickup.')
          : t('rentalInspection.optInOff', 'Off. No condition report at pickup.')}
      </Text>
      {sheet === 'explainer' ? (
        <Explainer itemName={itemName} rail={summary.rail} onClose={() => onSheet(null)} onTurnOn={() => onSheet(summary.baselineComplete ? 'explainer' : 'baseline')} itemId={itemId} complete={summary.baselineComplete} onReload={onReload} />
      ) : null}
      {sheet === 'baseline' ? <Baseline itemId={itemId} photos={summary.photos} onReload={onReload} onClose={() => onSheet(null)} /> : null}
    </View>
  );
}

function Explainer({
  itemId,
  itemName,
  rail,
  complete,
  onClose,
  onTurnOn,
  onReload,
}: {
  itemId: string;
  itemName: string;
  rail: 'card' | 'momo';
  complete: boolean;
  onClose: () => void;
  onTurnOn: () => void;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const pay = rail === 'card'
    ? t('rentalInspection.optInPayCard', 'On card payments, the renter’s card holds the rental plus the deposit (for example $65.00). The deposit is released unless there is damage or a late return.')
    : t('rentalInspection.optInPayMomo', 'On Mobile Money, the renter pays the rental at pickup. No deposit is held. If you report damage, it is recorded and Rendasua support helps you recover it — it is not charged automatically.');
  const turn = () => {
    if (!complete) {
      onTurnOn();
      return;
    }
    void apiRequest(`/rentals/business/items/${itemId}/inspection`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    }).then(onReload).then(onClose);
  };
  return (
    <View>
      <Text style={styles.title}>{t('rentalInspection.optInSheetTitle', 'Inspection for this item')}</Text>
      <Text>{t('rentalInspection.optInLead', 'Here is what turning it on means for the {{name}}.', { name: itemName })}</Text>
      <Text>{t('rentalInspection.optInPhotos', 'You take condition photos at each pickup — with the camera, from your gallery, or by upload on the web. You can reuse photos from the last rental.')}</Text>
      <Text>{t('rentalInspection.optInAccept', 'The renter reviews and accepts the condition report before the rental starts.')}</Text>
      <Text>{t('rentalInspection.optInReturn', 'At return, you compare the item and can report damage.')}</Text>
      <Text>{pay}</Text>
      <Text>{t('rentalInspection.optInProtects', 'This protects you in a dispute.')}</Text>
      <Text>{t('rentalInspection.optInMinutes', 'It adds a few minutes at pickup.')}</Text>
      <Button onPress={onClose}>{t('rentalInspection.optInNotNow', 'Not now')}</Button>
      <Button mode="contained" icon="shield-outline" onPress={turn}>{t('rentalInspection.optInTurnOn', 'Turn on inspection')}</Button>
    </View>
  );
}

function Baseline({
  itemId,
  photos,
  onReload,
  onClose,
}: {
  itemId: string;
  photos: BaselinePhoto[];
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ready = SLOTS.filter((slot) => photos.some((photo) => photo.slotKey === slot && photo.status === 'ready'));
  return (
    <View>
      <Text style={styles.title}>{t('rentalInspection.baselineTitle', 'Condition photos')}</Text>
      <Text>{t('rentalInspection.baselineLead', 'To turn on inspection, add a baseline set of photos of this item. They pre-fill the first pickup. You can replace them anytime.')}</Text>
      {SLOTS.map((slot) => (
        <SlotRow key={slot} itemId={itemId} slot={slot} ready={ready.includes(slot)} onReload={onReload} />
      ))}
      {ready.length < 3 ? <Text>{t('rentalInspection.baselineMore', 'Add {{count}} more photos to turn on inspection.', { count: 3 - ready.length })}</Text> : null}
      <Button
        mode="contained"
        disabled={ready.length < 3}
        onPress={() => void apiRequest(`/rentals/business/items/${itemId}/inspection`, {
          method: 'POST',
          body: JSON.stringify({ enabled: true }),
        }).then(onReload).then(onClose)}
      >
        {t('rentalInspection.baselineSave', 'Save and turn on inspection')}
      </Button>
    </View>
  );
}

function SlotRow({ itemId, slot, ready, onReload }: { itemId: string; slot: Slot; ready: boolean; onReload: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Text style={{ flex: 1 }}>{t(`rentalInspection.slot.${slot}`, slot)}{ready ? '' : ` · ${t('rentalInspection.baselineRequired', 'Required')}`}</Text>
      <Button compact onPress={() => void pick(itemId, slot, 'camera', onReload)}>{t('rentalInspection.camera', 'Camera')}</Button>
      <Button compact onPress={() => void pick(itemId, slot, 'gallery', onReload)}>{t('rentalInspection.gallery', 'Gallery')}</Button>
    </View>
  );
}

async function pick(itemId: string, slot: Slot, source: 'camera' | 'gallery', onReload: () => Promise<void>) {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return;
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ quality: 1, exif: true })
    : await ImagePicker.launchImageLibraryAsync({ quality: 1, exif: true });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return;
  const contentType = (asset.mimeType || 'image/jpeg').replace('image/jpg', 'image/jpeg');
  const signed = await apiRequest<{ photoId: string; uploadUrl: string }>(
    `/rentals/business/items/${itemId}/baseline/presign`,
    {
      method: 'POST',
      body: JSON.stringify({
        slotKey: slot,
        contentType,
        fileSize: asset.fileSize ?? 0,
        captureSource: source,
        exifDateTime: asset.exif?.DateTimeOriginal,
      }),
    }
  );
  const file = await fetch(asset.uri);
  await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: await file.blob() });
  await apiRequest(`/rentals/business/items/${itemId}/baseline/${signed.photoId}/finalize`, { method: 'POST' });
  await onReload();
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
});
