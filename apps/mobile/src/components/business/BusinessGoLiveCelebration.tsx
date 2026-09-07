import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme';
import { ProductLiveSuccessVector } from '../feedback/ProductLiveSuccessVector';

type Props = {
  visible: boolean;
  mainInterest: 'sell_items' | 'rent_items';
  onPreviewStore: () => void;
  onAddProduct: () => void;
  onDismiss: () => void;
};

export function BusinessGoLiveCelebration({
  visible,
  mainInterest,
  onPreviewStore,
  onAddProduct,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isRental = mainInterest === 'rent_items';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.text.primary + '66' }]}
        onPress={onDismiss}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: height * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              marginHorizontal: spacing.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}
            bounces={false}
          >
            <ProductLiveSuccessVector playToken={visible ? 1 : 0} />
            <Text
              variant="headlineSmall"
              style={{
                color: colors.text.primary,
                textAlign: 'center',
                marginTop: spacing.md,
              }}
            >
              {t('business.goLive.title', 'Your store is live!')}
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                color: colors.text.secondary,
                textAlign: 'center',
                marginTop: spacing.sm,
              }}
            >
              {isRental
                ? t(
                    'business.goLive.bodyRental',
                    'Customers can discover your rentals and request bookings. Keep your catalog fresh and share your store.'
                  )
                : t(
                    'business.goLive.body',
                    'Customers can discover your products and place orders. Keep your catalog fresh and share your store.'
                  )}
            </Text>
          </ScrollView>

          <View style={[styles.actions, { paddingHorizontal: spacing.lg, gap: spacing.sm }]}>
            <Button mode="outlined" onPress={onPreviewStore}>
              {t('stores.previewCtaButton', 'Preview store')}
            </Button>
            <Button mode="outlined" onPress={onAddProduct}>
              {isRental
                ? t('business.goLive.ctaAddRental', 'Add a rental')
                : t('business.goLive.ctaAddProduct', 'Add a product')}
            </Button>
            <Button mode="contained" onPress={onDismiss}>
              {t('business.goLive.ctaContinue', 'Continue to dashboard')}
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
    justifyContent: 'center',
  },
  sheet: {
    overflow: 'hidden',
  },
  actions: {
    paddingBottom: 8,
  },
});
