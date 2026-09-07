import { useEffect, useState } from 'react';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  title: string;
  label: string;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (name: string) => void;
};

export function CreateNameDialog({ visible, title, label, loading, onDismiss, onSubmit }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <TextInput label={label} value={name} onChangeText={setName} mode="outlined" autoFocus />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            loading={loading}
            disabled={loading || !name.trim()}
            onPress={() => onSubmit(name.trim())}
          >
            {t('common.save', 'Save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
