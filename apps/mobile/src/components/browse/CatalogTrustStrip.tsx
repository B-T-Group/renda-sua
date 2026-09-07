import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrustBadge } from '../common/TrustBadge';
import { useTheme } from '../../contexts/ThemeContext';

export const CatalogTrustStrip = memo(function CatalogTrustStrip() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.badges,
        {
          gap: spacing.xs,
          paddingHorizontal: spacing.xxs,
        },
      ]}
    >
      <TrustBadge
        variant="verified_seller"
        label={t('public.items.trustStrip.verifiedStores', 'Verified stores')}
        inline
      />
      <TrustBadge
        variant="encrypted_payments"
        label={t('public.items.trustStrip.securePayment', 'Secure payment')}
        inline
      />
      <TrustBadge
        variant="fast_delivery"
        label={t('public.items.trustStrip.localDelivery', 'Local delivery')}
        inline
      />
    </View>
  );
});

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});
