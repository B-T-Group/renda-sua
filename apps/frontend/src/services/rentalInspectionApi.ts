import type { AxiosInstance } from 'axios';
import type {
  InspectionStage,
  InspectionUnit,
  InspectionView,
  PhotoRole,
  PickupPhotoRules,
} from '../utils/rentalInspection';

function root(bookingId: string): string {
  return `/rentals/bookings/${bookingId}/inspections`;
}

export function createRentalInspectionApi(api: AxiosInstance) {
  return {
    get: (bookingId: string, stage: InspectionStage) =>
      api.get<InspectionView>(`${root(bookingId)}/${stage}`).then((res) => res.data),
    openDraft: (bookingId: string, stage: InspectionStage) =>
      api.post(`${root(bookingId)}/${stage}/draft`).then((res) => res.data),
    saveItems: (
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
    ) => api.put(`${root(bookingId)}/${stage}/items`, { items }).then((res) => res.data),
    submit: (bookingId: string, stage: InspectionStage, claimedDamageAmount?: number) =>
      api.post(`${root(bookingId)}/${stage}/submit`, claimedDamageAmount == null ? {} : { claimedDamageAmount }).then((res) => res.data),
    acknowledge: (
      bookingId: string,
      stage: InspectionStage,
      body: { versionId: string; decision: 'accept' | 'correction' | 'dispute'; reason?: string }
    ) => api.post(`${root(bookingId)}/${stage}/acknowledgements`, body).then((res) => res.data),
    handback: (bookingId: string) =>
      api.post(`${root(bookingId)}/return/handback`).then((res) => res.data),
    photoRules: (bookingId: string) =>
      api.get<PickupPhotoRules>(`${root(bookingId)}/pickup/photo-rules`).then((res) => res.data),
    applyGuide: (bookingId: string, mode: 'guide' | 'blank') =>
      api.post<PickupPhotoRules>(`${root(bookingId)}/pickup/guide`, { mode }).then((res) => res.data),
    skipSlot: (bookingId: string, body: { unitId: string; slotKey: string; reason: string }) =>
      api.post(`${root(bookingId)}/pickup/slot-skips`, body).then((res) => res.data),
    photoUrl: (bookingId: string, mediaId: string) =>
      api
        .get<{ url: string; expiresAt: string }>(`${root(bookingId)}/evidence/${mediaId}/url`)
        .then((res) => res.data),
    upload: async (input: {
      bookingId: string;
      unitId: string;
      role: PhotoRole;
      file: File;
    }) => {
      const contentType = input.file.type === 'image/jpg' ? 'image/jpeg' : input.file.type;
      const signed = await api
        .post<{ mediaId: string; uploadUrl: string; headers: Record<string, string> }>(
          `${root(input.bookingId)}/evidence/presign`,
          {
            unitId: input.unitId,
            role: input.role,
            contentType,
            fileSize: input.file.size,
          }
        )
        .then((res) => res.data);
      const uploaded = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: signed.headers,
        body: input.file,
      });
      if (!uploaded.ok) {
        throw Object.assign(new Error('Photo upload failed'), { status: uploaded.status });
      }
      await api.post(`${root(input.bookingId)}/evidence/${signed.mediaId}/finalize`);
      return { mediaId: signed.mediaId };
    },
  };
}

export async function hydrateInspectionPhotos(
  api: ReturnType<typeof createRentalInspectionApi>,
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
            const signed = await api.photoUrl(bookingId, photo.id);
            return { ...photo, url: signed.url, expiresAt: signed.expiresAt };
          } catch {
            return photo;
          }
        })
      ),
    }))
  );
}
