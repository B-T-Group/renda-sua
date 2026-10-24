import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  TokenPackId,
  useBusinessTokens,
} from '../../hooks/useBusinessTokens';
import { useBusinessTokenGifts } from '../../hooks/useBusinessTokenGifts';
import SEOHead from '../seo/SEOHead';
import PhoneInput from '../common/PhoneInput';
import GiftAiTokensDialog from '../business/GiftAiTokensDialog';
import { pickMobileMoneyDefaultCountry } from '../../utils/mobileMoneyCountry';

const BusinessAiTokensPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, refetch } = useUserProfileContext();
  const { packs, balance, loading, error, purchasePack, refreshBalance } =
    useBusinessTokens();
  const { giftable, nongiftable, history, refreshBalanceDetails, loadHistory } =
    useBusinessTokenGifts();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseInfo, setPurchaseInfo] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);

  useEffect(() => {
    void refreshBalanceDetails();
    void loadHistory();
  }, [refreshBalanceDetails, loadHistory]);

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

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1,
        }}
      >
        <Typography
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <AutoAwesomeIcon color="primary" />
          {t('business.tokens.title', 'AI tokens')}
        </Typography>
        <Tooltip title={t('business.tokens.gift.tooltip', 'Gift tokens')}>
          <IconButton
            color="primary"
            aria-label={t('business.tokens.gift.tooltip', 'Gift tokens')}
            onClick={() => setGiftOpen(true)}
          >
            <CardGiftcardIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.tokens.subtitle',
          'Each image cleanup uses 1 AI token. Purchase packs when you need more.'
        )}
      </Typography>

      <Alert severity="info" sx={{ mb: 1 }}>
        {t('business.tokens.balanceLabel', 'You have {{count}} AI tokens', {
          count: displayBalance,
        })}
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'business.tokens.gift.transferable',
          'Transferable: {{n}} tokens',
          { n: giftable }
        )}
        {nongiftable > 0
          ? ` · ${t(
              'business.tokens.gift.free_info',
              "Free and promo tokens can't be gifted."
            )}`
          : ''}
      </Typography>

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
        <Box sx={{ mb: 3 }}>
          <PhoneInput
            value={phoneNumber}
            onChange={(value) => setPhoneNumber(value || '')}
            label={t('business.tokens.phoneNumber', 'Mobile money phone number')}
            defaultCountry={pickMobileMoneyDefaultCountry(profile?.country, [
              'CM',
              'GA',
            ])}
            onlyCountries={['CM', 'GA']}
            fullWidth
          />
        </Box>
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

      {history.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('business.tokens.gift.history', 'Gift history')}
          </Typography>
          <Stack spacing={1}>
            {history.slice(0, 20).map((row) => (
              <Typography key={row.id} variant="body2" color="text.secondary">
                {row.direction === 'sent'
                  ? t(
                      'business.tokens.gift.hist_sent',
                      'Gift sent to {{name}}',
                      { name: row.maskedName }
                    )
                  : t(
                      'business.tokens.gift.hist_received',
                      'Gift from {{name}}',
                      { name: row.maskedName }
                    )}
                {` · ${row.amount > 0 ? (row.direction === 'sent' ? '-' : '+') : ''}${row.amount}`}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      <GiftAiTokensDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        onSent={async () => {
          await refreshBalance();
          await refreshBalanceDetails();
          await loadHistory();
          await refetch();
        }}
      />
    </Container>
  );
};

export default BusinessAiTokensPage;
