import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Surface, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  countrySupportsStripe,
  useSupportedCountries,
} from '../../hooks/useSupportedCountries';
import { useStore } from '../../stores/RootStore';
import { FoodsMenuHeroIllustration } from '../illustrations/FoodsMenuHeroIllustration';

function heroMessage(isStripe: boolean, t: (key: string, fallback: string) => string) {
  return isStripe
    ? t(
        'foods.hero.messageCard',
        'Pay by card — they cook, we ping you when it’s ready.'
      )
    : t(
        'foods.hero.messageMomo',
        'Pay with Mobile Money — they cook, we ping you when it’s ready.'
      );
}

/**
 * Compact Food how-it-works strip: order, kitchen, notify, plus pay method.
 */
export const FoodsMenuHero = observer(function FoodsMenuHero() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { auth, market } = useStore();
  const { countries } = useSupportedCountries();
  const { isStripeRail, status } = useIsStripeRail(auth.isAuthenticated);
  const isStripe = status
    ? isStripeRail
    : countrySupportsStripe(countries, market.selectedCountryCode);

  return (
    <Surface
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderColor: colors.divider,
          padding: spacing.sm,
          gap: spacing.sm,
        },
      ]}
      elevation={0}
    >
      <FoodsMenuHeroIllustration
        size={64}
        accessibilityLabel={t(
          'foods.hero.illustrationLabel',
          'Order food, restaurant prepares it, you get notified'
        )}
      />
      <View style={styles.copy}>
        <Text
          variant="titleSmall"
          style={[styles.title, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {t('foods.hero.title', 'You order. They cook. You get pinged.')}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 2 }}
          numberOfLines={3}
        >
          {heroMessage(isStripe, t)}
        </Text>
      </View>
    </Surface>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
});
