import { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { BottomSheet } from '../common/BottomSheet';

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
  const { colors, spacing } = useTheme();
  const handleAdd = useCallback(() => {
    if (!allowAdd) return;
    onAdd();
  }, [allowAdd, onAdd]);

  return (
    <BottomSheet visible={visible} onClose={onDismiss} title={t('orders.reorder.conflictTitle', 'Your cart already has items')}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {otherStoreBlocked
          ? t('orders.reorder.otherStoreMessage', 'Your cart has items from another store. Replace your cart to reorder from this store.')
          : t('orders.reorder.conflictMessage', 'Replace your cart with this order, or add these items to your cart.')}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Button mode="contained" onPress={onReplace}>
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
    </BottomSheet>
  );
}
