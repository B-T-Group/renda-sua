import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  TokenPackId,
  useBusinessTokens,
} from '../../hooks/useBusinessTokens';
import SEOHead from '../seo/SEOHead';

const BusinessAiTokensPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, refetch } = useUserProfileContext();
  const { packs, balance, loading, error, purchasePack, refreshBalance } =
    useBusinessTokens();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseInfo, setPurchaseInfo] = useState<string | null>(null);

  const currency = (profile?.currency || 'XAF').toUpperCase();
  const packCurrency = currency === 'CAD' ? 'CAD' : currency === 'XAF' ? 'XAF' : null;
  const displayBalance =
    balance ?? profile?.business?.ai_tokens ?? 0;

  const handlePurchase = async (packId: TokenPackId) => {
    setPurchaseError(null);
    setPurchaseInfo(null);
    setPurchasingId(packId);
    try {
      const result = await purchasePack({
        packId,
        phoneNumber: phoneNumber || undefined,
        stripePaymentMethod: 'checkout',
      });
      const paymentUrl = result.paymentUrl || result.checkout_url;
      if (result.payment_rail === 'stripe' && paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }
      setPurchaseInfo(
        t(
          'business.tokens.mobilePending',
          'Payment request sent. Tokens will be added when payment succeeds.'
        )
      );
      await refreshBalance();
      await refetch();
    } catch (err: any) {
      setPurchaseError(
        err?.response?.data?.message ||
          err?.message ||
          t('business.tokens.purchaseError', 'Failed to start purchase')
      );
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('business.tokens.seoTitle', 'AI tokens')}
        description={t(
          'business.tokens.seoDescription',
          'Buy AI tokens for image cleanup'
        )}
      />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>

      <Typography
        variant="h4"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <AutoAwesomeIcon color="primary" />
        {t('business.tokens.title', 'AI tokens')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.tokens.subtitle',
          'Each image cleanup uses 1 AI token. Purchase packs when you need more.'
        )}
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('business.tokens.balanceLabel', 'You have {{count}} AI tokens', {
          count: displayBalance,
        })}
      </Alert>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
          <CircularProgress size={24} />
          <Typography>{t('common.loading', 'Loading...')}</Typography>
        </Box>
      )}

      {(error || purchaseError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {purchaseError || error}
        </Alert>
      )}
      {purchaseInfo && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {purchaseInfo}
        </Alert>
      )}

      {packCurrency === 'XAF' && (
        <TextField
          fullWidth
          label={t('business.tokens.phoneNumber', 'Mobile money phone number')}
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          sx={{ mb: 3 }}
        />
      )}

      {!packCurrency && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            'business.tokens.unsupportedCurrency',
            'Token packs are only available in CAD or XAF for your business country.'
          )}
        </Alert>
      )}

      <Stack spacing={2}>
        {packs.map((pack) => {
          if (!packCurrency) return null;
          const price = pack.prices[packCurrency];
          const priceLabel =
            packCurrency === 'CAD'
              ? `${price} CAD`
              : `${price.toLocaleString()} XAF`;
          return (
            <Box
              key={pack.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                py: 2,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box>
                <Typography fontWeight={600}>
                  {t('business.tokens.packTokens', '{{count}} tokens', {
                    count: pack.tokens,
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {priceLabel}
                </Typography>
              </Box>
              <Button
                variant="contained"
                disabled={!!purchasingId}
                onClick={() => handlePurchase(pack.id)}
              >
                {purchasingId === pack.id
                  ? t('common.loading', 'Loading...')
                  : t('business.tokens.buy', 'Buy')}
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Container>
  );
};

export default BusinessAiTokensPage;
