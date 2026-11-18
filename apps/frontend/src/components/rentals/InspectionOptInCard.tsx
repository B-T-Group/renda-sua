import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useClientFlags } from '../../hooks/useClientFlags';
import { formatConfirmationMoney, inspectionExplainerRail } from '../../utils/rentals/confirmationFormat';

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
  const { flags, loaded } = useClientFlags();
  const api = useApiClient();
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [sheet, setSheet] = useState<'explainer' | 'baseline' | null>(null);
  const on = loaded && flags.rentals_inspection_optin_enabled;
  const load = useCallback(async () => {
    const { data } = await api.get<{ success: boolean; data: { item: ItemInspection } }>(
      `/rentals/business/items/${itemId}`
    );
    setSummary(readSummary(data.data.item));
  }, [api, itemId]);
  useEffect(() => {
    if (on) void load().catch(() => setSummary(null));
  }, [load, on]);
  if (!on || !summary) return null;
  return (
    <OptInRow
      itemId={itemId}
      itemName={itemName}
      summary={summary}
      sheet={sheet}
      onReload={load}
      onSheet={setSheet}
    />
  );
}

function OptInRow({
  itemId,
  itemName,
  summary,
  sheet,
  onReload,
  onSheet,
}: {
  itemId: string;
  itemName: string;
  summary: InspectionSummary;
  sheet: 'explainer' | 'baseline' | null;
  onReload: () => Promise<void>;
  onSheet: (sheet: 'explainer' | 'baseline' | null) => void;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const turnOn = async () => {
    if (summary.baselineComplete) {
      await api.post(`/rentals/business/items/${itemId}/inspection`, { enabled: true });
      onSheet(null);
      await onReload();
      return;
    }
    onSheet('baseline');
  };
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, my: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ShieldOutlinedIcon color="primary" />
        <Typography sx={{ fontWeight: 700, flex: 1 }}>{t('rentalInspection.optInTitle', 'Inspection')}</Typography>
        <IconButton aria-label={t('rentalInspection.optInInfo', 'Info')} onClick={() => onSheet('explainer')}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
        <Switch
          checked={summary.enabled}
          onChange={(_, checked) => {
            if (checked) onSheet('explainer');
            else void api.post(`/rentals/business/items/${itemId}/inspection`, { enabled: false }).then(onReload);
          }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {summary.enabled
          ? t('rentalInspection.optInOn', 'On. You take condition photos at each pickup.')
          : t('rentalInspection.optInOff', 'Off. No condition report at pickup.')}
      </Typography>
      <Explainer open={sheet === 'explainer'} itemName={itemName} rail={summary.rail} currency={summary.currency} exampleAmount={summary.exampleAmount} onClose={() => onSheet(null)} onTurnOn={() => void turnOn()} />
      <BaselineDialog open={sheet === 'baseline'} itemId={itemId} photos={summary.photos} onClose={() => onSheet(null)} onSaved={onReload} />
    </Box>
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

function payLine(rail: 'card' | 'momo', amount: string, t: TFunction): string {
  if (rail === 'momo') {
    return t('rentalInspection.optInPayMomo', 'On Mobile Money, the renter pays {{amount}} at pickup. No deposit is held. If you report damage, it is recorded and Rendasua support helps you recover it — it is not charged automatically.', { amount });
  }
  return t('rentalInspection.optInPayCard', 'On card payments, the renter’s card holds the rental plus the deposit (for example {{amount}}). The deposit is released unless there is damage or a late return.', { amount });
}

function Explainer({
  open,
  itemName,
  rail,
  currency,
  exampleAmount,
  onClose,
  onTurnOn,
}: {
  open: boolean;
  itemName: string;
  rail: 'card' | 'momo';
  currency: string;
  exampleAmount: number;
  onClose: () => void;
  onTurnOn: () => void;
}) {
  const { t, i18n } = useTranslation();
  const shown = inspectionExplainerRail(rail, currency);
  const amount = formatConfirmationMoney(exampleAmount, currency, i18n.language);
  const pay = payLine(shown, amount, t);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('rentalInspection.optInSheetTitle', 'Inspection for this item')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          {t('rentalInspection.optInLead', 'Here is what turning it on means for the {{name}}.', { name: itemName })}
        </Typography>
        <Bullet text={t('rentalInspection.optInPhotos', 'You take condition photos at each pickup — with the camera, from your gallery, or by upload on the web. You can reuse photos from the last rental.')} />
        <Bullet text={t('rentalInspection.optInAccept', 'The renter reviews and accepts the condition report before the rental starts.')} />
        <Bullet text={t('rentalInspection.optInReturn', 'At return, you compare the item and can report damage.')} />
        <Bullet text={pay} />
        <Bullet text={t('rentalInspection.optInProtects', 'This protects you in a dispute.')} />
        <Bullet text={t('rentalInspection.optInMinutes', 'It adds a few minutes at pickup.')} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('rentalInspection.optInNotNow', 'Not now')}</Button>
        <Button variant="contained" startIcon={<ShieldOutlinedIcon />} onClick={onTurnOn}>
          {t('rentalInspection.optInTurnOn', 'Turn on inspection')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Bullet({ text }: { text: string }) {
  return <Typography sx={{ py: 0.5 }}>{text}</Typography>;
}

function BaselineDialog({
  open,
  itemId,
  photos,
  onClose,
  onSaved,
}: {
  open: boolean;
  itemId: string;
  photos: BaselinePhoto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const ready = SLOTS.filter((slot) => photos.some((photo) => photo.slotKey === slot && photo.status === 'ready'));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('rentalInspection.baselineTitle', 'Condition photos')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          {t('rentalInspection.baselineLead', 'To turn on inspection, add a baseline set of photos of this item. They pre-fill the first pickup. You can replace them anytime.')}
        </Typography>
        {SLOTS.map((slot) => (
          <BaselineSlot key={slot} itemId={itemId} slot={slot} ready={ready.includes(slot)} onSaved={onSaved} />
        ))}
        {ready.length < 3 ? (
          <Typography variant="body2">
            {t('rentalInspection.baselineMore', 'Add {{count}} more photos to turn on inspection.', { count: 3 - ready.length })}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <SaveOn itemId={itemId} disabled={ready.length < 3} onDone={async () => { await onSaved(); onClose(); }} />
      </DialogActions>
    </Dialog>
  );
}

function SaveOn({ itemId, disabled, onDone }: { itemId: string; disabled: boolean; onDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const api = useApiClient();
  return (
    <Button
      variant="contained"
      disabled={disabled}
      onClick={() => void api.post(`/rentals/business/items/${itemId}/inspection`, { enabled: true }).then(onDone)}
    >
      {t('rentalInspection.baselineSave', 'Save and turn on inspection')}
    </Button>
  );
}

function BaselineSlot({
  itemId,
  slot,
  ready,
  onSaved,
}: {
  itemId: string;
  slot: Slot;
  ready: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const label = t(`rentalInspection.slot.${slot}`, slot);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Typography sx={{ flex: 1 }}>
        {`${label} · ${t('rentalInspection.baselineRequired', 'Required')}${ready ? ' ✓' : ''}`}
      </Typography>
      <SlotFile itemId={itemId} slot={slot} source="camera" label={t('rentalInspection.camera', 'Camera')} icon={<PhotoCameraOutlinedIcon />} capture onSaved={onSaved} />
      <SlotFile itemId={itemId} slot={slot} source="gallery" label={t('rentalInspection.gallery', 'Gallery')} icon={<PhotoLibraryOutlinedIcon />} onSaved={onSaved} />
      <SlotFile itemId={itemId} slot={slot} source="web" label={t('rentalInspection.upload', 'Upload')} icon={<UploadFileOutlinedIcon />} onSaved={onSaved} />
    </Stack>
  );
}

function SlotFile({
  itemId,
  slot,
  source,
  label,
  icon,
  capture,
  onSaved,
}: {
  itemId: string;
  slot: Slot;
  source: 'camera' | 'gallery' | 'web';
  label: string;
  icon: React.ReactNode;
  capture?: boolean;
  onSaved: () => Promise<void>;
}) {
  const api = useApiClient();
  const send = async (file: File) => {
    const presign = await api.post<{ photoId: string; uploadUrl: string }>(
      `/rentals/business/items/${itemId}/baseline/presign`,
      { slotKey: slot, contentType: file.type || 'image/jpeg', fileSize: file.size, captureSource: source }
    );
    await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
    await api.post(`/rentals/business/items/${itemId}/baseline/${presign.data.photoId}/finalize`);
    await onSaved();
  };
  return (
    <Button component="label" size="small" aria-label={label} startIcon={icon}>
      {label}
      <input
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture ? 'environment' : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
    </Button>
  );
}
