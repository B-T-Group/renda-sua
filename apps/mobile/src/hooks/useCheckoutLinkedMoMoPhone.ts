import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobilePaymentPhones } from './useMobilePaymentPhones';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
  MobilePaymentPhoneSummary,
} from '../types/mobilePaymentPhone';

export function useCheckoutLinkedMoMoPhone(enabled: boolean) {
  const { t } = useTranslation();
  const { phones, loading, fetchPhones, verificationMethod, api } =
    useMobilePaymentPhones(enabled);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [linkingBusy, setLinkingBusy] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyMode, setVerifyMode] = useState<MobilePaymentPhoneModalMode>('add');
  const [verifyInitial, setVerifyInitial] = useState<MobilePaymentPhoneSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || loading) return;
    setSelectedPhoneId((prev) => {
      if (prev && phones.some((p) => p.id === prev)) return prev;
      const def = phones.find((p) => p.is_default) ?? phones[0];
      return def?.id ?? null;
    });
  }, [enabled, loading, phones]);

  const linkedPhone = useMemo((): MobilePaymentPhone | null => {
    if (!selectedPhoneId) return null;
    return phones.find((p) => p.id === selectedPhoneId) ?? null;
  }, [phones, selectedPhoneId]);

  const selectPhone = useCallback(
    async (phone: MobilePaymentPhone) => {
      const res = await api.setDefault(phone.id);
      const updated = res.data?.phone ?? phone;
      setSelectedPhoneId(updated.id);
      await fetchPhones();
      setChooserOpen(false);
      return updated;
    },
    [api, fetchPhones]
  );

  const linkProfilePhone = useCallback(async () => {
    setLinkingBusy(true);
    setActionError(null);
    try {
      const res = await api.linkProfile();
      const phone = res.data?.phone;
      if (!phone) {
        setActionError(
          t(
            'mobilePaymentPhone.profileNotMobileMoney',
            'Your profile phone is not a Mobile Money number'
          )
        );
        return;
      }
      await selectPhone(phone);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
    } finally {
      setLinkingBusy(false);
    }
  }, [api, selectPhone, t]);

  const openChangePhone = useCallback(() => {
    void fetchPhones();
    setChooserOpen(true);
  }, [fetchPhones]);

  const openAddPhone = useCallback(() => {
    setChooserOpen(false);
    setVerifyMode('add');
    setVerifyInitial(null);
    setVerifyOpen(true);
  }, []);

  const openVerifyPhone = useCallback((phone: MobilePaymentPhoneSummary) => {
    setChooserOpen(false);
    setVerifyMode('verify');
    setVerifyInitial(phone);
    setVerifyOpen(true);
  }, []);

  const onVerifyCompleted = useCallback(
    async (phone: MobilePaymentPhone) => {
      await selectPhone(phone);
      setVerifyOpen(false);
      setVerifyInitial(null);
    },
    [selectPhone]
  );

  return {
    phones,
    verificationMethod,
    phonesLoading: loading,
    linkedPhone,
    selectedPhoneId,
    linkingBusy,
    actionError,
    chooserOpen,
    setChooserOpen,
    verifyOpen,
    verifyMode,
    verifyInitial,
    setVerifyOpen,
    selectPhone,
    linkProfilePhone,
    openChangePhone,
    openAddPhone,
    openVerifyPhone,
    onVerifyCompleted,
    fetchPhones,
  };
}
