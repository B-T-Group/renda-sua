import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { usePurchaseCredits } from '../../hooks/usePurchaseCredits';
import { StoreCreditsIllustration } from '../../components/illustrations/StoreCreditsIllustration';
import { formatCurrency } from '../../utils/formatters';
import {
  purchaseCreditScopeLabel,
  purchaseCreditShopTarget,
} from '../../utils/purchaseCredits';
import type { PurchaseCreditGrant } from '../../types/purchaseCredits';
import type { PurchaseCreditShopTarget } from '../../types/purchaseCredits';

type Nav = NativeStackNavigationProp<Record<string, object | undefined>>;

function GrantCard({
  grant,
  onShop,
}: {
  grant: PurchaseCreditGrant;
  onShop: (target: PurchaseCreditShopTarget) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const target = purchaseCreditShopTarget(grant);
  const shopLabel =
    target.kind === 'store'
      ? t('accounts.purchaseCredits.shopStore', 'Shop this store')
      : target.kind === 'partners'
        ? t('accounts.purchaseCredits.shopPartners', 'Browse partner stores')
        : t('accounts.purchaseCredits.shopAny', 'Browse stores');

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {formatCurrency(grant.remaining_amount, grant.currency)}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t('accounts.purchaseCredits.ofOriginal', '{{remaining}} of {{original}} remaining', {
          remaining: formatCurrency(grant.remaining_amount, grant.currency),
          original: formatCurrency(grant.amount, grant.currency),
        })}
      </Text>
      {grant.memo ? (
        <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
          {grant.memo}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {purchaseCreditScopeLabel(grant, t)}
      </Text>
      {grant.expires_at ? (
        <Text variant="labelSmall" style={{ color: colors.warning.dark }}>
          {t('accounts.purchaseCredits.expires', 'Expires')} {grant.expires_at.slice(0, 10)}
        </Text>
      ) : null}
      <Button mode="contained" onPress={() => onShop(target)}>
        {shopLabel}
      </Button>
    </View>
  );
}

export default function UserPurchaseCreditsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { usable, loading, error, refresh } = usePurchaseCredits(true);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onShop = useCallback(
    (target: PurchaseCreditShopTarget) => {
      if (target.kind === 'store') {
        navigation.navigate('StoreDetail', { businessId: target.businessId });
        return;
      }
      if (target.kind === 'partners') {
        navigation.navigate('StoresList', { partnersOnly: true });
        return;
      }
      navigation.navigate('StoresList');
    },
    [navigation]
  );

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
        }
      >
        <Text variant="headlineSmall" style={{ color: colors.text.primary, fontWeight: '800' }}>
          {t('accounts.purchaseCredits.title', 'Store credits')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'accounts.purchaseCredits.note',
            'These credits cannot be withdrawn. They apply automatically at checkout to item prices (not delivery or deposits).'
          )}
        </Text>

        {loading && usable.length === 0 ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} />
        ) : null}
        {error ? (
          <Text style={{ color: colors.error.main }}>{error}</Text>
        ) : null}

        {!loading && usable.length === 0 ? (
          <View style={[styles.empty, { gap: spacing.md }]}>
            <StoreCreditsIllustration
              size={120}
              accessibilityLabel={t(
                'accounts.purchaseCredits.illustrationLabel',
                'Store credits'
              )}
            />
            <Text variant="bodyLarge" style={{ textAlign: 'center', color: colors.text.secondary }}>
              {t('accounts.purchaseCredits.empty', 'No store credits yet.')}
            </Text>
            <Button mode="contained" onPress={() => navigation.navigate('StoresList')}>
              {t('accounts.purchaseCredits.browseStores', 'Browse stores')}
            </Button>
          </View>
        ) : null}

        {usable.map((grant) => (
          <GrantCard key={grant.id} grant={grant} onShop={onShop} />
        ))}

        <Pressable onPress={() => navigation.navigate('UserPaymentPrograms')}>
          <Text
            variant="bodySmall"
            style={{ color: colors.primary.main, textAlign: 'center', marginTop: spacing.sm }}
          >
            {t('accounts.walletHub.otherPrograms', 'Other wallet programs')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: 32 },
});
