import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileMe } from '@/hooks/useProfileMe';
import {
  useReelAiTokens,
  type ReelAiTokenPackId,
} from '@/hooks/business/useReelAiTokens';
import PhoneNumberInput from '@/components/PhoneNumberInput';
import {
  nationalDigitsToE164,
  seedPhoneInputFromE164,
} from '@/utils/phoneLoginUsername';
import { pickMobileMoneyDefaultCountry } from '@/utils/placeOrderPhoneValidation';

export default function BusinessReelAiTokensScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, refetch } = useProfileMe();
  const { packs, balance, loading, error, purchasePack, refreshBalance } =
    useReelAiTokens();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry(me?.country)
  );
  const [nationalDigits, setNationalDigits] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    if (nationalDigits) return;
    const seeded = seedPhoneInputFromE164(
      me?.phone_number,
      pickMobileMoneyDefaultCountry(me?.country)
    );
    setCountryIso(seeded.countryIso);
    setNationalDigits(seeded.nationalDigits);
  }, [me?.phone_number, me?.country, nationalDigits]);

  const currency = (me?.currency || 'XAF').toUpperCase();
  const packCurrency =
    currency === 'CAD' ? 'CAD' : currency === 'XAF' ? 'XAF' : null;
  const displayBalance = balance ?? 0;
  const phoneE164 = nationalDigitsToE164(countryIso, nationalDigits);

  const handlePurchase = async (packId: ReelAiTokenPackId) => {
    setPurchaseError(null);
    setMessage(null);
    setPurchasingId(packId);
    try {
      const result = await purchasePack({
        packId,
        phoneNumber: phoneE164 || undefined,
        stripePaymentMethod: 'checkout',
      });
      if (result?.payment_rail === 'stripe' && result.paymentUrl) {
        await Linking.openURL(result.paymentUrl);
        return;
      }
      setMessage(
        t(
          'business.reels.tokens.mobilePending',
          'Payment request sent. Reel tokens will be added when payment succeeds.'
        )
      );
      await refreshBalance();
      await refetch({ silent: true });
    } catch (err: unknown) {
      setPurchaseError(
        err instanceof Error
          ? err.message
          : t('business.reels.tokens.purchaseError', 'Failed to start purchase')
      );
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          padding: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          backgroundColor: colors.pageBackground,
        },
      ]}
    >
      <Text
        variant="titleLarge"
        style={{ color: colors.text.primary, fontWeight: '600' }}
      >
        {t('business.reels.tokens.title', 'AI reel tokens')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: colors.text.secondary,
          marginTop: spacing.xs,
          marginBottom: spacing.md,
        }}
      >
        {t(
          'business.reels.tokens.subtitle',
          'Token cost depends on model (Standard 1, Premium 4). Upload from your library is always free.'
        )}
      </Text>

      <Text
        variant="titleMedium"
        style={{ color: colors.primary.main, marginBottom: spacing.md }}
      >
        {t('business.reels.tokens.balanceLabel', 'You have {{count}} reel tokens', {
          count: displayBalance,
        })}
      </Text>

      {loading ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null}
      {(error || purchaseError) && (
        <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>
          {purchaseError || error}
        </Text>
      )}
      {message ? (
        <Text
          style={{
            color: colors.success?.main ?? colors.primary.main,
            marginBottom: spacing.sm,
          }}
        >
          {message}
        </Text>
      ) : null}

      {packCurrency === 'XAF' ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.xs }}
          >
            {t(
              'business.reels.tokens.phoneNumber',
              'Mobile money phone number'
            )}
          </Text>
          <PhoneNumberInput
            countryIso={countryIso}
            nationalDigits={nationalDigits}
            onCountryIsoChange={setCountryIso}
            onNationalDigitsChange={setNationalDigits}
            allowedIsos={['CM', 'GA']}
            hasError={nationalDigits.length > 0 && !phoneE164}
            disabled={!!purchasingId}
          />
        </View>
      ) : null}

      {!packCurrency ? (
        <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>
          {t(
            'business.reels.tokens.unsupportedCurrency',
            'Reel token packs are only available in CAD or XAF for your business country.'
          )}
        </Text>
      ) : null}

      {packs.map((pack) => {
        if (!packCurrency) return null;
        const price = pack.prices[packCurrency];
        const priceLabel =
          packCurrency === 'CAD'
            ? `${price} CAD`
            : `${price.toLocaleString()} XAF`;
        return (
          <View
            key={pack.id}
            style={[
              styles.packRow,
              {
                borderBottomColor: colors.divider,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleSmall" style={{ color: colors.text.primary }}>
                {t('business.reels.tokens.packTokens', '{{count}} tokens', {
                  count: pack.tokens,
                })}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {priceLabel}
              </Text>
            </View>
            <Button
              mode="contained"
              loading={purchasingId === pack.id}
              disabled={!!purchasingId || (packCurrency === 'XAF' && !phoneE164)}
              onPress={() => void handlePurchase(pack.id)}
            >
              {t('business.reels.tokens.buy', 'Buy')}
            </Button>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
