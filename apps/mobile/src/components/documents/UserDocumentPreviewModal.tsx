import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

interface UserDocumentPreviewModalProps {
  visible: boolean;
  fileName: string | null;
  url: string | null;
  loading: boolean;
  error: string | null;
  onDismiss: () => void;
  onOpenExternally: () => void;
}

/**
 * Fullscreen image preview for a user document. Non-image documents are
 * opened externally by the caller instead of through this modal.
 */
export function UserDocumentPreviewModal({
  visible,
  fileName,
  url,
  loading,
  error,
  onDismiss,
  onOpenExternally,
}: UserDocumentPreviewModalProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (visible) setImageFailed(false);
  }, [visible, url]);

  const showError = !!error || imageFailed;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { width, height, backgroundColor: colors.overlayDark }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text
            style={[styles.headerTitle, { color: colors.onDark }, typography.body2]}
            numberOfLines={1}
          >
            {fileName ?? ''}
          </Text>
          <IconButton
            icon="close"
            iconColor={colors.onDark}
            size={24}
            accessibilityLabel={t('common.close', 'Close')}
            onPress={onDismiss}
          />
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.onDark} />
              <Text style={[styles.stateText, { color: colors.onDark }]} variant="bodyMedium">
                {t('documents.previewLoading', 'Loading preview…')}
              </Text>
            </View>
          ) : showError ? (
            <View style={styles.centered}>
              <Text style={[styles.stateText, { color: colors.onDark }]} variant="bodyMedium">
                {error ?? t('documents.previewError', 'Could not load the preview.')}
              </Text>
              {url ? (
                <Button
                  mode="contained"
                  onPress={onOpenExternally}
                  style={styles.stateButton}
                >
                  {t('documents.openExternally', 'Open in browser')}
                </Button>
              ) : null}
            </View>
          ) : url ? (
            <Image
              source={{ uri: url }}
              style={{ width, height: height * 0.7 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={fileName ?? undefined}
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </View>

        {!loading && !showError && url ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              mode="outlined"
              icon="open-in-new"
              textColor={colors.onDark}
              style={[styles.footerButton, { borderColor: colors.onDark + '66' }]}
              onPress={onOpenExternally}
            >
              {t('documents.openExternally', 'Open in browser')}
            </Button>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 4,
  },
  headerTitle: { flex: 1, minWidth: 0, fontWeight: '600' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center', paddingHorizontal: 32 },
  stateText: { marginTop: 12, textAlign: 'center' },
  stateButton: { marginTop: 16 },
  footer: { alignItems: 'center', paddingHorizontal: 24 },
  footerButton: { alignSelf: 'stretch' },
});
