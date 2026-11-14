import { apiRequest } from './apiClient';
import type {
  InspectionStage,
  InspectionUnit,
  InspectionView,
  PhotoRole,
  PickupPhotoRules,
} from '../utils/rentals/rentalInspection';

export interface InspectionPresign {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
  headers: Record<string, string>;
  capturedAt?: string;
}

function root(bookingId: string): string {
  return `/rentals/bookings/${encodeURIComponent(bookingId)}/inspections`;
}

export async function openInspectionDraft(
  bookingId: string,
  stage: InspectionStage
): Promise<{ inspectionId: string; units: Array<{ id: string; slotIndex: number; displayLabel: string }> }> {
  return apiRequest(`${root(bookingId)}/${stage}/draft`, { method: 'POST' });
}

export async function saveInspectionItems(
  bookingId: string,
  stage: InspectionStage,
  items: Array<{
    unitId: string;
    condition: 'good' | 'fair' | 'damaged';
    accessories: Array<{ name: string; count: number }>;
    wear: string;
    checklistNote?: string;
    physicalLabel?: string;
    guideUnconfirmed?: string[];
  }>
): Promise<{ success: boolean }> {
  return apiRequest(`${root(bookingId)}/${stage}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function submitInspection(
  bookingId: string,
  stage: InspectionStage,
  claimedDamageAmount?: number
): Promise<{ versionId: string; versionNo?: number }> {
  return apiRequest(`${root(bookingId)}/${stage}/submit`, {
    method: 'POST',
    body: JSON.stringify(
      claimedDamageAmount == null ? {} : { claimedDamageAmount }
    ),
  });
}

export async function getInspection(
  bookingId: string,
  stage: InspectionStage
): Promise<InspectionView> {
  return apiRequest(`${root(bookingId)}/${stage}`);
}

export async function acknowledgeInspection(
  bookingId: string,
  stage: InspectionStage,
  body: { versionId: string; decision: 'accept' | 'correction' | 'dispute'; reason?: string }
): Promise<Record<string, unknown>> {
  return apiRequest(`${root(bookingId)}/${stage}/acknowledgements`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function recordHandback(bookingId: string): Promise<{ handedBack: boolean; serverAt: string }> {
  return apiRequest(`${root(bookingId)}/return/handback`, { method: 'POST' });
}

export async function getPickupPhotoRules(bookingId: string): Promise<PickupPhotoRules> {
  return apiRequest(`${root(bookingId)}/pickup/photo-rules`);
}

export async function applyPickupGuide(
  bookingId: string,
  mode: 'guide' | 'blank'
): Promise<PickupPhotoRules> {
  return apiRequest(`${root(bookingId)}/pickup/guide`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function clearPickupSlot(
  bookingId: string,
  body: { unitId: string; slotKey: string }
): Promise<{ cleared: boolean }> {
  return apiRequest(`${root(bookingId)}/pickup/slot-skips/clear`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function skipPickupSlot(
  bookingId: string,
  body: { unitId: string; slotKey: string; reason: string }
): Promise<{ saved: boolean }> {
  return apiRequest(`${root(bookingId)}/pickup/slot-skips`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function presignInspectionPhoto(
  bookingId: string,
  body: { unitId: string; role: PhotoRole; contentType: string; fileSize: number; slotKey?: string }
): Promise<InspectionPresign> {
  return apiRequest(`${root(bookingId)}/evidence/presign`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function finalizeInspectionPhoto(
  bookingId: string,
  mediaId: string
): Promise<{ mediaId: string; status: string }> {
  return apiRequest(`${root(bookingId)}/evidence/${encodeURIComponent(mediaId)}/finalize`, {
    method: 'POST',
  });
}

export async function inspectionPhotoUrl(
  bookingId: string,
  mediaId: string
): Promise<{ mediaId: string; url: string; expiresAt: string }> {
  return apiRequest(`${root(bookingId)}/evidence/${encodeURIComponent(mediaId)}/url`);
}

export async function uploadInspectionPhoto(input: {
  bookingId: string;
  unitId: string;
  role: PhotoRole;
  uri: string;
  contentType: string;
  fileSize: number;
  slotKey?: string;
}): Promise<{ mediaId: string; capturedAt?: string }> {
  const signed = await presignInspectionPhoto(input.bookingId, {
    unitId: input.unitId,
    role: input.role,
    contentType: input.contentType,
    fileSize: input.fileSize,
    slotKey: input.slotKey,
  });
  const file = await fetch(input.uri);
  const blob = await file.blob();
  const uploaded = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: blob,
  });
  if (!uploaded.ok) {
    throw Object.assign(new Error('Photo upload failed'), { status: uploaded.status });
  }
  const ready = await finalizeInspectionPhoto(input.bookingId, signed.mediaId);
  return { mediaId: ready.mediaId, capturedAt: signed.capturedAt };
}

export async function hydrateInspectionPhotos(
  bookingId: string,
  units: InspectionUnit[]
): Promise<InspectionUnit[]> {
  return Promise.all(
    units.map(async (unit) => ({
      ...unit,
      photos: await Promise.all(
        unit.photos.map(async (photo) => {
          if (photo.url) return photo;
          try {
            const signed = await inspectionPhotoUrl(bookingId, photo.id);
            return { ...photo, url: signed.url, expiresAt: signed.expiresAt };
          } catch {
            return photo;
          }
        })
      ),
    }))
  );
}
