import React, { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import { ItemFulfillmentIllustration } from '../../components/illustrations/ItemFulfillmentIllustration';
import { ItemFulfillmentMethods } from '../../components/business/ItemFulfillmentMethods';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessItemFulfillment } from '../../hooks/business/useBusinessItemFulfillment';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { isShippingPriceValid } from '../../utils/itemFulfillment';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessItemFulfillment'
>;

export default function BusinessItemFulfillmentScreen({
  route,
  navigation,
}: Props) {
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const form = useBusinessItemFulfillment(itemId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.items.fulfillment.navTitle', 'Fulfillment'),
    });
  }, [navigation, t]);

  const canSave =
    !form.saving &&
    isShippingPriceValid(form.shippingEnabled, form.shippingPrice);

  const handleSave = async () => {
    const ok = await form.save();
    if (ok) navigation.goBack();
  };

  if (form.loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
      >
        <ItemFulfillmentIllustration />
        <Text
          variant="titleMedium"
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: spacing.md,
          }}
        >
          {t(
            'business.items.fulfillment.question',
            'How can customers get this product?'
          )}
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: colors.text.secondary,
            marginTop: spacing.xs,
            textAlign: 'center',
          }}
        >
          {t(
            'business.items.fulfillment.subtitle',
            'Delivery by a Rendasua agent is always included.'
          )}
        </Text>
        <View style={{ marginTop: spacing.lg }}>
          <ItemFulfillmentMethods
            pickupEnabled={form.pickupEnabled}
            shippingEnabled={form.shippingEnabled}
            shippingPrice={form.shippingPrice}
            currency={form.currency}
            onPickupChange={form.setPickupEnabled}
            onShippingChange={form.setShippingEnabled}
            onShippingPriceChange={form.setShippingPrice}
          />
        </View>
        <Button
          mode="contained"
          onPress={() => void handleSave()}
          disabled={!canSave}
          loading={form.saving}
          style={{ marginTop: spacing.lg }}
        >
          {t('business.items.saveChanges', 'Save changes')}
        </Button>
      </KeyboardAwareScrollView>
      <Snackbar
        visible={!!form.error}
        onDismiss={form.dismissError}
        duration={4000}
      >
        {form.error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
