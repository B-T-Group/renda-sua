import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import type { Order } from '../../types/agent';
import { buildAgentClaimConfirmBody } from '../../utils/agentClaimConfirmPrompt';

export interface AgentClaimConfirmDialogProps {
  visible: boolean;
  order: Order | null;
  holdAmount: number;
  onDismiss: () => void;
  onConfirm: () => void;
}

export function AgentClaimConfirmDialog({
  visible,
  order,
  holdAmount,
  onDismiss,
  onConfirm,
}: AgentClaimConfirmDialogProps) {
  const { t } = useTranslation();

  const body = useMemo(() => {
    if (!order) return '';
    try {
      return buildAgentClaimConfirmBody(order, holdAmount, t);
    } catch {
      return t('orders.confirmClaimOrderMessage', {
        orderNumber: String(order.order_number ?? ''),
        defaultValue: 'Are you sure you want to claim order #{{orderNumber}}?',
      });
    }
  }, [holdAmount, order, t]);

  if (!order) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('orders.confirmClaimOrder', { defaultValue: 'Confirm claim' })}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{body}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('common.cancel')}</Button>
          <Button mode="contained" onPress={onConfirm}>
            {t('orderActions.claimOrder', { defaultValue: 'Claim Order' })}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
