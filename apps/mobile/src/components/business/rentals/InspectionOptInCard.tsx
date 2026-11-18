import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiRequest } from '../../../services/apiClient';
import { formatConfirmationMoney, inspectionExplainerRail } from '../../../utils/rentals/confirmationFormat';

const SLOTS = ['overview', 'other_side', 'accessories'] as const;
type Slot = (typeof SLOTS)[number];

interface BaselinePhoto {
  id: string;
  slotKey: string;
  status: string;
}

interface ListingPrice {
  base_price_per_day?: number | null;
  base_price_per_hour?: number | null;
  security_deposit_amount?: number | null;
}

interface ItemInspection {
  currency?: string;
  rental_location_listings?: ListingPrice[];
  inspection?: Omit<InspectionSummary, 'currency' | 'exampleAmount'>;
}

interface InspectionSummary {
  enabled: boolean;
  rail: 'card' | 'momo';
  baselineComplete: boolean;
  photos: BaselinePhoto[];
  currency: string;
  exampleAmount: number;
}

export function InspectionOptInCard({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { flags, loading } = useClientFlags();
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [sheet, setSheet] = useState<'explainer' | 'baseline' | null>(null);
  const on = !loading && flags.rentals_inspection_optin_enabled;
  const load = useCallback(async () => {
    const data = await apiRequest<{ success: boolean; data: { item: ItemInspection } }>(
      `/rentals/business/items/${itemId}`
    );
    setSummary(readSummary(data.data.item));
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
        <Explainer itemName={itemName} rail={summary.rail} currency={summary.currency} exampleAmount={summary.exampleAmount} onClose={() => onSheet(null)} onTurnOn={() => onSheet(summary.baselineComplete ? 'explainer' : 'baseline')} itemId={itemId} complete={summary.baselineComplete} onReload={onReload} />
      ) : null}
      {sheet === 'baseline' ? <Baseline itemId={itemId} photos={summary.photos} onReload={onReload} onClose={() => onSheet(null)} /> : null}
    </View>
  );
}

function readSummary(item: ItemInspection): InspectionSummary | null {
  if (!item.inspection) return null;
  const hold = exampleHold(item);
  return { ...item.inspection, currency: hold.currency, exampleAmount: hold.amount };
}

function exampleHold(item: ItemInspection): { amount: number; currency: string } {
  const listing = item.rental_location_listings?.[0];
  const rental = Number(listing?.base_price_per_day ?? listing?.base_price_per_hour ?? 0);
  const deposit = Number(listing?.security_deposit_amount ?? 0);
  return { amount: rental + deposit, currency: item.currency || 'XAF' };
}

function Explainer({
  itemId,
  itemName,
  rail,
  currency,
  exampleAmount,
  complete,
  onClose,
  onTurnOn,
  onReload,
}: {
  itemId: string;
  itemName: string;
  rail: 'card' | 'momo';
  currency: string;
  exampleAmount: number;
  complete: boolean;
  onClose: () => void;
  onTurnOn: () => void;
  onReload: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const shown = inspectionExplainerRail(rail, currency);
  const amount = formatConfirmationMoney(exampleAmount, currency, i18n.language);
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
      <Text style={{ color: '#64748B', marginBottom: 4 }}>
        {t('rentalInspection.optInLead', 'Here is what turning it on means for the {{name}}.', { name: itemName })}
      </Text>
      <ExplainerList rail={shown} amount={amount} />
      <Button onPress={onClose}>{t('rentalInspection.optInNotNow', 'Not now')}</Button>
      <Button mode="contained" icon="shield-outline" onPress={turn}>{t('rentalInspection.optInTurnOn', 'Turn on inspection')}</Button>
    </View>
  );
}

function ExplainerList({ rail, amount }: { rail: 'card' | 'momo'; amount: string }) {
  const { t } = useTranslation();
  const pay = rail === 'momo'
    ? t('rentalInspection.optInPointMomo', 'Mobile Money: the renter pays {{amount}} at pickup. No deposit is held.', { amount })
    : t('rentalInspection.optInPointCard', 'Card hold: rental plus deposit ({{amount}}).', { amount });
  return (
    <View>
      <Point icon="camera-outline" text={t('rentalInspection.optInPointCamera', 'Condition photos at each pickup.')} />
      <Point icon="account-check-outline" text={t('rentalInspection.optInPointCheck', 'The renter checks and accepts the report.')} />
      <Point icon="compare" text={t('rentalInspection.optInPointCompare', 'At return, you compare the item.')} />
      <Point icon={rail === 'momo' ? 'cellphone' : 'credit-card-outline'} text={pay} />
      <Point icon="shield-check-outline" text={t('rentalInspection.optInPointShield', 'This protects you in a dispute.')} />
    </View>
  );
}

function Point({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary.main} />
      <Text style={{ flex: 1, color: colors.text.primary }}>{text}</Text>
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
      <Text style={{ flex: 1 }}>
        {`${t(`rentalInspection.slot.${slot}`, slot)} · ${t('rentalInspection.baselineRequired', 'Required')}${ready ? ' ✓' : ''}`}
      </Text>
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
  point: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  title: { flex: 1, fontWeight: '700' },
});
