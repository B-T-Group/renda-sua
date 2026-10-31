import type { DeliveryProofPhotoInput } from '../types/deliveryConfirmation';

const DEFAULT_BUCKET = process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

export function publicS3Url(key: string, bucketName = DEFAULT_BUCKET): string {
  return `https://${bucketName}.s3.amazonaws.com/${key}`;
}

export async function readBrowserGps(): Promise<{ latitude: number; longitude: number }> {
  if (!navigator.geolocation) {
    throw new Error('Location is required for the delivery photo.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => reject(new Error('Location is required for the delivery photo.')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export async function putFileToPresignedUrl(
  url: string,
  file: File
): Promise<void> {
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/jpeg' },
    body: file,
  });
  if (!putRes.ok) throw new Error('Failed to upload the photo.');
}

export function toProofPhotoInput(
  photoUrl: string,
  gps: { latitude: number; longitude: number },
  note?: string
): DeliveryProofPhotoInput {
  return {
    photoUrl,
    capturedAt: new Date().toISOString(),
    latitude: gps.latitude,
    longitude: gps.longitude,
    note: note?.trim() || undefined,
  };
}
