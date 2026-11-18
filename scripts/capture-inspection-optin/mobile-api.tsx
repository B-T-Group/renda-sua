import React from 'react';
import { bodyFor, sceneName } from './fixtures';

export async function apiRequest(endpoint: string, options?: { method?: string }) {
  return bodyFor(endpoint, options?.method ?? 'GET', sceneName());
}

export async function apiRequestBlob() {
  return { blob: new Blob(), mimeType: 'image/png' };
}

export function resolveApiUrl(endpoint: string) {
  return endpoint;
}

export async function publicApiGet(endpoint: string) {
  return bodyFor(endpoint, 'GET', sceneName());
}

export async function publicApiPost(endpoint: string) {
  return bodyFor(endpoint, 'POST', sceneName());
}

export const api = {
  get: (endpoint: string) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint: string) => apiRequest(endpoint, { method: 'POST' }),
  put: (endpoint: string) => apiRequest(endpoint, { method: 'PUT' }),
  patch: (endpoint: string) => apiRequest(endpoint, { method: 'PATCH' }),
  delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' }),
};

const FLAGS = {
  rentals_inspection_optin_enabled: true,
  rentals_inspection_confirmations_enabled: false,
  rentals_pickup_photo_rules_enabled: false,
};

export function useClientFlags() {
  return { flags: FLAGS, loading: false, refresh: async () => undefined };
}

export function ClientFlagsProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export const MediaTypeOptions = { Images: 'Images', Videos: 'Videos', All: 'All' };
export const UIImagePickerPreferredAssetRepresentationMode = { Automatic: 'automatic', Compatible: 'compatible', Current: 'current' };

const denied = async () => ({ granted: false, status: 'denied', canAskAgain: false, expires: 'never' });
const canceled = async () => ({ canceled: true, assets: [] as never[] });

export const requestCameraPermissionsAsync = denied;
export const requestMediaLibraryPermissionsAsync = denied;
export const launchCameraAsync = canceled;
export const launchImageLibraryAsync = canceled;
export const getCameraPermissionsAsync = denied;
export const getMediaLibraryPermissionsAsync = denied;

export function addEventListener() {
  return () => undefined;
}

export function fetch() {
  return Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' });
}

const storage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
  clear: async () => undefined,
  getAllKeys: async () => [] as string[],
  multiGet: async () => [] as string[][],
  multiSet: async () => undefined,
};

export const AsyncStorage = storage;
export default storage;

export function useHeaderHeight() {
  return 0;
}
