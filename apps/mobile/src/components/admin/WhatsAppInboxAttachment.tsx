import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { WhatsAppInboxImagePreview } from './WhatsAppInboxImagePreview';
import { useWhatsAppInboxMedia } from '../../hooks/useWhatsAppInboxMedia';
import { toShareableWhatsAppUri } from '../../services/whatsappInboxMediaCache';
import { useTheme } from '../../contexts/ThemeContext';
import type { WhatsAppInboxMessage } from '../../types/whatsappInbox';
import { whatsappMapsUrl } from '../../utils/whatsappInboxMedia';

interface Props {
  message: WhatsAppInboxMessage;
  inbound: boolean;
}

export function WhatsAppInboxAttachment({ message, inbound }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { uri, loading, error, load, inline, media } = useWhatsAppInboxMedia(
    message
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const actionColor = inbound ? colors.primary.main : colors.primary.contrast;
  const imageLabel = t('admin.whatsappInbox.imageAccessibility', 'WhatsApp image');

  const openFile = useCallback(async () => {
    const path = uri || (await load());
    if (!path) return;
    try {
      await Share.share({ url: await toShareableWhatsAppUri(path) });
    } catch {
      await Linking.openURL(path);
    }
  }, [load, uri]);

  const openMap = useCallback(() => {
    if (media?.latitude == null || media.longitude == null) return;
    void Linking.openURL(whatsappMapsUrl(media.latitude, media.longitude));
  }, [media?.latitude, media?.longitude]);

  if (!media?.id && media?.latitude == null) return null;

  return (
    <View style={{ marginBottom: spacing.xs }}>
      {inline ? (
        <InlineImage
          uri={uri}
          loading={loading}
          onPress={() => {
            if (uri) setPreviewOpen(true);
          }}
          label={imageLabel}
        />
      ) : null}
      <WhatsAppInboxImagePreview
        visible={previewOpen}
        uri={uri}
        label={imageLabel}
        onDismiss={() => setPreviewOpen(false)}
      />
      {error ? (
        <Text style={{ color: inbound ? colors.error.main : colors.primary.contrast }}>
          {t('admin.whatsappInbox.mediaLoadError', 'Could not load attachment')}
        </Text>
      ) : null}
      {media?.latitude != null && media.longitude != null ? (
        <Button compact mode="text" textColor={actionColor} onPress={openMap}>
          {t('admin.whatsappInbox.openMap', 'Open in Maps')}
        </Button>
      ) : null}
      {media?.id && !inline ? (
        <Button
          compact
          mode="text"
          textColor={actionColor}
          loading={loading}
          onPress={() => void openFile()}
        >
          {openLabel(message.type, media.filename, t)}
        </Button>
      ) : null}
    </View>
  );
}

function openLabel(
  type: string,
  filename: string | null,
  t: (key: string, fallback: string) => string
): string {
  if (filename) return filename;
  if (type === 'audio') return t('admin.whatsappInbox.playAudio', 'Play audio');
  if (type === 'video') return t('admin.whatsappInbox.openVideo', 'Open video');
  return t('admin.whatsappInbox.openAttachment', 'Open attachment');
}

function InlineImage({
  uri,
  loading,
  onPress,
  label,
}: {
  uri: string | null;
  loading: boolean;
  onPress: () => void;
  label: string;
}) {
  if (loading && !uri) {
    return <ActivityIndicator style={styles.spinner} />;
  }
  if (!uri) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={label}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: 220, height: 160, borderRadius: 8 },
  spinner: { alignSelf: 'flex-start', marginVertical: 8 },
});
