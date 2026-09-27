import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MobilePaymentPhone,
  useMobilePaymentPhones,
} from '../../hooks/useMobilePaymentPhones';
import { MobilePaymentPhoneVerifyModal } from '../dialogs/MobilePaymentPhoneVerifyModal';

function isLikelyMobileMoneyCountry(country?: string | null): boolean {
  const code = (country || '').trim().toUpperCase();
  return code === 'CM' || code === 'GA';
}

export type ClientMobileMoneyPhoneSectionProps = {
  /** Profile contact phone (users.phone_number). */
  profilePhone?: string | null;
  /** ISO country from the user profile. */
  profileCountry?: string | null;
  /** Compact checkout layout vs profile card. */
  variant?: 'profile' | 'checkout';
  /** Currently selected registry phone id (checkout). */
  selectedPhoneId?: string | null;
  onSelectedPhoneChange?: (phone: MobilePaymentPhone | null) => void;
  /** When true, place-order must wait until a registry phone is linked. */
  requireLinkedPhone?: boolean;
};

export function ClientMobileMoneyPhoneSection({
  profilePhone,
  profileCountry,
  variant = 'profile',
  selectedPhoneId,
  onSelectedPhoneChange,
  requireLinkedPhone = false,
}: ClientMobileMoneyPhoneSectionProps) {
  const { t } = useTranslation();
  const {
    phones,
    loading,
    error,
    fetchPhones,
    setDefaultPhone,
    linkProfilePhone,
  } = useMobilePaymentPhones(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const defaultPhone = useMemo(
    () => phones.find((p) => p.is_default) ?? phones[0] ?? null,
    [phones]
  );
  const selected =
    phones.find((p) => p.id === selectedPhoneId) ?? defaultPhone;

  // Seed parent selection when registry phones load but checkout never got a
  // preflight suggestion (parent gate would otherwise block Place Order).
  useEffect(() => {
    if (!onSelectedPhoneChange || selectedPhoneId || !defaultPhone) return;
    onSelectedPhoneChange(defaultPhone);
  }, [defaultPhone, onSelectedPhoneChange, selectedPhoneId]);

  const showSection =
    phones.length > 0 ||
    isLikelyMobileMoneyCountry(profileCountry) ||
    Boolean(profilePhone?.trim());

  if (!showSection && variant === 'profile') return null;

  const handleSelect = async (phone: MobilePaymentPhone) => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await setDefaultPhone(phone.id);
      onSelectedPhoneChange?.(updated);
      await fetchPhones();
    } catch (e: any) {
      setActionError(e?.message || t('common.error', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const handleLinkProfile = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await linkProfilePhone();
      if (!result.phone) {
        setActionError(
          t(
            'mobilePaymentPhone.profileNotMobileMoney',
            'Your profile phone is not a Mobile Money number'
          )
        );
        return;
      }
      onSelectedPhoneChange?.(result.phone);
      await fetchPhones();
    } catch (e: any) {
      setActionError(e?.message || t('common.error', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const title =
    variant === 'checkout'
      ? t('checkout.yourMoMoNumber', 'Your MoMo number')
      : t('mobilePaymentPhone.profileTitle', 'Mobile Money number');

  const helper =
    variant === 'checkout'
      ? t('checkout.momoPhoneHelper', 'Must match your MoMo number')
      : t(
          'mobilePaymentPhone.profileHelper',
          'Payment requests go to this number.'
        );

  return (
    <Box sx={{ mb: variant === 'checkout' ? 3 : 0 }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {helper}
      </Typography>

      {(error || actionError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError || error}
        </Alert>
      )}

      {loading && !selected ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : selected ? (
        <Card
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'primary.50',
            borderColor: 'primary.200',
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
          >
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {selected.phone_e164}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} useFlexGap>
                <Chip
                  size="small"
                  color={selected.is_verified ? 'success' : 'default'}
                  label={
                    selected.is_verified
                      ? t('mobilePaymentPhone.verified', 'Verified')
                      : t('mobilePaymentPhone.unverified', 'Not verified')
                  }
                />
                {selected.is_default && (
                  <Chip
                    size="small"
                    color="primary"
                    label={t('checkout.selectedForPayment', 'Selected for payment')}
                  />
                )}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                disabled={busy}
                onClick={() => setModalOpen(true)}
              >
                {t('common.change', 'Change')}
              </Button>
            </Stack>
          </Stack>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {requireLinkedPhone
              ? t(
                  'checkout.linkMoMoRequired',
                  'Link a Mobile Money number to continue.'
                )
              : t(
                  'mobilePaymentPhone.noneYet',
                  'No Mobile Money number linked yet.'
                )}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {profilePhone?.trim() && (
              <Button
                variant="contained"
                size="small"
                disabled={busy}
                onClick={() => void handleLinkProfile()}
              >
                {t('mobilePaymentPhone.useProfilePhone', 'Use {{phone}} for Mobile Money', {
                  phone: profilePhone,
                })}
              </Button>
            )}
            <Button
              variant={profilePhone?.trim() ? 'outlined' : 'contained'}
              size="small"
              disabled={busy}
              onClick={() => setModalOpen(true)}
            >
              {t('mobilePaymentPhone.linkNumber', 'Link a Mobile Money number')}
            </Button>
          </Stack>
        </Card>
      )}

      {selected && phones.length > 1 && variant === 'checkout' && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          {phones
            .filter((p) => p.id !== selected.id)
            .map((phone) => (
              <Button
                key={phone.id}
                size="small"
                variant="text"
                disabled={busy}
                onClick={() => void handleSelect(phone)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {t('checkout.useSavedPhone', 'Use {{phone}}', {
                  phone: phone.phone_e164,
                })}
              </Button>
            ))}
        </Stack>
      )}

      {selected && (
        <Button
          size="small"
          sx={{ mt: 0.5 }}
          onClick={() => setModalOpen(true)}
        >
          {t('mobilePaymentPhone.addNew', 'Add new number…')}
        </Button>
      )}

      <MobilePaymentPhoneVerifyModal
        open={modalOpen}
        mode="add"
        setAsDefault
        allowSkipVerification
        onClose={() => setModalOpen(false)}
        onCompleted={(phone) => {
          onSelectedPhoneChange?.(phone);
          setModalOpen(false);
          void fetchPhones();
        }}
      />
    </Box>
  );
}
