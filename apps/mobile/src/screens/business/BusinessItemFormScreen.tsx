import React, { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Snackbar } from 'react-native-paper';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessItemForm } from '../../hooks/business/useBusinessItemForm';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { BusinessItemFormView } from './BusinessItemFormView';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessItemForm'>;

export default function BusinessItemFormScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const form = useBusinessItemForm(itemId);
  const [snack, setSnack] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.items.editItem', 'Edit Item'),
    });
  }, [navigation, t]);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground }]}>
      <BusinessItemFormView
        itemId={itemId}
        form={form}
        onSaveSuccess={() => {
          setSnack(t('business.items.updated', 'Item updated'));
          navigation.goBack();
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
