import React from 'react';
import { Portal, Dialog, Button, Text } from 'react-native-paper';

export interface SimpleMessageDialogProps {
  visible: boolean;
  title: string;
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}

export function SimpleMessageDialog({
  visible,
  title,
  message,
  dismissLabel,
  onDismiss,
}: SimpleMessageDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{dismissLabel}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
