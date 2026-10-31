import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { DeliveryProofPhotoInput } from '../../types/deliveryConfirmation';

type Props = {
  visible: boolean;
  submitting: boolean;
  errorText?: string | null;
  onDismiss: () => void;
  onCapture: () => Promise<DeliveryProofPhotoInput>;
  onSubmit: (photos: DeliveryProofPhotoInput[], note: string) => void;
};

export function ClientCouldNotConfirmSheet({
  visible,
  submitting,
  errorText,
  onDismiss,
  onCapture,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [photos, setPhotos] = useState<DeliveryProofPhotoInput[]>([]);
  const [note, setNote] = useState('');
  const [captureError, setCaptureError] = useState<string | null>(null);

  const resetAndClose = () => {
    setPhotos([]);
    setNote('');
    setCaptureError(null);
    onDismiss();
  };

  const handleCapture = async () => {
    setCaptureError(null);
    try {
      const photo = await onCapture();
      setPhotos((prev) => [...prev, photo]);
    } catch (e: unknown) {
      setCaptureError(e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={resetAndClose}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: height * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary, paddingHorizontal: spacing.md }}>
            {t('orders.clientConfirm.agentFallbackCta', "Client couldn't confirm")}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, paddingHorizontal: spacing.md, marginTop: spacing.sm }}
          >
            {t('orders.clientConfirm.agentFallbackPhoto', 'Take a photo of the delivered order')}
          </Text>
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
            {photos.map((p) => (
              <Image key={p.photoUrl} source={{ uri: p.photoUrl }} style={styles.preview} resizeMode="cover" />
            ))}
            <Button mode="outlined" icon="camera" onPress={() => void handleCapture()} disabled={submitting}>
              {t('orders.clientConfirm.takePhoto', 'Take photo')}
            </Button>
            <TextInput
              mode="outlined"
              value={note}
              onChangeText={setNote}
              label={t('orders.clientConfirm.photoNoteOptional', 'Note (optional)')}
              disabled={submitting}
            />
            {captureError || errorText ? (
              <Text style={[{ color: colors.error.main }, typography.body2]}>
                {captureError || errorText}
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.md }]}>
            <Button onPress={resetAndClose} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              disabled={submitting || photos.length < 1}
              onPress={() => onSubmit(photos, note)}
            >
              {t('orders.clientConfirm.submitFallback', 'Submit')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: { paddingTop: 20 },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
