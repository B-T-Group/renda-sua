import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useNetworkStatus } from './useNetworkStatus';
import { getBooking } from '../services/rentalsApi';
import {
  getInspection,
  hydrateInspectionPhotos,
  openInspectionDraft,
  recordHandback,
  saveInspectionItems,
  submitInspection,
  uploadInspectionPhoto,
} from '../services/rentalInspectionApi';
import { filterSupportedImageAssets, IMAGE_LIBRARY_PICKER_OPTIONS } from '../utils/supportedImageFormats';
import {
  classifyInspectionError,
  handbackEnabled,
  normalizeAccessories,
  photoRolesForMinimum,
  businessCanReplaceReport,
  reportReadyToSubmit,
  sameConditionPayload,
  type InspectionStage,
  type InspectionUnit,
  type InspectionView,
  type PhotoRole,
} from '../utils/rentals/rentalInspection';
import type { RentalBookingDetail } from '../types/rentals';

export interface LocalPhoto {
  key: string;
  role: PhotoRole;
  mediaId?: string;
  uri?: string;
  failed?: boolean;
  pending?: boolean;
}

export interface LocalUnit {
  unitId: string;
  slotIndex: number;
  displayLabel: string;
  physicalLabel: string;
  condition: '' | 'good' | 'fair' | 'damaged';
  accessories: Array<{ name: string; count: string }>;
  noAccessories: boolean;
  wear: string;
  noWear: boolean;
  note: string;
  photos: LocalPhoto[];
  returnChoice: '' | 'same' | 'damage';
}

const PICKER = { ...IMAGE_LIBRARY_PICKER_OPTIONS, quality: 1 };

function slotsFor(minPhotos: number, existing: InspectionUnit['photos']): LocalPhoto[] {
  const roles = photoRolesForMinimum(minPhotos);
  const used = new Set<string>();
  return roles.map((role, index) => {
    const photo = existing.find((row) => row.role === role && !used.has(row.id));
    if (photo) used.add(photo.id);
    return { key: `${role}-${index}`, role, mediaId: photo?.id, uri: photo?.url };
  });
}

function fromServer(unit: InspectionUnit, minPhotos: number, pickup?: InspectionUnit): LocalUnit {
  const same = pickup && unit.condition && unit.condition === pickup.condition && unit.condition !== 'damaged';
  return {
    unitId: unit.unitId,
    slotIndex: unit.slotIndex,
    displayLabel: unit.displayLabel,
    physicalLabel: unit.physicalLabel ?? '',
    condition: unit.condition === 'good' || unit.condition === 'fair' || unit.condition === 'damaged' ? unit.condition : '',
    accessories: normalizeAccessories(unit.accessories).map((row) => ({ name: row.name, count: String(row.count) })),
    noAccessories: Array.isArray(unit.accessories) && unit.accessories.length === 0 && !!unit.condition,
    wear: unit.wear === 'none' ? '' : unit.wear ?? '',
    noWear: unit.wear === 'none',
    note: '',
    photos: slotsFor(minPhotos, unit.photos),
    returnChoice: unit.condition === 'damaged' ? 'damage' : same ? 'same' : '',
  };
}

function toPayload(unit: LocalUnit, stage: InspectionStage, pickup?: InspectionUnit) {
  if (stage === 'return' && unit.returnChoice === 'same') {
    const copied = sameConditionPayload(pickup);
    return { unitId: unit.unitId, ...copied, checklistNote: unit.note.trim() || undefined, physicalLabel: unit.physicalLabel.trim() || undefined };
  }
  const condition = stage === 'return' && unit.returnChoice === 'damage' ? 'damaged' : unit.condition;
  const wear = stage === 'return' && unit.returnChoice === 'damage'
    ? unit.wear.trim()
    : unit.noWear ? 'none' : unit.wear.trim();
  const accessories = unit.noAccessories
    ? []
    : unit.accessories
        .map((row) => ({ name: row.name.trim(), count: Number(row.count) }))
        .filter((row) => row.name && Number.isInteger(row.count) && row.count >= 1);
  if (condition !== 'good' && condition !== 'fair' && condition !== 'damaged') return null;
  if (!wear) return null;
  return {
    unitId: unit.unitId,
    condition,
    accessories,
    wear,
    checklistNote: unit.note.trim() || undefined,
    physicalLabel: unit.physicalLabel.trim() || undefined,
  };
}

export function useInspectionCapture(bookingId: string, stage: InspectionStage) {
  const { isOffline } = useNetworkStatus();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [view, setView] = useState<InspectionView | null>(null);
  const [pickupView, setPickupView] = useState<InspectionView | null>(null);
  const [units, setUnits] = useState<LocalUnit[]>([]);
  const [index, setIndex] = useState(0);
  const [minPhotos, setMinPhotos] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getBooking(bookingId);
      setBooking(row);
      await openInspectionDraft(bookingId, stage);
      const current = await getInspection(bookingId, stage);
      const pickup = stage === 'return' ? await getInspection(bookingId, 'pickup') : null;
      const floor = current.minPhotos;
      if (floor == null) {
        setMinPhotos(null);
        setError('photo-minimum');
      } else {
        setMinPhotos(floor);
      }
      const withUrls = await hydrateInspectionPhotos(bookingId, current.units);
      const pickupUnits = pickup ? await hydrateInspectionPhotos(bookingId, pickup.units) : [];
      setView({ ...current, units: withUrls });
      setPickupView(pickup ? { ...pickup, units: pickupUnits } : null);
      if (floor != null) {
        setUnits(withUrls.map((unit) => fromServer(unit, floor, pickupUnits.find((row) => row.unitId === unit.unitId))));
      }
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
    } finally {
      setLoading(false);
    }
  }, [bookingId, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = units[index];
  const unsynced = units.some((unit) => unit.photos.some((photo) => photo.pending || photo.failed));

  const update = (patch: Partial<LocalUnit>) => {
    setUnits((prev) => prev.map((unit, unitIndex) => (unitIndex === index ? { ...unit, ...patch } : unit)));
  };

  const addPhoto = async (role: PhotoRole, slotIndex: number) => {
    if (!current) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = permission.granted
      ? await ImagePicker.launchCameraAsync(PICKER)
      : await ImagePicker.launchImageLibraryAsync(PICKER);
    if (result.canceled || !result.assets[0]) return;
    const { supported } = filterSupportedImageAssets(result.assets);
    const asset = supported[0];
    if (!asset) {
      setNotice('unsupported');
      return;
    }
    const contentType = (asset.mimeType || 'image/jpeg').replace('image/jpg', 'image/jpeg');
    const fileSize = asset.fileSize ?? 0;
    const local: LocalPhoto = { key: `${role}-${slotIndex}`, role, uri: asset.uri, pending: isOffline || !fileSize };
    setUnits((prev) => prev.map((unit, unitIndex) => {
      if (unitIndex !== index) return unit;
      const photos = unit.photos.map((photo, photoIndex) => (photoIndex === slotIndex ? local : photo));
      return { ...unit, photos };
    }));
    if (isOffline || !fileSize) return;
    await sendPhoto(index, slotIndex, { uri: asset.uri, contentType, fileSize, role, unitId: current.unitId });
  };

  const sendPhoto = async (
    unitIndex: number,
    slotIndex: number,
    photo: { uri: string; contentType: string; fileSize: number; role: PhotoRole; unitId: string }
  ) => {
    try {
      const saved = await uploadInspectionPhoto({ bookingId, ...photo });
      setUnits((prev) => prev.map((unit, i) => {
        if (i !== unitIndex) return unit;
        const photos = unit.photos.map((row, photoIndex) =>
          photoIndex === slotIndex ? { ...row, mediaId: saved.mediaId, failed: false, pending: false } : row
        );
        return { ...unit, photos };
      }));
    } catch {
      setUnits((prev) => prev.map((unit, i) => {
        if (i !== unitIndex) return unit;
        const photos = unit.photos.map((row, photoIndex) =>
          photoIndex === slotIndex ? { ...row, failed: true, pending: false } : row
        );
        return { ...unit, photos };
      }));
    }
  };

  const retryPhoto = async (slotIndex: number) => {
    const photo = current?.photos[slotIndex];
    if (!photo?.uri || !current || isOffline) return;
    const file = await fetch(photo.uri);
    const blob = await file.blob();
    await sendPhoto(index, slotIndex, {
      uri: photo.uri,
      contentType: blob.type || 'image/jpeg',
      fileSize: blob.size,
      role: photo.role,
      unitId: current.unitId,
    });
  };

  const readyUnits = useMemo(() => {
    if (minPhotos == null) return [];
    return units.map((unit) => {
      const pickup = pickupView?.units.find((row) => row.unitId === unit.unitId);
      const payload = toPayload(unit, stage, pickup);
      const photos = unit.photos.filter((photo) => photo.mediaId).map((photo) => ({ id: photo.mediaId!, role: photo.role }));
      return payload
        ? { ...payload, photos, wear: payload.wear, condition: payload.condition, accessories: payload.accessories, unitId: unit.unitId, slotIndex: unit.slotIndex, displayLabel: unit.displayLabel, physicalLabel: unit.physicalLabel || null }
        : null;
    });
  }, [minPhotos, pickupView?.units, stage, units]);

  const canSubmit =
    minPhotos != null &&
    !unsynced &&
    !isOffline &&
    businessCanReplaceReport(view) &&
    readyUnits.every(Boolean) &&
    reportReadyToSubmit(
      readyUnits
        .filter((row): row is NonNullable<typeof row> => !!row)
        .map((row) => ({
          unitId: row.unitId,
          slotIndex: row.slotIndex,
          displayLabel: row.displayLabel,
          physicalLabel: row.physicalLabel,
          condition: row.condition,
          accessories: row.accessories,
          wear: row.wear,
          photos: row.photos,
        })),
      minPhotos
    );

  const saveAndNext = async () => {
    if (!current || minPhotos == null) return;
    const pickup = pickupView?.units.find((row) => row.unitId === current.unitId);
    const payload = toPayload(current, stage, pickup);
    if (!payload) {
      setNotice('incomplete');
      return;
    }
    setBusy(true);
    try {
      await saveInspectionItems(bookingId, stage, [payload]);
      if (index < units.length - 1) setIndex(index + 1);
      setNotice(null);
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (claimedDamageAmount?: number) => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const items = readyUnits.filter((row): row is NonNullable<typeof row> => !!row);
      await saveInspectionItems(
        bookingId,
        stage,
        items.map((row) => ({
          unitId: row.unitId,
          condition: row.condition,
          accessories: row.accessories,
          wear: row.wear,
          checklistNote: row.checklistNote,
          physicalLabel: row.physicalLabel ?? undefined,
        }))
      );
      await submitInspection(bookingId, stage, claimedDamageAmount);
      await load();
      setNotice('submitted');
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handback = async () => {
    setBusy(true);
    try {
      await recordHandback(bookingId);
      setNotice('handed');
      await load();
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    booking,
    view,
    pickupView,
    units,
    index,
    setIndex,
    current,
    minPhotos,
    loading,
    busy,
    error,
    notice,
    isOffline,
    unsynced,
    canSubmit,
    canHandback: handbackEnabled(view, booking?.units_booked ?? units.length),
    update,
    addPhoto,
    retryPhoto,
    saveAndNext,
    submit,
    handback,
    reload: load,
  };
}
