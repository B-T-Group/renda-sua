import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  allowAdd: boolean;
  otherStoreBlocked: boolean;
  onReplace: () => void;
  onAdd: () => void;
  onDismiss: () => void;
};

export function ReorderCartConflictSheet({
  visible,
  allowAdd,
  otherStoreBlocked,
  onReplace,
  onAdd,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleReplace = useCallback(() => {
    onReplace();
  }, [onReplace]);

  const handleAdd = useCallback(() => {
    if (!allowAdd) return;
    onAdd();
  }, [allowAdd, onAdd]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              maxHeight: height * 0.5,
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleMedium"
            style={{ fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm }}
          >
            {t('orders.reorder.conflictTitle', 'Your cart already has items')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginBottom: spacing.md }}
          >
            {otherStoreBlocked
              ? t(
                  'orders.reorder.otherStoreMessage',
                  'Your cart has items from another store. Replace your cart to reorder from this store.'
                )
              : t(
                  'orders.reorder.conflictMessage',
                  'Replace your cart with this order, or add these items to your cart.'
                )}
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button mode="contained" onPress={handleReplace}>
              {t('orders.reorder.replaceCart', 'Replace cart')}
            </Button>
            {allowAdd ? (
              <Button mode="outlined" onPress={handleAdd}>
                {t('orders.reorder.addToCart', 'Add to cart')}
              </Button>
            ) : null}
            <Button mode="text" onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
