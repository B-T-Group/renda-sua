import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useAuth0 } from '@auth0/auth0-react';
import { useTranslation } from 'react-i18next';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useMarket } from '../../hooks/useMarket';
import { useSupportedCountries } from '../../hooks/useSupportedCountries';
import FoodsMenuHeroIllustration from '../illustrations/FoodsMenuHeroIllustration';

function countryUsesStripe(
  countries: Array<{ code: string; supportedPaymentMethods: string[] }>,
  countryCode?: string | null
): boolean {
  if (!countryCode) return false;
  const match = countries.find(
    (country) => country.code?.toUpperCase() === countryCode.toUpperCase()
  );
  return !!match?.supportedPaymentMethods?.includes('stripe');
}

/**
 * Compact Food how-it-works strip: order, kitchen, notify, plus pay method.
 */
export default function FoodsMenuHero() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth0();
  const { isStripeRail, status } = useIsStripeRail();
  const { countries } = useSupportedCountries();
  const { selectedMarket } = useMarket();
  const isStripe =
    isAuthenticated && status
      ? isStripeRail
      : countryUsesStripe(countries, selectedMarket?.countryCode);
  const message = isStripe
    ? t(
        'foods.hero.messageCard',
        'Pay by card — they cook, we ping you when it’s ready.'
      )
    : t(
        'foods.hero.messageMomo',
        'Pay with Mobile Money — they cook, we ping you when it’s ready.'
      );

  return (
    <Paper
      elevation={0}
      component="section"
      aria-label={t('foods.title', 'Food')}
      sx={(theme) => ({
        borderRadius: 2,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1.25, sm: 1.5 },
        mb: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.9),
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 70%)`
            : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
      })}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <FoodsMenuHeroIllustration
          size={64}
          label={t(
            'foods.hero.illustrationLabel',
            'Order food, restaurant prepares it, you get notified'
          )}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}
          >
            {t('foods.hero.title', 'You order. They cook. You get pinged.')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {message}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
