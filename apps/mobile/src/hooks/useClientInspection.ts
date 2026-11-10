import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useNetworkStatus } from './useNetworkStatus';
import { getBooking } from '../services/rentalsApi';
import {
  acknowledgeInspection,
  getInspection,
  hydrateInspectionPhotos,
  uploadInspectionPhoto,
} from '../services/rentalInspectionApi';
import { filterSupportedImageAssets, IMAGE_LIBRARY_PICKER_OPTIONS } from '../utils/supportedImageFormats';
import {
  classifyInspectionError,
  correctionReasonText,
  normalizeAccessories,
  type InspectionStage,
  type InspectionView,
} from '../utils/rentals/rentalInspection';
import type { LocalPhoto } from './useInspectionCapture';
import type { RentalBookingDetail } from '../types/rentals';

const PICKER = { ...IMAGE_LIBRARY_PICKER_OPTIONS, quality: 1 };

export function useClientInspection(bookingId: string, stage: InspectionStage) {
  const { isOffline } = useNetworkStatus();
  const [booking, setBooking] = useState<RentalBookingDetail | null>(null);
  const [view, setView] = useState<InspectionView | null>(null);
  const [index, setIndexState] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [counterPhotos, setCounterPhotos] = useState<LocalPhoto[]>([
    { key: 'counter-0', role: 'counter' },
    { key: 'counter-1', role: 'counter' },
  ]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [baselineMissing, setBaselineMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getBooking(bookingId);
      setBooking(row);
      const current = await getInspection(bookingId, stage);
      const units = await hydrateInspectionPhotos(bookingId, current.units.map((unit) => ({
        ...unit,
        accessories: normalizeAccessories(unit.accessories),
      })));
      setView({ ...current, units });
      if (units[0]) setSeen(new Set([units[0].unitId]));
      if (stage === 'return') {
        try {
          const pickup = await getInspection(bookingId, 'pickup');
          setBaselineMissing(!pickup.units.some((row) => row.photos.length > 0));
        } catch {
          setBaselineMissing(true);
        }
      } else {
        setBaselineMissing(false);
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

  const setIndex = (next: number) => {
    setIndexState(next);
    const id = view?.units[next]?.unitId;
    if (id) setSeen((prev) => new Set(prev).add(id));
  };

  const accept = async () => {
    if (!view?.versionId || isOffline) return;
    setBusy(true);
    try {
      await acknowledgeInspection(bookingId, stage, { versionId: view.versionId, decision: 'accept' });
      setNotice('accepted');
      await load();
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const sendReason = async (
    decision: 'correction' | 'dispute',
    codes: string[],
    details: string,
    labels: Record<string, string>
  ) => {
    if (!view?.versionId || isOffline) return;
    const reason = correctionReasonText(codes, details, labels);
    if (!reason.trim()) {
      setNotice('reason');
      return;
    }
    setBusy(true);
    try {
      await acknowledgeInspection(bookingId, stage, { versionId: view.versionId, decision, reason });
      setNotice(decision === 'dispute' ? 'disputed' : 'correction');
      await load();
    } catch (err: unknown) {
      setError(classifyInspectionError(err));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const placeCounter = async (slot: number, uri: string, contentType: string, fileSize: number) => {
    const unitId = view?.units[index]?.unitId;
    if (!unitId) return;
    if (isOffline || !fileSize) {
      setCounterPhotos((prev) => prev.map((row, i) => (i === slot ? { ...row, uri, pending: true, failed: false } : row)));
      return;
    }
    try {
      const saved = await uploadInspectionPhoto({
        bookingId,
        unitId,
        role: 'counter',
        uri,
        contentType,
        fileSize,
      });
      setCounterPhotos((prev) => prev.map((row, i) => (i === slot ? { ...row, uri, mediaId: saved.mediaId, pending: false, failed: false } : row)));
    } catch {
      setCounterPhotos((prev) => prev.map((row, i) => (i === slot ? { ...row, uri, failed: true, pending: false } : row)));
    }
  };

  const addCounter = async (slot: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync(PICKER);
    if (result.canceled) return;
    const asset = filterSupportedImageAssets(result.assets).supported[0];
    if (!asset) return;
    const contentType = (asset.mimeType || 'image/jpeg').replace('image/jpg', 'image/jpeg');
    await placeCounter(slot, asset.uri, contentType, asset.fileSize ?? 0);
  };

  const retryCounter = async (slot: number) => {
    const photo = counterPhotos[slot];
    if (!photo?.uri) return;
    const file = await fetch(photo.uri);
    const blob = await file.blob();
    await placeCounter(slot, photo.uri, blob.type || 'image/jpeg', blob.size);
  };

  return {
    booking,
    view,
    index,
    setIndex,
    seen,
    counterPhotos,
    loading,
    busy,
    error,
    notice,
    isOffline,
    baselineMissing,
    accept,
    sendReason,
    addCounter,
    retryCounter,
    reload: load,
  };
}
