import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  uri: string | null;
  label: string;
  onDismiss: () => void;
}

export function WhatsAppInboxImagePreview({
  visible,
  uri,
  label,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          { width, height, backgroundColor: colors.overlayDark },
        ]}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <IconButton
            icon="close"
            iconColor={colors.onDark}
            size={24}
            accessibilityLabel={t('common.close', 'Close')}
            onPress={onDismiss}
          />
        </View>
        <Pressable
          style={styles.body}
          onPress={onDismiss}
          accessibilityRole="image"
          accessibilityLabel={label}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width, height: height * 0.8 }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
