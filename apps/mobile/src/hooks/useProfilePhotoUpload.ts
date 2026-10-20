import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useStore } from '../stores/RootStore';
import { uploadProfilePhoto } from '../services/profilePhotoApi';

const IMAGE_LIBRARY_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

export function isSupportedImageAsset(asset: ImagePicker.ImagePickerAsset): boolean {
  if (!asset.mimeType) return true;
  const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return supported.includes(asset.mimeType.toLowerCase());
}

export function useProfilePhotoUpload(options?: { onSuccess?: () => Promise<void> }) {
  const { t } = useTranslation();
  const { auth } = useStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUploadPhoto = useCallback(
    async (source: 'camera' | 'gallery'): Promise<boolean> => {
      try {
        setError(null);
        setUploading(true);

        let result: ImagePicker.ImagePickerResult;
        
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            const msg = t('dedicatedAgents.agent.cameraPermissionDenied', 'Camera permission is required');
            setError(msg);
            Alert.alert(t('common.error', 'Error'), msg);
            return false;
          }
          result = await ImagePicker.launchCameraAsync(IMAGE_LIBRARY_PICKER_OPTIONS);
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            const msg = t('dedicatedAgents.agent.photoPermissionDenied', 'Photo library permission is required');
            setError(msg);
            Alert.alert(t('common.error', 'Error'), msg);
            return false;
          }
          result = await ImagePicker.launchImageLibraryAsync(IMAGE_LIBRARY_PICKER_OPTIONS);
        }

        if (result.canceled || !result.assets[0]?.uri) {
          return false;
        }

        if (!isSupportedImageAsset(result.assets[0])) {
          const msg = t(
            'dedicatedAgents.agent.unsupportedFormat',
            'Unsupported image format. Please use JPEG, PNG, or WebP.'
          );
          setError(msg);
          Alert.alert(t('common.error', 'Error'), msg);
          return false;
        }

        // Save locally first
        await auth.setLocalProfilePhoto(result.assets[0].uri);

        // Upload to server - need user ID
        if (!auth.user?.id) {
          const msg = t('dedicatedAgents.agent.photoError', 'Failed to upload photo');
          setError(msg);
          return false;
        }

        const uploadResult = await uploadProfilePhoto(result.assets[0].uri, auth.user.id);
        
        if (!uploadResult.success) {
          const msg = uploadResult.error || t('dedicatedAgents.agent.photoError', 'Failed to upload photo');
          setError(msg);
          return false;
        }

        // Refresh 'me' profile to get updated photo URL
        // This is handled by the parent component calling the refetch

        // Call success callback if provided (e.g., to re-apply)
        if (options?.onSuccess) {
          await options.onSuccess();
        }

        return true;
      } catch (err: any) {
        const msg = err.message || t('dedicatedAgents.agent.photoError', 'Failed to upload photo');
        setError(msg);
        return false;
      } finally {
        setUploading(false);
      }
    },
    [auth, t, options]
  );

  return {
    uploading,
    error,
    pickAndUploadPhoto,
  };
}
