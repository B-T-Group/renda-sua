import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Menu } from 'react-native-paper';

type Props = {
  visible: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  loading?: boolean;
  disabled?: boolean;
  buttonStyle?: object;
};

export function DocumentAddSourceMenu({
  visible,
  onOpen,
  onDismiss,
  onChooseFile,
  onTakePhoto,
  loading,
  disabled,
  buttonStyle,
}: Props) {
  const { t } = useTranslation();

  return (
    <Menu
      visible={visible}
      onDismiss={onDismiss}
      anchor={
        <Button
          mode="outlined"
          icon="plus"
          loading={loading}
          disabled={disabled || loading}
          onPress={onOpen}
          style={buttonStyle}
        >
          {t('documents.add', 'Add document')}
        </Button>
      }
    >
      <Menu.Item
        leadingIcon="file-document-outline"
        onPress={onChooseFile}
        title={t('documents.chooseFile', 'Choose file')}
      />
      <Menu.Item
        leadingIcon="camera"
        onPress={onTakePhoto}
        title={t('documents.takePhoto', 'Take a picture')}
      />
    </Menu>
  );
}
