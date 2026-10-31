import * as Location from 'expo-location';
import { awsApi, buildS3PublicUrl, S3_BUCKET } from './awsApi';
import { pickCameraPhoto } from '../utils/documentPickers';
import type { DeliveryProofPhotoInput } from '../types/deliveryConfirmation';

export class DeliveryProofUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryProofUploadError';
  }
}

async function readFileBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new DeliveryProofUploadError('Could not read the photo.');
  return res.blob();
}

async function readCaptureGps(): Promise<{ latitude: number; longitude: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new DeliveryProofUploadError('Location is required for the delivery photo.');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

async function uploadProofBlob(
  orderId: string,
  blob: Blob,
  fileName: string,
  contentType: string
): Promise<string> {
  const presigned = await awsApi.presignImageUpload({
    bucketName: S3_BUCKET,
    originalFileName: fileName,
    contentType,
    prefix: `orders/${orderId}/delivery-proof`,
  });
  if (!presigned.success || !presigned.data?.url || !presigned.data?.key) {
    throw new DeliveryProofUploadError(presigned.error || 'Failed to prepare photo upload');
  }
  const putRes = await fetch(presigned.data.url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putRes.ok) throw new DeliveryProofUploadError('Failed to upload the photo.');
  return buildS3PublicUrl(presigned.data.key);
}

/** Camera capture → S3 → geotagged payload for POST client-could-not-confirm. */
export async function captureAndUploadDeliveryProof(
  orderId: string,
  note?: string
): Promise<DeliveryProofPhotoInput> {
  const picked = await pickCameraPhoto();
  if (!picked.ok) {
    if (picked.reason === 'canceled') {
      throw new DeliveryProofUploadError('Photo capture was cancelled.');
    }
    if (picked.reason === 'permission_denied') {
      throw new DeliveryProofUploadError('Camera access is required.');
    }
    throw new DeliveryProofUploadError(picked.message || 'Could not take a photo.');
  }
  const gps = await readCaptureGps();
  const blob = await readFileBlob(picked.file.uri);
  const photoUrl = await uploadProofBlob(
    orderId,
    blob,
    picked.file.fileName,
    picked.file.contentType
  );
  return {
    photoUrl,
    capturedAt: new Date().toISOString(),
    latitude: gps.latitude,
    longitude: gps.longitude,
    note: note?.trim() || undefined,
  };
}
